import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { badRequest } from '../lib/errors.js';
import type { Services } from '../services/index.js';
import { markEscrowed } from '../services/payments/escrow.js';
import { StripePaymentProvider } from '../services/payments/index.js';

/**
 * Stripes webhook. Signaturen verifieras mot rå request-body, därför måste
 * den här routen ha en egen body-parser som inte gör om JSON till objekt.
 */
export async function webhookRoutes(app: FastifyInstance, services: Services): Promise<void> {
  const { prisma, payments } = services;

  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_request, body, done) => done(null, body),
  );

  app.post('/webhooks/stripe', async (request, reply) => {
    if (!(payments instanceof StripePaymentProvider)) {
      // Utan riktig Stripe-integration finns inget att verifiera mot.
      return reply.status(503).send({ error: 'not_configured', message: 'Stripe är inte konfigurerat.' });
    }

    const signature = request.headers['stripe-signature'];
    if (typeof signature !== 'string') {
      throw badRequest('Saknar stripe-signature-huvud.');
    }

    let event;
    try {
      event = payments.constructWebhookEvent(request.body as Buffer, signature);
    } catch (error) {
      request.log.warn({ err: error }, 'ogiltig Stripe-signatur');
      throw badRequest('Signaturen kunde inte verifieras.');
    }

    // Stripe skickar om händelser vid timeout – varje id bokförs bara en gång.
    const alreadyHandled = await prisma.processedWebhook.findUnique({ where: { id: event.id } });
    if (alreadyHandled) return { received: true };

    switch (event.type) {
      case 'payment_intent.succeeded': {
        await markEscrowed(prisma, event.data.object.id);
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
    async () => ({ configured: payments instanceof StripePaymentProvider }),
  );
}
