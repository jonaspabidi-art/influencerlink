import type { Category, DeliverableKind, Platform } from '@pacta/shared';
import {
  campaignDraftRequestSchema,
  campaignInputSchema,
  campaignStatusSchema,
  categorySchema,
  compensationTypeSchema,
  deliverableKindSchema,
  platformSchema,
  problemSchema,
} from '@pacta/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { recordAudit } from '../lib/audit.js';
import { requireProfileId } from '../plugins/auth.js';
import type { Services } from '../services/index.js';

export const publicCampaignSchema = z.object({
  id: z.string(),
  businessId: z.string(),
  businessName: z.string(),
  businessLogoUrl: z.string().nullable(),
  imageUrl: z.string().nullable(),
  title: z.string(),
  brief: z.string(),
  categories: z.array(categorySchema),
  platforms: z.array(platformSchema),
  deliverables: z.array(deliverableKindSchema),
  compensationType: compensationTypeSchema,
  budgetPerCreator: z.number().int(),
  productValue: z.number().int(),
  slots: z.number().int(),
  slotsFilled: z.number().int(),
  city: z.string(),
  minFollowers: z.number().int(),
  startDate: z.string(),
  endDate: z.string(),
  status: campaignStatusSchema,
});

export async function campaignRoutes(app: FastifyInstance, services: Services): Promise<void> {
  const server = app.withTypeProvider<ZodTypeProvider>();
  const { prisma, ai } = services;

  server.post(
    '/campaigns',
    {
      preHandler: app.requireRole('BUSINESS'),
      schema: {
        body: campaignInputSchema,
        response: { 200: publicCampaignSchema, 400: problemSchema },
      },
    },
    async (request) => {
      const businessId = requireProfileId(request);
      const campaign = await prisma.campaign.create({
        data: { businessId, ...toCampaignData(request.body) },
        include: { business: true, contracts: { select: { status: true } } },
      });
      await recordAudit(prisma, {
        userId: request.user.sub,
        action: 'campaign.created',
        entityType: 'Campaign',
        entityId: campaign.id,
      });
      return toPublicCampaign(campaign);
    },
  );

  server.get(
    '/campaigns/mine',
    {
      preHandler: app.requireRole('BUSINESS'),
      schema: {
        querystring: z.object({ status: campaignStatusSchema.optional() }),
        response: { 200: z.array(publicCampaignSchema) },
      },
    },
    async (request) => {
      const businessId = requireProfileId(request);
      const campaigns = await prisma.campaign.findMany({
        where: { businessId, ...(request.query.status ? { status: request.query.status } : {}) },
        include: { business: true, contracts: { select: { status: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return campaigns.map(toPublicCampaign);
    },
  );

  server.get(
    '/campaigns/:id',
    {
      preHandler: app.authenticate,
      schema: {
        params: z.object({ id: z.string() }),
        response: { 200: publicCampaignSchema, 404: problemSchema },
      },
    },
    async (request) => {
      const campaign = await prisma.campaign.findUnique({
        where: { id: request.params.id },
        include: { business: true, contracts: { select: { status: true } } },
      });
      if (!campaign) throw notFound('Kampanjen hittades inte.');
      // Utkast är bara synliga för den som äger dem.
      if (campaign.status === 'DRAFT' && campaign.business.userId !== request.user.sub) {
        throw notFound('Kampanjen hittades inte.');
      }
      return toPublicCampaign(campaign);
    },
  );

  server.patch(
    '/campaigns/:id',
    {
      preHandler: app.requireRole('BUSINESS'),
      schema: {
        params: z.object({ id: z.string() }),
        body: campaignInputSchema,
        response: { 200: publicCampaignSchema, 403: problemSchema, 404: problemSchema },
      },
    },
    async (request) => {
      const campaign = await loadOwnCampaign(services, request.params.id, requireProfileId(request));
      if (campaign.status === 'CLOSED') {
        throw forbidden('En avslutad kampanj går inte att ändra.');
      }
      const updated = await prisma.campaign.update({
        where: { id: campaign.id },
        data: toCampaignData(request.body),
        include: { business: true, contracts: { select: { status: true } } },
      });
      return toPublicCampaign(updated);
    },
  );

  server.post(
    '/campaigns/:id/publish',
    {
      preHandler: app.requireRole('BUSINESS'),
      schema: {
        params: z.object({ id: z.string() }),
        response: { 200: publicCampaignSchema, 400: problemSchema },
      },
    },
    async (request) => {
      const campaign = await loadOwnCampaign(services, request.params.id, requireProfileId(request));
      if (campaign.endDate.getTime() < Date.now()) {
        throw badRequest('Slutdatumet har redan passerat. Uppdatera datumen först.');
      }
      const updated = await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'ACTIVE' },
        include: { business: true, contracts: { select: { status: true } } },
      });
      await recordAudit(prisma, {
        userId: request.user.sub,
        action: 'campaign.published',
        entityType: 'Campaign',
        entityId: campaign.id,
      });
      return toPublicCampaign(updated);
    },
  );

  server.post(
    '/campaigns/:id/status',
    {
      preHandler: app.requireRole('BUSINESS'),
      schema: {
        params: z.object({ id: z.string() }),
        body: z.object({ status: z.enum(['ACTIVE', 'PAUSED', 'CLOSED']) }),
        response: { 200: publicCampaignSchema },
      },
    },
    async (request) => {
      const campaign = await loadOwnCampaign(services, request.params.id, requireProfileId(request));
      const updated = await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: request.body.status },
        include: { business: true, contracts: { select: { status: true } } },
      });
      return toPublicCampaign(updated);
    },
  );

  /**
   * Restaurangägaren skriver några rader fritext och får tillbaka ett komplett
   * utkast. Detta är kärnan i "enkelt att komma igång" – inget tomt formulär.
   */
  server.post(
    '/campaigns/draft',
    {
      preHandler: app.requireRole('BUSINESS'),
      config: { rateLimit: { max: 20, timeWindow: '5 minutes' } },
      schema: {
        body: campaignDraftRequestSchema,
        response: {
          200: z.object({
            available: z.boolean(),
            draft: z
              .object({
                title: z.string(),
                brief: z.string(),
                categories: z.array(categorySchema),
                platforms: z.array(platformSchema),
                deliverables: z.array(deliverableKindSchema),
                compensationType: compensationTypeSchema,
                budgetPerCreator: z.number().int(),
                productValue: z.number().int(),
                slots: z.number().int(),
                minFollowers: z.number().int(),
                rationale: z.string(),
              })
              .nullable(),
          }),
        },
      },
    },
    async (request) => {
      const businessId = requireProfileId(request);
      const business = await prisma.businessProfile.findUniqueOrThrow({ where: { id: businessId } });
      const draft = await ai.draftCampaign(request.body.prompt, request.body.city ?? business.city);
      return { available: draft !== undefined, draft: draft ?? null };
    },
  );
}

async function loadOwnCampaign(services: Services, campaignId: string, businessId: string) {
  const campaign = await services.prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw notFound('Kampanjen hittades inte.');
  if (campaign.businessId !== businessId) throw forbidden('Kampanjen tillhör ett annat konto.');
  return campaign;
}

function toCampaignData(body: {
  title: string;
  brief: string;
  categories: Category[];
  platforms: Platform[];
  deliverables: DeliverableKind[];
  compensationType: 'FIXED' | 'PRODUCT' | 'HYBRID';
  budgetPerCreator: number;
  productValue: number;
  slots: number;
  city: string;
  minFollowers: number;
  imageUrl?: string | null;
  startDate: string;
  endDate: string;
}) {
  return {
    title: body.title,
    brief: body.brief,
    categories: body.categories,
    platforms: body.platforms,
    deliverables: body.deliverables,
    compensationType: body.compensationType,
    budgetPerCreator: body.budgetPerCreator,
    productValue: body.productValue,
    slots: body.slots,
    imageUrl: body.imageUrl ?? null,
    city: body.city,
    minFollowers: body.minFollowers,
    startDate: new Date(body.startDate),
    endDate: new Date(body.endDate),
  };
}

/** Platser som räknas som tagna: alla kontrakt som inte avbrutits. */
const OCCUPYING_CONTRACT_STATUSES = new Set([
  'DRAFT',
  'SENT',
  'PARTIALLY_SIGNED',
  'ACTIVE',
  'DELIVERED',
  'COMPLETED',
]);

export function toPublicCampaign(campaign: {
  id: string;
  businessId: string;
  business: { companyName: string; logoUrl: string | null };
  imageUrl: string | null;
  title: string;
  brief: string;
  categories: Category[];
  platforms: Platform[];
  deliverables: DeliverableKind[];
  compensationType: 'FIXED' | 'PRODUCT' | 'HYBRID';
  budgetPerCreator: number;
  productValue: number;
  slots: number;
  city: string;
  minFollowers: number;
  startDate: Date;
  endDate: Date;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'CLOSED';
  contracts?: Array<{ status: string }>;
}) {
  return {
    id: campaign.id,
    businessId: campaign.businessId,
    businessName: campaign.business.companyName,
    businessLogoUrl: campaign.business.logoUrl,
    imageUrl: campaign.imageUrl,
    title: campaign.title,
    brief: campaign.brief,
    categories: campaign.categories,
    platforms: campaign.platforms,
    deliverables: campaign.deliverables,
    compensationType: campaign.compensationType,
    budgetPerCreator: campaign.budgetPerCreator,
    productValue: campaign.productValue,
    slots: campaign.slots,
    slotsFilled: (campaign.contracts ?? []).filter((contract) =>
      OCCUPYING_CONTRACT_STATUSES.has(contract.status),
    ).length,
    city: campaign.city,
    minFollowers: campaign.minFollowers,
    startDate: campaign.startDate.toISOString(),
    endDate: campaign.endDate.toISOString(),
    status: campaign.status,
  };
}
