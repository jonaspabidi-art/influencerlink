import type { BusinessProfile, PrismaClient } from '@prisma/client';
import { recordAudit } from '../../lib/audit.js';
import type { SubscriptionSnapshot } from './types.js';

/**
 * Lägen där företaget har betalat, eller där Stripe fortfarande försöker dra.
 *
 * past_due räknas som gällande: kortet kan ha gått ut, och Stripe gör flera
 * nya försök under ett par veckor. Att stänga av mitt i ett pågående
 * samarbete för en utgången kortsiffra vore att straffa restaurangen för
 * något banken gjorde. Företaget ser i appen att kortet behöver bytas.
 */
const KEEPS_PLAN = new Set(['active', 'trialing', 'past_due']);

/**
 * För över en prenumeration från Stripe till företagets nivå.
 *
 * Tål att anropas hur många gånger som helst med samma läge – både webhooken
 * och appens bekräftelse efter betalsidan anropar den, och ingen av dem vet
 * om den andra hunnit först.
 *
 * Returnerar null om prenumerationen inte går att knyta till ett företag,
 * eller om den tillhör en annan kund än företagets egen.
 */
export async function applySubscription(
  prisma: PrismaClient,
  snapshot: SubscriptionSnapshot,
): Promise<BusinessProfile | null> {
  const business =
    (await prisma.businessProfile.findUnique({
      where: { stripeSubscriptionId: snapshot.id },
    })) ??
    (snapshot.businessId
      ? await prisma.businessProfile.findUnique({
          where: { id: snapshot.businessId },
        })
      : null) ??
    (await prisma.businessProfile.findFirst({
      where: { stripeCustomerId: snapshot.customerId },
    }));
  if (!business) return null;

  // En prenumeration på någon annans kundkonto får aldrig låsa upp en nivå här.
  if (business.stripeCustomerId && business.stripeCustomerId !== snapshot.customerId) return null;

  const live = KEEPS_PLAN.has(snapshot.status) && snapshot.plan !== null;

  /*
   * En gammal prenumeration som tar slut ska inte nollställa en ny.
   *
   * Händer om någon betalat två gånger, eller om en händelse om den förra
   * kommer fram sent. Den som gäller är den företaget står på nu.
   */
  if (business.stripeSubscriptionId && business.stripeSubscriptionId !== snapshot.id && !live) {
    return business;
  }

  const plan = live ? snapshot.plan! : 'NONE';
  const updated = await prisma.businessProfile.update({
    where: { id: business.id },
    data: {
      barterPlan: plan,
      stripeCustomerId: snapshot.customerId,
      // En avslutad prenumeration släpps, så att en ny betalsida kan öppnas.
      stripeSubscriptionId: live ? snapshot.id : null,
      barterRenewsAt: live ? snapshot.renewsAt : null,
      barterCancelsAt: live ? snapshot.cancelsAt : null,
      barterPastDue: live && snapshot.status === 'past_due',
    },
  });

  if (plan !== business.barterPlan) {
    let paused = 0;
    if (plan === 'NONE') {
      /*
       * Utan abonnemang ska inga nya bartersamarbeten starta.
       *
       * Kampanjerna pausas i stället för att stängas: tecknar företaget igen
       * slår de på dem med en knapp. Avtal som redan skrivits påverkas inte –
       * kreatören har bokat in sig och ska få sin måltid.
       */
      const result = await prisma.campaign.updateMany({
        where: {
          businessId: business.id,
          compensationType: 'PRODUCT',
          status: 'ACTIVE',
        },
        data: { status: 'PAUSED' },
      });
      paused = result.count;
    }
    await recordAudit(prisma, {
      action: 'billing.barter_plan_changed',
      entityType: 'BusinessProfile',
      entityId: business.id,
      metadata: {
        from: business.barterPlan,
        to: plan,
        subscriptionId: snapshot.id,
        status: snapshot.status,
        pausedCampaigns: paused,
      },
    });
  }

  return updated;
}
