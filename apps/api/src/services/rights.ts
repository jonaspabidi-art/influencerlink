import {
  renderUsageRightsTerms,
  summariseMetrics,
  usageRightsPrice,
  USAGE_RIGHTS_MONTHS,
} from '@pacta/shared';
import type { PrismaClient, UsageRights } from '@prisma/client';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { recordAudit } from '../lib/audit.js';
import { sha256Hex } from '../lib/crypto.js';
import type { PaymentProvider } from './payments/types.js';

/**
 * Tillägget om annonsering.
 *
 * Företaget frågar först när filmen har visningar att visa upp, kreatören
 * svarar ja eller nej, och pengarna går samma väg som arvodet: in till
 * plattformen, ut till kreatören. Blir svaret nej händer ingenting – grundavtalet
 * och dess §5 gäller oförändrat.
 */

/** Stripe vill ha ett eget id per betalning; tillägget är inte arvodet. */
const paymentKey = (contractId: string) => `${contractId}:rights`;

/** Företaget frågar. Texten fryses här, så båda kan visa vad som erbjöds. */
export async function requestUsageRights(
  prisma: PrismaClient,
  input: { contractId: string; userId: string },
): Promise<UsageRights> {
  const contract = await prisma.contract.findUnique({
    where: { id: input.contractId },
    include: {
      usageRights: true,
      campaign: { select: { title: true, business: { select: { companyName: true } } } },
      influencer: { select: { displayName: true } },
    },
  });
  if (!contract) throw notFound('Avtalet hittades inte.');
  if (contract.usageRights) throw conflict('Ni har redan frågat om annonsrätt.');
  if (!contract.deliveredAt) throw badRequest('Materialet är inte levererat än.');

  // Erbjudandet hör ihop med ett resultat. Utan visningar är det en abstrakt
  // juridisk fråga, och den hör inte hemma här.
  const metrics = await prisma.postMetric.findMany({ where: { contractId: contract.id } });
  if (summariseMetrics(metrics).views <= 0) {
    throw badRequest('Vänta tills inlägget har visningar – då vet ni vad ni köper.');
  }

  const price = usageRightsPrice(contract.fee);
  const terms = renderUsageRightsTerms({
    contractId: contract.id,
    businessName: contract.campaign.business.companyName,
    influencerName: contract.influencer.displayName,
    campaignTitle: contract.campaign.title,
    fee: contract.fee,
    months: USAGE_RIGHTS_MONTHS,
  });

  const rights = await prisma.usageRights.create({
    data: {
      contractId: contract.id,
      months: USAGE_RIGHTS_MONTHS,
      amount: price.amount,
      creatorShare: price.creatorShare,
      platformShare: price.platformShare,
      terms,
      termsHash: sha256Hex(terms),
    },
  });

  await recordAudit(prisma, {
    userId: input.userId,
    action: 'usage_rights.requested',
    entityType: 'UsageRights',
    entityId: rights.id,
    metadata: { contractId: contract.id, amount: price.amount },
  });
  return rights;
}

/** Kreatören svarar. Ett nej är ett fullgott svar och stänger frågan. */
export async function respondToUsageRights(
  prisma: PrismaClient,
  input: { contractId: string; userId: string; accept: boolean },
): Promise<UsageRights> {
  const rights = await prisma.usageRights.findUnique({ where: { contractId: input.contractId } });
  if (!rights) throw notFound('Det finns ingen förfrågan om annonsrätt.');
  if (rights.status !== 'REQUESTED') throw conflict('Förfrågan är redan besvarad.');

  const updated = await prisma.usageRights.update({
    where: { id: rights.id },
    data: { status: input.accept ? 'ACCEPTED' : 'DECLINED', respondedAt: new Date() },
  });

  await recordAudit(prisma, {
    userId: input.userId,
    action: input.accept ? 'usage_rights.accepted' : 'usage_rights.declined',
    entityType: 'UsageRights',
    entityId: rights.id,
    metadata: { contractId: input.contractId },
  });
  return updated;
}

/** Företaget betalar tillägget. Samma escrow-räls som arvodet. */
export async function payUsageRights(
  prisma: PrismaClient,
  payments: PaymentProvider,
  input: { contractId: string; userId: string },
): Promise<{ clientSecret: string; amount: number }> {
  const rights = await prisma.usageRights.findUnique({
    where: { contractId: input.contractId },
    include: {
      contract: {
        include: { campaign: { include: { business: true } } },
      },
    },
  });
  if (!rights) throw notFound('Det finns ingen förfrågan om annonsrätt.');
  if (rights.status !== 'ACCEPTED') throw badRequest('Kreatören har inte godkänt tillägget än.');
  if (rights.paymentStatus !== 'PENDING') throw conflict('Tillägget är redan betalt.');

  const business = rights.contract.campaign.business;
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
    contractId: paymentKey(rights.contractId),
    amount: rights.amount,
    customerId,
    description: `Annonsrätt – ${rights.contract.campaign.title}`,
  });

  await prisma.usageRights.update({
    where: { id: rights.id },
    data: { stripePaymentIntentId: intent.paymentIntentId },
  });
  return { clientSecret: intent.clientSecret, amount: rights.amount };
}

/**
 * Pengarna har kommit in. Anropas av Stripe-webhooken.
 *
 * Till skillnad från arvodet finns ingen leverans att vänta på – materialet
 * är redan gjort och godkänt – så kreatörens del går ut direkt.
 */
export async function settleUsageRights(
  prisma: PrismaClient,
  payments: PaymentProvider,
  paymentIntentId: string,
): Promise<void> {
  const rights = await prisma.usageRights.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
    include: { contract: { include: { influencer: true } } },
  });
  if (!rights || rights.paymentStatus !== 'PENDING') return;

  await prisma.usageRights.update({
    where: { id: rights.id },
    data: { paymentStatus: 'ESCROWED', escrowedAt: new Date() },
  });

  const accountId = rights.contract.influencer.stripeAccountId;
  if (!accountId) return; // Betalas ut när utbetalningskontot är kopplat.

  const transfer = await payments.releasePayout({
    contractId: paymentKey(rights.contractId),
    destinationAccountId: accountId,
    amount: rights.creatorShare,
  });

  await prisma.usageRights.update({
    where: { id: rights.id },
    data: {
      paymentStatus: 'RELEASED',
      releasedAt: new Date(),
      stripeTransferId: transfer.transferId,
    },
  });
  await recordAudit(prisma, {
    action: 'usage_rights.released',
    entityType: 'UsageRights',
    entityId: rights.id,
    metadata: { payout: rights.creatorShare },
  });
}
