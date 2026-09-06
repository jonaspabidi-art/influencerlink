import {
  EXPERT_ORDER_CAPACITY,
  EXPERT_ORDER_PRICE,
  EXPERT_ORDER_STATUSES,
  hasCapacity,
  occupiesCapacity,
  problemSchema,
  type ExpertOrderStatus,
} from '@pacta/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { recordAudit } from '../lib/audit.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { requireProfileId } from '../plugins/auth.js';
import type { Services } from '../services/index.js';

const orderSchema = z.object({
  id: z.string(),
  status: z.enum(EXPERT_ORDER_STATUSES),
  goal: z.string(),
  timing: z.string(),
  budget: z.string(),
  notes: z.string(),
  price: z.number().int(),
  campaignId: z.string().nullable(),
  requestedAt: z.string(),
  deliveredAt: z.string().nullable(),
  paymentStatus: z.enum(['PENDING', 'ESCROWED', 'RELEASED', 'REFUNDED', 'FAILED']),
});

/** Statusarna som håller en plats i kön upptagen. */
const OPEN: ExpertOrderStatus[] = EXPERT_ORDER_STATUSES.filter(occupiesCapacity);

/**
 * "Låt en Pacta-expert skapa kampanjen."
 *
 * Företaget beskriver vad de vill uppnå, vi bygger kampanjen och levererar
 * den till deras konto. De godkänner och betalar i samma steg, och publicerar
 * själva – Pacta signerar aldrig något i deras namn.
 */
export async function expertRoutes(app: FastifyInstance, services: Services): Promise<void> {
  const server = app.withTypeProvider<ZodTypeProvider>();
  const { prisma, payments } = services;

  const openOrders = () => prisma.expertOrder.count({ where: { status: { in: OPEN } } });

  /**
   * Om vi tar emot fler uppdrag just nu.
   *
   * Appen frågar innan den visar erbjudandet. Ett tak som bara syns när man
   * redan fyllt i formuläret är ett löfte man bryter för sent.
   */
  server.get(
    '/expert-orders/availability',
    {
      preHandler: app.requireRole('BUSINESS'),
      schema: {
        response: {
          200: z.object({
            available: z.boolean(),
            price: z.number().int(),
            /** Sant om företaget redan har ett uppdrag på gång. */
            hasOpenOrder: z.boolean(),
          }),
        },
      },
    },
    async (request) => {
      const businessId = requireProfileId(request);
      const [open, mine] = await Promise.all([
        openOrders(),
        prisma.expertOrder.count({ where: { businessId, status: { in: OPEN } } }),
      ]);
      return {
        available: hasCapacity(open),
        price: EXPERT_ORDER_PRICE,
        hasOpenOrder: mine > 0,
      };
    },
  );

  /** Beställningen: fyra frågor, varav två obligatoriska. */
  server.post(
    '/expert-orders',
    {
      preHandler: app.requireRole('BUSINESS'),
      schema: {
        body: z.object({
          goal: z.string().min(5).max(1000),
          timing: z.string().min(2).max(300),
          budget: z.string().max(300).default(''),
          notes: z.string().max(1000).default(''),
        }),
        response: { 200: orderSchema, 400: problemSchema, 409: problemSchema },
      },
    },
    async (request) => {
      const businessId = requireProfileId(request);

      const mine = await prisma.expertOrder.findFirst({
        where: { businessId, status: { in: OPEN } },
      });
      if (mine) throw conflict('Ni har redan ett uppdrag på gång hos oss.');

      // Taket kollas här och inte bara i appen: en beställning som slinker
      // förbi blir en kund som väntar på något vi inte hinner göra.
      if (!hasCapacity(await openOrders())) {
        throw conflict(
          `Vi är fullbokade just nu och tar emot ${EXPERT_ORDER_CAPACITY} uppdrag åt gången. Försök igen om några dagar.`,
        );
      }

      const order = await prisma.expertOrder.create({
        data: {
          businessId,
          goal: request.body.goal,
          timing: request.body.timing,
          budget: request.body.budget,
          notes: request.body.notes,
          price: EXPERT_ORDER_PRICE,
        },
      });

      await recordAudit(prisma, {
        userId: request.user.sub,
        action: 'expert_order.requested',
        entityType: 'ExpertOrder',
        entityId: order.id,
        metadata: { businessId },
      });
      return toOrder(order);
    },
  );

  /** Företagets egna uppdrag, senast först. */
  server.get(
    '/expert-orders/mine',
    {
      preHandler: app.requireRole('BUSINESS'),
      schema: { response: { 200: z.array(orderSchema) } },
    },
    async (request) => {
      const orders = await prisma.expertOrder.findMany({
        where: { businessId: requireProfileId(request) },
        orderBy: { requestedAt: 'desc' },
        take: 10,
      });
      return orders.map(toOrder);
    },
  );

  /**
   * Företaget godkänner den levererade kampanjen och betalar.
   *
   * Betalningen ligger här, vid leveransen, och inte vid beställningen. Den
   * som beställt något osett ska kunna ändra sig utan att ha betalat för det.
   */
  server.post(
    '/expert-orders/:id/approve',
    {
      preHandler: app.requireRole('BUSINESS'),
      schema: {
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({ clientSecret: z.string(), amount: z.number().int() }),
          400: problemSchema,
          404: problemSchema,
        },
      },
    },
    async (request) => {
      const businessId = requireProfileId(request);
      const order = await prisma.expertOrder.findUnique({
        where: { id: request.params.id },
        include: { business: true },
      });
      if (!order || order.businessId !== businessId) throw notFound('Uppdraget hittades inte.');
      if (order.status !== 'DELIVERED') throw badRequest('Uppdraget är inte levererat än.');

      let customerId = order.business.stripeCustomerId;
      if (!customerId) {
        customerId = await payments.createCustomer({
          businessId: order.business.id,
          companyName: order.business.companyName,
          orgNumber: order.business.orgNumber,
        });
        await prisma.businessProfile.update({
          where: { id: order.business.id },
          data: { stripeCustomerId: customerId },
        });
      }

      const intent = await payments.createEscrowIntent({
        contractId: `${order.id}:expert`,
        amount: order.price,
        customerId,
        description: 'Kampanj skapad av Pacta',
      });

      await prisma.expertOrder.update({
        where: { id: order.id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          stripePaymentIntentId: intent.paymentIntentId,
        },
      });
      await recordAudit(prisma, {
        userId: request.user.sub,
        action: 'expert_order.approved',
        entityType: 'ExpertOrder',
        entityId: order.id,
        metadata: { price: order.price },
      });
      return { clientSecret: intent.clientSecret, amount: order.price };
    },
  );

  // --- Vår egen sida av disken ---------------------------------------------

  /** Kön, för den som ska göra jobbet. */
  server.get(
    '/admin/expert-orders',
    {
      preHandler: app.requireRole('ADMIN'),
      schema: {
        querystring: z.object({ status: z.enum(EXPERT_ORDER_STATUSES).optional() }),
        response: {
          200: z.array(
            orderSchema.extend({
              businessId: z.string(),
              companyName: z.string(),
              city: z.string(),
            }),
          ),
        },
      },
    },
    async (request) => {
      const orders = await prisma.expertOrder.findMany({
        where: request.query.status ? { status: request.query.status } : {},
        include: { business: { select: { companyName: true, city: true } } },
        orderBy: { requestedAt: 'asc' },
        take: 50,
      });
      return orders.map((order) => ({
        ...toOrder(order),
        businessId: order.businessId,
        companyName: order.business.companyName,
        city: order.business.city,
      }));
    },
  );

  /**
   * Vi tar uppdraget och levererar det.
   *
   * Leveransen pekar ut kampanjen vi byggt i företagets konto. Den ligger kvar
   * som utkast tills företaget godkänner den – vi publicerar aldrig åt dem.
   */
  server.post(
    '/admin/expert-orders/:id',
    {
      preHandler: app.requireRole('ADMIN'),
      schema: {
        params: z.object({ id: z.string() }),
        body: z.object({
          status: z.enum(['IN_PROGRESS', 'DELIVERED', 'CANCELLED']),
          /** Krävs vid leverans: kampanjen företaget ska granska. */
          campaignId: z.string().optional(),
        }),
        response: { 200: orderSchema, 400: problemSchema, 404: problemSchema },
      },
    },
    async (request) => {
      const order = await prisma.expertOrder.findUnique({ where: { id: request.params.id } });
      if (!order) throw notFound('Uppdraget hittades inte.');

      const { status, campaignId } = request.body;
      if (status === 'DELIVERED') {
        if (!campaignId) throw badRequest('Ange kampanjen som ska granskas.');
        const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
        if (!campaign) throw notFound('Kampanjen hittades inte.');
        if (campaign.businessId !== order.businessId) {
          throw badRequest('Kampanjen tillhör ett annat företag.');
        }
      }

      const updated = await prisma.expertOrder.update({
        where: { id: order.id },
        data: {
          status,
          ...(status === 'DELIVERED' ? { campaignId, deliveredAt: new Date() } : {}),
        },
      });
      await recordAudit(prisma, {
        userId: request.user.sub,
        action: `expert_order.${status.toLowerCase()}`,
        entityType: 'ExpertOrder',
        entityId: order.id,
        metadata: { campaignId: campaignId ?? null },
      });
      return toOrder(updated);
    },
  );
}

function toOrder(order: {
  id: string;
  status: string;
  goal: string;
  timing: string;
  budget: string;
  notes: string;
  price: number;
  campaignId: string | null;
  requestedAt: Date;
  deliveredAt: Date | null;
  paymentStatus: string;
}) {
  return {
    id: order.id,
    status: order.status as ExpertOrderStatus,
    goal: order.goal,
    timing: order.timing,
    budget: order.budget,
    notes: order.notes,
    price: order.price,
    campaignId: order.campaignId,
    requestedAt: order.requestedAt.toISOString(),
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    paymentStatus: order.paymentStatus as 'PENDING' | 'ESCROWED' | 'RELEASED' | 'REFUNDED' | 'FAILED',
  };
}
