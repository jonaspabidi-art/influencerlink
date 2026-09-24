import { BARTER_PLANS, SELLABLE_BARTER_PLANS, barterBlocker } from '@pacta/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Config } from '../config.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { barterUsage } from '../services/barter.js';
import { applySubscription } from '../services/billing/index.js';
import type { Services } from '../services/index.js';

const problemSchema = z.object({ error: z.string(), message: z.string() });

const barterStatusSchema = z.object({
  plan: z.enum(BARTER_PLANS),
  used: z.number().int(),
  limit: z.number().int(),
  remaining: z.number().int(),
  canStart: z.boolean(),
  /** Meningen som förklarar varför inget går att starta, annars null. */
  blocker: z.string().nullable(),
  /** Nivån betalas via Stripe och kan hanteras i kundportalen. */
  subscribed: z.boolean(),
  /** Nästa dragning. Null om abonnemanget är uppsagt eller inte finns. */
  renewsAt: z.string().nullable(),
  /** Sista dagen nivån gäller efter en uppsägning. */
  cancelsAt: z.string().nullable(),
  /** Senaste dragningen misslyckades – kortet behöver bytas. */
  pastDue: z.boolean(),
  /** Betalningarna går mot Stripes testläge. Appen visar då testkortet. */
  testMode: z.boolean(),
});

/**
 * Vart betalsidan skickar tillbaka.
 *
 * Anropets Origin används bara om den redan är en betrodd adress. Annars
 * kunde vem som helst få Stripe att skicka en betalande kund till en sida
 * som ser ut som Pacta men inte är det.
 */
export function barterReturnUrl(config: Config, origin: string | undefined): string {
  const base =
    origin && config.corsOrigins.includes(origin)
      ? origin
      : (config.APP_WEB_URL ?? config.corsOrigins[0] ?? 'http://localhost:8081');
  return `${base.replace(/\/$/, '')}/barter/plans`;
}

export async function billingRoutes(app: FastifyInstance, services: Services): Promise<void> {
  const server = app.withTypeProvider<ZodTypeProvider>();
  const { prisma, billing, config } = services;

  async function currentBusiness(request: FastifyRequest) {
    const business = await prisma.businessProfile.findUnique({
      where: { userId: request.user.sub },
    });
    if (!business) throw notFound('Företagsprofilen hittades inte.');
    return business;
  }

  async function statusFor(businessId: string) {
    const business = await prisma.businessProfile.findUniqueOrThrow({
      where: { id: businessId },
    });
    const allowance = await barterUsage(prisma, business.id);
    return {
      ...allowance,
      blocker: barterBlocker(allowance),
      subscribed: business.stripeSubscriptionId !== null,
      renewsAt: business.barterRenewsAt?.toISOString() ?? null,
      cancelsAt: business.barterCancelsAt?.toISOString() ?? null,
      pastDue: business.barterPastDue,
      testMode: billing.testMode,
    };
  }

  server.get(
    '/me/barter',
    {
      preHandler: app.requireRole('BUSINESS'),
      schema: { response: { 200: barterStatusSchema, 404: problemSchema } },
    },
    async (request) => statusFor((await currentBusiness(request)).id),
  );

  /**
   * Väljer en nivå.
   *
   * Utan abonnemang: en betalsida hos Stripe, som appen öppnar. Med ett
   * abonnemang: nivån byts direkt och mellanskillnaden hamnar på nästa
   * faktura. Företaget ska inte behöva betala in kortet på nytt för att gå
   * från Basic till Medium.
   */
  server.post(
    '/me/barter/subscribe',
    {
      preHandler: app.requireRole('BUSINESS'),
      schema: {
        body: z.object({
          plan: z.enum(SELLABLE_BARTER_PLANS as [string, ...string[]]),
        }),
        response: {
          200: z.discriminatedUnion('kind', [
            z.object({ kind: z.literal('redirect'), url: z.string() }),
            z.object({
              kind: z.literal('updated'),
              status: barterStatusSchema,
            }),
          ]),
          404: problemSchema,
          409: problemSchema,
        },
      },
    },
    async (request) => {
      const business = await currentBusiness(request);
      const plan = request.body.plan as (typeof SELLABLE_BARTER_PLANS)[number];

      if (business.stripeSubscriptionId) {
        if (business.barterPlan === plan && !business.barterCancelsAt) {
          throw conflict(`Ni har redan ${plan.toLowerCase()}.`);
        }
        await billing.changePlan(business.stripeSubscriptionId, plan);
        const snapshot = await billing.fetchSubscription(business.stripeSubscriptionId);
        if (snapshot) await applySubscription(prisma, snapshot);
        return {
          kind: 'updated' as const,
          status: await statusFor(business.id),
        };
      }

      /*
       * En nivå som satts för hand – ett företag som betalar mot faktura –
       * ska inte kunna dubbelbetalas via appen. Det byts genom oss.
       */
      if (business.barterPlan !== 'NONE') {
        throw conflict('Er nivå hanteras via faktura. Hör av er till oss för att byta.');
      }

      const { url, customerId } = await billing.startCheckout({
        businessId: business.id,
        customerId: business.stripeCustomerId,
        companyName: business.companyName,
        orgNumber: business.orgNumber,
        plan,
        returnUrl: barterReturnUrl(config, request.headers.origin),
      });
      if (customerId !== business.stripeCustomerId) {
        await prisma.businessProfile.update({
          where: { id: business.id },
          data: { stripeCustomerId: customerId },
        });
      }
      return { kind: 'redirect' as const, url };
    },
  );

  /**
   * Appen anropar den här när betalsidan skickat tillbaka.
   *
   * Webhooken gör samma sak, men den kan dröja – eller saknas helt i en
   * testmiljö där ingen lagt in adressen hos Stripe. Utan det här steget står
   * restaurangen och tittar på "Inget abonnemang" direkt efter att ha betalat.
   */
  server.post(
    '/me/barter/confirm',
    {
      preHandler: app.requireRole('BUSINESS'),
      schema: {
        body: z.object({ sessionId: z.string().min(1).max(255) }),
        response: {
          200: barterStatusSchema,
          400: problemSchema,
          403: problemSchema,
          404: problemSchema,
        },
      },
    },
    async (request) => {
      const business = await currentBusiness(request);
      const checkout = await billing.subscriptionForCheckout(request.body.sessionId);
      if (!checkout) throw badRequest('Betalningen är inte klar ännu.');
      // En betalsida som någon annan öppnat får inte låsa upp en nivå här.
      if (checkout.businessId !== business.id) throw forbidden();

      const snapshot = await billing.fetchSubscription(checkout.subscriptionId);
      if (snapshot) await applySubscription(prisma, snapshot);
      return statusFor(business.id);
    },
  );

  /** Stripes kundportal: byta kort, ladda ner kvitton, säga upp. */
  server.post(
    '/me/barter/portal',
    {
      preHandler: app.requireRole('BUSINESS'),
      schema: {
        response: {
          200: z.object({ url: z.string() }),
          400: problemSchema,
          404: problemSchema,
        },
      },
    },
    async (request) => {
      const business = await currentBusiness(request);
      if (!business.stripeCustomerId) {
        throw badRequest('Ni har inget abonnemang att hantera än.');
      }
      return {
        url: await billing.portalUrl(
          business.stripeCustomerId,
          barterReturnUrl(config, request.headers.origin),
        ),
      };
    },
  );
}
