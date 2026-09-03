import { splitFee } from '@influencerlink/shared';
import type { PrismaClient } from '@prisma/client';
import { badRequest, conflict } from '../../lib/errors.js';
import { recordAudit } from '../../lib/audit.js';
import type { PaymentProvider } from './types.js';

/**
 * Skapar (eller återanvänder) escrow-betalningen för ett kontrakt.
 * Restaurangen betalar in hela arvodet till plattformen; pengarna släpps
 * först när leveransen godkänts.
 */
export async function createEscrow(
  prisma: PrismaClient,
  payments: PaymentProvider,
  input: { contractId: string; userId: string },
): Promise<{ clientSecret: string; amount: number; paymentId: string }> {
  const contract = await prisma.contract.findUniqueOrThrow({
    where: { id: input.contractId },
    include: {
      payment: true,
      campaign: { include: { business: true } },
    },
  });

  if (contract.status !== 'ACTIVE') {
    throw badRequest('Avtalet måste vara signerat av båda parter innan det kan betalas.');
  }
  if (contract.payment && contract.payment.status !== 'PENDING') {
    throw conflict('Betalningen är redan genomförd.');
  }

  const business = contract.campaign.business;
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

  const breakdown = splitFee(contract.fee, contract.platformFeeBps);
  const intent = await payments.createEscrowIntent({
    contractId: contract.id,
    amount: breakdown.gross,
    customerId,
    description: `${contract.campaign.title} – avtal ${contract.id}`,
  });

  const payment = await prisma.payment.upsert({
    where: { contractId: contract.id },
    create: {
      contractId: contract.id,
      amount: breakdown.gross,
      platformFee: breakdown.platformFee,
      payout: breakdown.net,
      stripePaymentIntentId: intent.paymentIntentId,
      status: 'PENDING',
    },
    update: {
      amount: breakdown.gross,
      platformFee: breakdown.platformFee,
      payout: breakdown.net,
      stripePaymentIntentId: intent.paymentIntentId,
      status: 'PENDING',
    },
  });

  await recordAudit(prisma, {
    userId: input.userId,
    action: 'payment.intent_created',
    entityType: 'Payment',
    entityId: payment.id,
    metadata: { amount: breakdown.gross, contractId: contract.id },
  });

  return { clientSecret: intent.clientSecret, amount: breakdown.gross, paymentId: payment.id };
}

/** Markerar betalningen som mottagen. Anropas av Stripe-webhooken. */
export async function markEscrowed(
  prisma: PrismaClient,
  paymentIntentId: string,
): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
  });
  if (!payment || payment.status !== 'PENDING') return;

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: 'ESCROWED', escrowedAt: new Date() },
  });
  await recordAudit(prisma, {
    action: 'payment.escrowed',
    entityType: 'Payment',
    entityId: payment.id,
    metadata: { amount: payment.amount },
  });
}

/**
 * Betalar ut nettobeloppet till influencerns Stripe-konto. Anropas när
 * leveransen godkänts, manuellt eller automatiskt efter granskningstiden.
 */
export async function releasePayout(
  prisma: PrismaClient,
  payments: PaymentProvider,
  input: { contractId: string; userId?: string },
): Promise<{ transferId: string; payout: number }> {
  const contract = await prisma.contract.findUniqueOrThrow({
    where: { id: input.contractId },
    include: { payment: true, influencer: true },
  });

  const payment = contract.payment;
  if (!payment) throw badRequest('Avtalet saknar registrerad betalning.');
  if (payment.status === 'RELEASED') {
    // Idempotent: en dubbelklick eller omsänd webhook ska inte betala två gånger.
    return { transferId: contract.payment?.stripeTransferId ?? '', payout: payment.payout };
  }
  if (payment.status !== 'ESCROWED') {
    throw badRequest('Pengarna har inte kommit in ännu.');
  }
  if (!contract.influencer.stripeAccountId) {
    throw badRequest('Influencern har inget utbetalningskonto kopplat.');
  }

  const transfer = await payments.releasePayout({
    contractId: contract.id,
    destinationAccountId: contract.influencer.stripeAccountId,
    amount: payment.payout,
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: 'RELEASED', releasedAt: new Date(), stripeTransferId: transfer.transferId },
  });
  await recordAudit(prisma, {
    userId: input.userId,
    action: 'payment.released',
    entityType: 'Payment',
    entityId: payment.id,
    metadata: { payout: payment.payout, transferId: transfer.transferId },
  });

  return { transferId: transfer.transferId, payout: payment.payout };
}

/** Återbetalar escrow till restaurangen, t.ex. vid utebliven leverans. */
export async function refundEscrow(
  prisma: PrismaClient,
  payments: PaymentProvider,
  input: { contractId: string; userId?: string; reason: string },
): Promise<void> {
  const payment = await prisma.payment.findUnique({ where: { contractId: input.contractId } });
  if (!payment || payment.status !== 'ESCROWED' || !payment.stripePaymentIntentId) return;

  await payments.refundEscrow(payment.stripePaymentIntentId);
  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: 'REFUNDED', failureReason: input.reason },
  });
  await recordAudit(prisma, {
    userId: input.userId,
    action: 'payment.refunded',
    entityType: 'Payment',
    entityId: payment.id,
    metadata: { reason: input.reason },
  });
}
