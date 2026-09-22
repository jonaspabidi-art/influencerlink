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
import { assertBarterAllowed } from '../services/barter.js';
import { aggregateStats } from '../services/social/index.js';

/**
 * Så många profiler räknas igenom för räckvidden.
 *
 * Följarantalet är summan av kreatörens konton och går därför inte att
 * filtrera på i databasen. Ett tak här håller svaret snabbt; en stad med fler
 * kreatörer än så har ändå passerat gränsen där exakta tal spelar roll.
 */
const REACH_SCAN_LIMIT = 500;

/** "RESTAURANG,CAFE" → ['RESTAURANG', 'CAFE']. Tomma värden faller bort. */
function splitList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
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

  /**
   * Hur många kreatörer ett uppdrag skulle nå.
   *
   * Stad och lägsta följarantal avgör om någon över huvud taget ser uppdraget,
   * men ingen av dem säger vad de gör. Den som skriver 5 000 i följarkravet
   * vet inte att hon just gjorde kampanjen osynlig för halva stan. Siffran
   * finns därför medan man fyller i, inte som ett besked efteråt.
   *
   * Räknas på samma villkor som matchningen använder: ort, nisch, plattform
   * och summerade följare.
   */
  server.get(
    '/campaigns/reach',
    {
      preHandler: app.requireRole('BUSINESS'),
      schema: {
        querystring: z.object({
          city: z.string().max(80).optional(),
          /** Kommaseparerade, samma namn som i kampanjen. */
          categories: z.string().max(400).optional(),
          platforms: z.string().max(100).optional(),
          minFollowers: z.coerce.number().int().min(0).max(10_000_000).default(0),
        }),
        response: {
          200: z.object({
            /** Kreatörer som uppfyller allt. */
            matching: z.number().int(),
            /** Kreatörer i staden, oavsett nisch och följarkrav. */
            inCity: z.number().int(),
            /** Hur många fler som skulle nås utan följarkravet. */
            blockedByFollowers: z.number().int(),
          }),
        },
      },
    },
    async (request) => {
      const { city, minFollowers } = request.query;
      const categories = splitList(request.query.categories) as Category[];
      const platforms = splitList(request.query.platforms) as Platform[];

      const candidates = await prisma.influencerProfile.findMany({
        where: {
          user: { onboardingComplete: true },
          socialAccounts: { some: {} },
          ...(city ? { city: { equals: city, mode: 'insensitive' } } : {}),
        },
        select: {
          categories: true,
          socialAccounts: { select: { platform: true, followers: true, avgViews: true, engagementRate: true } },
        },
        take: REACH_SCAN_LIMIT,
      });

      let matching = 0;
      let blockedByFollowers = 0;
      for (const candidate of candidates) {
        const fitsCategory =
          categories.length === 0 || categories.some((item) => candidate.categories.includes(item));
        const fitsPlatform =
          platforms.length === 0 ||
          candidate.socialAccounts.some((account) => platforms.includes(account.platform));
        if (!fitsCategory || !fitsPlatform) continue;

        const followers = aggregateStats(candidate.socialAccounts).followers;
        if (followers >= minFollowers) matching += 1;
        else blockedByFollowers += 1;
      }

      return { matching, inCity: candidates.length, blockedByFollowers };
    },
  );

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
      const businessId = requireProfileId(request);
      const campaign = await loadOwnCampaign(services, request.params.id, businessId);
      if (campaign.endDate.getTime() < Date.now()) {
        throw badRequest('Slutdatumet har redan passerat. Uppdatera datumen först.');
      }
      /*
       * Ett uppdrag mot enbart mat kräver abonnemang.
       *
       * Spärren sitter vid publicering och inte vid utkastet, så att den som
       * vill titta på hur det ser ut får göra det. Får man nej först efter
       * att ha skrivit färdigt är det ett sämre besked, men det är ärligare
       * än att låta uppdraget ligga ute och aldrig gå att slutföra.
       */
      if (campaign.compensationType === 'PRODUCT') {
        await assertBarterAllowed(prisma, businessId);
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
