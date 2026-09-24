import type { FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import { z } from 'zod';
import { badRequest } from '../lib/errors.js';
import type { Services } from '../services/index.js';
import { markEscrowed } from '../services/payments/escrow.js';
import { markPeriodPaid } from '../services/retainers.js';
import { settleUsageRights } from '../services/rights.js';
import { applySubscription } from '../services/billing/index.js';

/**
 * Stripes webhook. Signaturen verifieras mot rå request-body, därför måste
 * den här routen ha en egen body-parser som inte gör om JSON till objekt.
 */
export async function webhookRoutes(app: FastifyInstance, services: Services): Promise<void> {
  const { prisma, payments, billing, config } = services;

  /*
   * Signaturen kontrolleras med en egen klient, inte via betalleverantören.
   * Abonnemangen kan gå mot Stripe medan kampanjpengarna simuleras, och då
   * ska webhooken ändå ta emot händelser om prenumerationerna.
   */
  const verifier =
    config.STRIPE_SECRET_KEY && config.STRIPE_WEBHOOK_SECRET
      ? new Stripe(config.STRIPE_SECRET_KEY, { apiVersion: '2025-08-27.basil' })
      : null;

  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_request, body, done) => done(null, body),
  );

  app.post('/webhooks/stripe', async (request, reply) => {
    if (!verifier || !config.STRIPE_WEBHOOK_SECRET) {
      // Utan nyckel och webhook-hemlighet finns inget att verifiera mot.
      return reply.status(503).send({ error: 'not_configured', message: 'Stripe är inte konfigurerat.' });
    }

    const signature = request.headers['stripe-signature'];
    if (typeof signature !== 'string') {
      throw badRequest('Saknar stripe-signature-huvud.');
    }

    let event;
    try {
      event = verifier.webhooks.constructEvent(
        request.body as Buffer,
        signature,
        config.STRIPE_WEBHOOK_SECRET,
      );
    } catch (error) {
      request.log.warn({ err: error }, 'ogiltig Stripe-signatur');
      throw badRequest('Signaturen kunde inte verifieras.');
    }

    // Stripe skickar om händelser vid timeout – varje id bokförs bara en gång.
    const alreadyHandled = await prisma.processedWebhook.findUnique({ where: { id: event.id } });
    if (alreadyHandled) return { received: true };

    switch (event.type) {
      case 'payment_intent.succeeded': {
        // Samma händelse bär arvodet, ett eventuellt annonstillägg och en
        // månad i ett löpande uppdrag. Bara en av dem känner igen id:t; de
        // andra gör ingenting.
        await markEscrowed(prisma, event.data.object.id);
        await settleUsageRights(prisma, payments, event.data.object.id);
        await markPeriodPaid(prisma, event.data.object.id);
        break;
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object;
        await prisma.payment.updateMany({
          where: { stripePaymentIntentId: intent.id, status: 'PENDING' },
          data: {
            status: 'FAILED',
            failureReason: intent.last_payment_error?.message ?? 'Betalningen nekades.',
          },
        });
        // En period som inte blev betald ligger kvar som AWAITING_PAYMENT och
        // kan betalas om. Inget att ändra – men intentet ska inte återanvändas.
        await prisma.retainerPeriod.updateMany({
          where: { stripePaymentIntentId: intent.id, status: 'AWAITING_PAYMENT' },
          data: { stripePaymentIntentId: null },
        });
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object;
        if (typeof charge.payment_intent === 'string') {
          await prisma.payment.updateMany({
            where: { stripePaymentIntentId: charge.payment_intent },
            data: { status: 'REFUNDED' },
          });
        }
        break;
      }
      case 'account.updated': {
        const account = event.data.object;
        await prisma.influencerProfile.updateMany({
          where: { stripeAccountId: account.id },
          data: { payoutsEnabled: account.payouts_enabled === true },
        });
        break;
      }
      /*
       * Abonnemanget för mat mot innehåll.
       *
       * Händelsens innehåll används bara för att veta vilken prenumeration det
       * gäller – läget hämtas färskt från Stripe. Händelserna kommer inte
       * alltid i ordning, och en sen "updated" får inte skriva över en
       * "deleted" som redan behandlats.
       */
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const snapshot = await billing.fetchSubscription(event.data.object.id);
        if (snapshot) await applySubscription(prisma, snapshot);
        break;
      }
      case 'checkout.session.completed': {
        const session = event.data.object;
        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id;
        if (session.mode === 'subscription' && subscriptionId) {
          const snapshot = await billing.fetchSubscription(subscriptionId);
          if (snapshot) await applySubscription(prisma, snapshot);
        }
        break;
      }
      default:
        request.log.debug({ type: event.type }, 'obehandlad Stripe-händelse');
    }

    await prisma.processedWebhook.create({ data: { id: event.id, source: 'stripe' } });
    return { received: true };
  });

  app.get(
    '/webhooks/stripe/health',
    {
      schema: { response: { 200: z.object({ configured: z.boolean() }) } },
    },
    async () => ({ configured: verifier !== null }),
  );
}
