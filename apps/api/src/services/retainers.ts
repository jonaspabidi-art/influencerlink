import {
  DEFAULT_FEE_SPLIT,
  PREPAY_MONTHS,
  discountedMonthlyRate,
  isRetainerPackage,
  periodEnd,
  renderRetainerTerms,
  retainerMonthlyRate,
  retainerPeriodMoney,
  settlePeriod,
  type RetainerPackage,
} from '@pacta/shared';
import type { Prisma, PrismaClient, Retainer, RetainerPeriod } from '@prisma/client';
import { recordAudit } from '../lib/audit.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import type { PaymentProvider } from './payments/types.js';

/**
 * Löpande uppdrag.
 *
 * Tjänsten äger tre saker som inte får glida isär: perioderna, pengarna och
 * leveranserna. En period är betald i förskott och stängs när den löper ut;
 * först då vet vi hur många videor som faktiskt godkändes, och först då kan
 * kreatören få betalt och företaget få tillbaka det som inte levererades.
 */

/** Hur en period refereras hos betaltjänsten. */
function paymentReference(periodId: string): string {
  return `${periodId}:retainer`;
}

/** Videor som räknas som levererade: godkända, publicerade eller båda. */
const DELIVERED_STATUSES = ['APPROVED', 'PUBLISHED'] as const;

export function packageFor(videosPerMonth: number): RetainerPackage {
  if (!isRetainerPackage(videosPerMonth)) {
    throw badRequest('Paketet måste vara 4, 8 eller 12 videor i månaden.');
  }
  return videosPerMonth;
}

/**
 * Företaget frågar en kreatör om en plats.
 *
 * Priset låses här och inte när kreatören svarar. Hade det räknats om vid svaret
 * kunde kreatören höja sitt grundpris mellan förfrågan och accept, och företaget
 * skulle sitta med ett annat belopp än det tackade ja till.
 */
export async function requestRetainer(
  prisma: PrismaClient,
  input: {
    businessId: string;
    influencerId: string;
    videosPerMonth: number;
    prepaidMonths: number;
    note: string;
    userId: string;
  },
): Promise<Retainer> {
  const size = packageFor(input.videosPerMonth);
  const influencer = await prisma.influencerProfile.findUnique({
    where: { id: input.influencerId },
  });
  if (!influencer) throw notFound('Kreatören hittades inte.');
  if (!influencer.acceptsRetainers || influencer.retainerBaseRate === null) {
    throw badRequest('Kreatören tar inte löpande uppdrag just nu.');
  }
  if (influencer.retainerSlots <= 0) {
    throw conflict('Kreatören har inga lediga platser.');
  }

  const existing = await prisma.retainer.findFirst({
    where: {
      businessId: input.businessId,
      influencerId: input.influencerId,
      status: { in: ['REQUESTED', 'ACTIVE', 'CANCELLING'] },
    },
  });
  if (existing) throw conflict('Ni har redan ett löpande uppdrag med den här kreatören.');

  const listRate = retainerMonthlyRate(
    influencer.retainerBaseRate,
    size,
    influencer.retainerVolumeDiscountBps,
  );
  // Förskott är bara ett alternativ när kreatören faktiskt erbjuder något för det.
  const months =
    input.prepaidMonths >= PREPAY_MONTHS && influencer.retainerPrepayDiscountBps > 0
      ? PREPAY_MONTHS
      : 1;

  const retainer = await prisma.retainer.create({
    data: {
      businessId: input.businessId,
      influencerId: input.influencerId,
      videosPerMonth: size,
      listRate,
      monthlyRate: discountedMonthlyRate(listRate, months, influencer.retainerPrepayDiscountBps),
      prepaidMonths: months,
      businessFeeBps: DEFAULT_FEE_SPLIT.businessFeeBps,
      creatorFeeBps: DEFAULT_FEE_SPLIT.creatorFeeBps,
      requestNote: input.note,
    },
  });

  await recordAudit(prisma, {
    userId: input.userId,
    action: 'retainer.requested',
    entityType: 'Retainer',
    entityId: retainer.id,
    metadata: { videosPerMonth: size, monthlyRate: retainer.monthlyRate },
  });
  return retainer;
}

/**
 * Kreatören svarar.
 *
 * Tackar kreatören ja fryses avtalstexten och alla förskottsbetalda perioder skapas
 * på en gång. Perioderna finns alltså innan en krona betalats – det är de som
 * betalningen hänger på, och att skapa dem i efterhand skulle betyda att en
 * misslyckad betalning lämnar ett uppdrag utan period att betala.
 */
export async function respondToRequest(
  prisma: PrismaClient,
  input: { retainerId: string; influencerId: string; accept: boolean; userId: string },
): Promise<Retainer> {
  const retainer = await prisma.retainer.findUnique({
    where: { id: input.retainerId },
    include: { business: { include: { socials: true } }, influencer: true },
  });
  if (!retainer || retainer.influencerId !== input.influencerId) {
    throw notFound('Uppdraget hittades inte.');
  }
  if (retainer.status !== 'REQUESTED') {
    throw conflict('Förfrågan är redan besvarad.');
  }

  if (!input.accept) {
    const declined = await prisma.retainer.update({
      where: { id: retainer.id },
      data: { status: 'DECLINED', endedAt: new Date() },
    });
    await recordAudit(prisma, {
      userId: input.userId,
      action: 'retainer.declined',
      entityType: 'Retainer',
      entityId: retainer.id,
    });
    return declined;
  }

  const size = packageFor(retainer.videosPerMonth);
  const split = {
    businessFeeBps: retainer.businessFeeBps,
    creatorFeeBps: retainer.creatorFeeBps,
  };
  const money = retainerPeriodMoney(retainer.monthlyRate, size, split);
  const startsAt = new Date();

  const terms = renderRetainerTerms({
    businessName: retainer.business.companyName,
    orgNumber: retainer.business.orgNumber,
    creatorName: retainer.influencer.displayName,
    city: retainer.business.city,
    videosPerMonth: size,
    monthlyRate: retainer.monthlyRate,
    listRate: retainer.listRate,
    prepaidMonths: retainer.prepaidMonths,
    prepayDiscountBps: retainer.influencer.retainerPrepayDiscountBps,
    channels: retainer.business.socials.map(
      (social) => `${social.platform} @${social.handle}`,
    ),
    money,
    startsAt,
  });

  return prisma.$transaction(async (tx) => {
    const accepted = await tx.retainer.update({
      where: { id: retainer.id },
      data: { status: 'ACTIVE', startedAt: startsAt, terms },
    });

    let cursor = startsAt;
    for (let index = 1; index <= retainer.prepaidMonths; index += 1) {
      const ends = periodEnd(cursor);
      await tx.retainerPeriod.create({
        data: {
          retainerId: retainer.id,
          index,
          startsAt: cursor,
          endsAt: ends,
          videosAgreed: size,
          grossAmount: money.fee,
          chargeAmount: money.charge,
        },
      });
      cursor = ends;
    }

    // Platsen är upptagen. Två uppdrag på samma plats är ett löfte vi inte
    // kan hålla – kreatören har bara en dag i veckan att ge.
    await tx.influencerProfile.update({
      where: { id: retainer.influencerId },
      data: { retainerSlots: { decrement: 1 } },
    });

    await recordAudit(tx, {
      userId: input.userId,
      action: 'retainer.accepted',
      entityType: 'Retainer',
      entityId: retainer.id,
      metadata: { periods: retainer.prepaidMonths, monthlyRate: retainer.monthlyRate },
    });
    return accepted;
  });
}

/**
 * Företaget betalar en period i förskott.
 *
 * Betalar de flera månader på en gång blir det ändå en betalning per period.
 * Det kostar en extra transaktion men gör återbetalningen vid uppsägning
 * enkel: en outnyttjad period betalas tillbaka i sin helhet, utan att någon
 * behöver räkna ut hur mycket av en klumpsumma som hörde till vilken månad.
 */
export async function payPeriod(
  prisma: PrismaClient,
  payments: PaymentProvider,
  input: { periodId: string; businessId: string; userId: string },
): Promise<{ clientSecret: string; amount: number }> {
  const period = await prisma.retainerPeriod.findUnique({
    where: { id: input.periodId },
    include: { retainer: { include: { business: true } } },
  });
  if (!period || period.retainer.businessId !== input.businessId) {
    throw notFound('Perioden hittades inte.');
  }
  if (period.status !== 'AWAITING_PAYMENT') {
    throw conflict('Perioden är redan betald.');
  }

  const business = period.retainer.business;
  let customerId = business.stripeCustomerId;
  if (!customerId) {
    customerId = await payments.createCustomer({
      businessId: business.id,
      companyName: business.companyName,
      orgNumber: business.orgNumber,
    });
    await prisma.businessProfile.update({
      where: { id: business.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const intent = await payments.createEscrowIntent({
    reference: paymentReference(period.id),
    amount: period.chargeAmount,
    customerId,
    description: `Löpande innehåll – månad ${period.index}`,
  });

  await prisma.retainerPeriod.update({
    where: { id: period.id },
    data: { stripePaymentIntentId: intent.paymentIntentId },
  });
  await recordAudit(prisma, {
    userId: input.userId,
    action: 'retainer.period_intent_created',
    entityType: 'RetainerPeriod',
    entityId: period.id,
    metadata: { amount: period.chargeAmount },
  });

  return { clientSecret: intent.clientSecret, amount: period.chargeAmount };
}

/**
 * Pengarna kom in. Anropas av Stripe-webhooken, som provar varje intent mot
 * alla betalningsslag – bara ett känner igen id:t.
 */
export async function markPeriodPaid(
  prisma: PrismaClient,
  paymentIntentId: string,
): Promise<void> {
  const period = await prisma.retainerPeriod.findFirst({
    where: { stripePaymentIntentId: paymentIntentId, status: 'AWAITING_PAYMENT' },
  });
  if (!period) return;

  await prisma.retainerPeriod.update({
    where: { id: period.id },
    data: { status: 'ACTIVE', paidAt: new Date() },
  });
  await recordAudit(prisma, {
    action: 'retainer.period_paid',
    entityType: 'RetainerPeriod',
    entityId: period.id,
    metadata: { amount: period.chargeAmount },
  });
}

/**
 * Stänger en period och gör upp pengarna.
 *
 * Körs när perioden löpt ut. Antalet godkända videor avgör allt: full leverans
 * betalar hela arvodet, uteblivna videor dras av och går tillbaka till
 * företaget tillsammans med sin del av avgiften.
 */
export async function closePeriod(
  prisma: PrismaClient,
  payments: PaymentProvider,
  input: { periodId: string; userId?: string },
): Promise<{ payout: number; refund: number }> {
  const period = await prisma.retainerPeriod.findUnique({
    where: { id: input.periodId },
    include: {
      retainer: { include: { influencer: true } },
      posts: { select: { status: true } },
    },
  });
  if (!period) throw notFound('Perioden hittades inte.');
  if (period.status === 'CLOSED') {
    return { payout: period.releasedAmount, refund: period.refundedAmount };
  }
  if (period.status !== 'ACTIVE') {
    throw badRequest('Perioden är inte betald och kan därför inte stängas.');
  }

  const approved = period.posts.filter((post) =>
    (DELIVERED_STATUSES as readonly string[]).includes(post.status),
  ).length;

  const money = retainerPeriodMoney(period.grossAmount, packageFor(period.videosAgreed), {
    businessFeeBps: period.retainer.businessFeeBps,
    creatorFeeBps: period.retainer.creatorFeeBps,
  });
  const settled = settlePeriod(money, approved);

  const accountId = period.retainer.influencer.stripeAccountId;
  if (settled.payout > 0 && !accountId) {
    throw badRequest('Kreatören har inget utbetalningskonto kopplat.');
  }

  if (settled.payout > 0 && accountId) {
    await payments.releasePayout({
      reference: paymentReference(period.id),
      destinationAccountId: accountId,
      amount: settled.payout,
    });
  }
  if (settled.refund > 0 && period.stripePaymentIntentId) {
    await payments.refundEscrow(period.stripePaymentIntentId);
  }

  await prisma.retainerPeriod.update({
    where: { id: period.id },
    data: {
      status: 'CLOSED',
      closedAt: new Date(),
      releasedAmount: settled.payout,
      refundedAmount: settled.refund,
      platformFee: settled.platformFee,
    },
  });
  await recordAudit(prisma, {
    userId: input.userId,
    action: 'retainer.period_closed',
    entityType: 'RetainerPeriod',
    entityId: period.id,
    metadata: { approved, payout: settled.payout, refund: settled.refund },
  });

  return { payout: settled.payout, refund: settled.refund };
}

/**
 * Säger upp uppdraget. Det löper vidare till den pågående periodens slut –
 * företaget har betalat för månaden och kreatören har planerat in den.
 */
export async function cancelRetainer(
  prisma: PrismaClient,
  input: { retainerId: string; userId: string; actor: 'BUSINESS' | 'INFLUENCER' },
): Promise<Retainer> {
  const retainer = await prisma.retainer.findUnique({
    where: { id: input.retainerId },
    include: { periods: { orderBy: { index: 'desc' }, take: 1 } },
  });
  if (!retainer) throw notFound('Uppdraget hittades inte.');
  if (retainer.status !== 'ACTIVE') throw conflict('Uppdraget är inte aktivt.');

  const last = retainer.periods[0];
  const cancelled = await prisma.retainer.update({
    where: { id: retainer.id },
    data: {
      status: 'CANCELLING',
      cancelledAt: new Date(),
      endedAt: last ? last.endsAt : new Date(),
    },
  });

  await recordAudit(prisma, {
    userId: input.userId,
    action: 'retainer.cancelled',
    entityType: 'Retainer',
    entityId: retainer.id,
    metadata: { actor: input.actor, endsAt: cancelled.endedAt?.toISOString() ?? null },
  });
  return cancelled;
}

/** Den period som löper just nu, eller nästa som väntar på betalning. */
export function currentPeriod(periods: RetainerPeriod[]): RetainerPeriod | undefined {
  return (
    periods.find((period) => period.status === 'ACTIVE') ??
    periods.find((period) => period.status === 'AWAITING_PAYMENT')
  );
}

/** Hur många videor som är godkända i en period. */
export function deliveredCount(posts: { status: string }[]): number {
  return posts.filter((post) => (DELIVERED_STATUSES as readonly string[]).includes(post.status))
    .length;
}

export type RetainerWithRelations = Prisma.RetainerGetPayload<{
  include: {
    business: true;
    influencer: true;
    periods: { include: { posts: true } };
  };
}>;
