import {
  campaignInputSchema,
  campaignStatusSchema,
  contractStatusSchema,
  emptyRatingSummary,
  problemSchema,
  ratingSummarySchema,
  splitFee,
} from '@pacta/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { recordAudit } from '../lib/audit.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { aggregateStats } from '../services/social/index.js';
import { ratingsFor } from '../services/reviews.js';
import type { Services } from '../services/index.js';

/**
 * Plattformsvyn.
 *
 * Den som driver Pacta behöver se helheten: vem som samarbetar med vem, vad
 * som är signerat och var pengarna står. Två saker lämnas medvetet utanför,
 * och det är inte av försiktighet utan för att de är farliga att kunna se:
 *
 *  - Kreatörernas åtkomstnycklar till TikTok. De ligger krypterade och lämnar
 *    aldrig servern. Kunde en admin läsa dem vore ett kapat adminkonto liktydigt
 *    med ett intrång hos varje kreatör på plattformen.
 *  - Personnummer. De lagras bara som hash och maskerad sträng, så de går inte
 *    att visa ens om vi ville.
 *
 * Chatten mellan parterna är också utelämnad. Den kan läggas till, men först
 * när integritetspolicyn säger att vi kan läsa den – annars lovar vi en sak och
 * gör en annan.
 *
 * Varje åtgärd som ändrar något bokförs i AuditEvent. Det är det som gör full
 * insyn försvarbar: den går att granska i efterhand.
 */
/** Avtalslägen som håller en plats i kampanjen upptagen. */
const OCCUPYING = new Set([
  'DRAFT',
  'SENT',
  'PARTIALLY_SIGNED',
  'ACTIVE',
  'DELIVERED',
  'COMPLETED',
]);

export async function adminRoutes(app: FastifyInstance, services: Services): Promise<void> {
  const server = app.withTypeProvider<ZodTypeProvider>();
  const { prisma } = services;

  /** Läget på plattformen, i siffror. */
  server.get(
    '/admin/overview',
    {
      preHandler: app.requireRole('ADMIN'),
      schema: {
        response: {
          200: z.object({
            businesses: z.number().int(),
            influencers: z.number().int(),
            activeCampaigns: z.number().int(),
            openContracts: z.number().int(),
            /** Summan av alla arvoden i signerade avtal, i öre. */
            signedVolume: z.number().int(),
            /** Vad plattformen tjänat på dem. */
            platformRevenue: z.number().int(),
            escrowHeld: z.number().int(),
            openExpertOrders: z.number().int(),
          }),
        },
      },
    },
    async () => {
      const [businesses, influencers, activeCampaigns, contracts, escrow, openExpertOrders] =
        await Promise.all([
          prisma.businessProfile.count(),
          prisma.influencerProfile.count(),
          prisma.campaign.count({ where: { status: 'ACTIVE' } }),
          prisma.contract.findMany({
            where: { status: { in: ['ACTIVE', 'DELIVERED', 'COMPLETED'] } },
            select: { fee: true, businessFeeBps: true, creatorFeeBps: true, status: true },
          }),
          prisma.payment.aggregate({
            where: { status: 'ESCROWED' },
            _sum: { amount: true },
          }),
          prisma.expertOrder.count({ where: { status: { in: ['REQUESTED', 'IN_PROGRESS'] } } }),
        ]);

      let signedVolume = 0;
      let platformRevenue = 0;
      for (const contract of contracts) {
        const money = splitFee(contract.fee, {
          businessFeeBps: contract.businessFeeBps,
          creatorFeeBps: contract.creatorFeeBps,
        });
        signedVolume += money.fee;
        platformRevenue += money.platformFee;
      }

      return {
        businesses,
        influencers,
        activeCampaigns,
        openContracts: contracts.filter((item) => item.status !== 'COMPLETED').length,
        signedVolume,
        platformRevenue,
        escrowHeld: escrow._sum.amount ?? 0,
        openExpertOrders,
      };
    },
  );

  // --- Företag --------------------------------------------------------------

  const businessRow = z.object({
    id: z.string(),
    companyName: z.string(),
    orgNumber: z.string(),
    city: z.string(),
    campaigns: z.number().int(),
    contracts: z.number().int(),
  });

  server.get(
    '/admin/businesses',
    {
      preHandler: app.requireRole('ADMIN'),
      schema: {
        querystring: z.object({ q: z.string().max(80).optional() }),
        response: { 200: z.array(businessRow) },
      },
    },
    async (request) => {
      const businesses = await prisma.businessProfile.findMany({
        where: request.query.q
          ? {
              OR: [
                { companyName: { contains: request.query.q, mode: 'insensitive' } },
                { orgNumber: { contains: request.query.q } },
                { city: { contains: request.query.q, mode: 'insensitive' } },
              ],
            }
          : {},
        include: {
          _count: { select: { campaigns: true } },
          campaigns: { select: { _count: { select: { contracts: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return businesses.map((business) => ({
        id: business.id,
        companyName: business.companyName,
        orgNumber: business.orgNumber,
        city: business.city,
        campaigns: business._count.campaigns,
        contracts: business.campaigns.reduce((sum, item) => sum + item._count.contracts, 0),
      }));
    },
  );

  server.get(
    '/admin/businesses/:id',
    {
      preHandler: app.requireRole('ADMIN'),
      schema: {
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({
            id: z.string(),
            companyName: z.string(),
            orgNumber: z.string(),
            city: z.string(),
            address: z.string(),
            description: z.string(),
            websiteUrl: z.string().nullable(),
            contactName: z.string(),
            createdAt: z.string(),
            campaigns: z.array(
              z.object({
                id: z.string(),
                title: z.string(),
                status: campaignStatusSchema,
                slots: z.number().int(),
                slotsFilled: z.number().int(),
                budgetPerCreator: z.number().int(),
                contracts: z.number().int(),
              }),
            ),
          }),
          404: problemSchema,
        },
      },
    },
    async (request) => {
      const business = await prisma.businessProfile.findUnique({
        where: { id: request.params.id },
        include: {
          user: { select: { name: true } },
          campaigns: {
            orderBy: { createdAt: 'desc' },
            include: {
              _count: { select: { contracts: true } },
              contracts: { select: { status: true } },
            },
          },
        },
      });
      if (!business) throw notFound('Företaget hittades inte.');

      return {
        id: business.id,
        companyName: business.companyName,
        orgNumber: business.orgNumber,
        city: business.city,
        address: business.address,
        description: business.description,
        websiteUrl: business.websiteUrl,
        contactName: business.user.name,
        createdAt: business.createdAt.toISOString(),
        campaigns: business.campaigns.map((campaign) => ({
          id: campaign.id,
          title: campaign.title,
          status: campaign.status,
          slots: campaign.slots,
          // Platserna räknas ur avtalen, precis som i företagets egen vy.
          slotsFilled: campaign.contracts.filter((contract) =>
            OCCUPYING.has(contract.status),
          ).length,
          budgetPerCreator: campaign.budgetPerCreator,
          contracts: campaign._count.contracts,
        })),
      };
    },
  );

  // --- Kreatörer ------------------------------------------------------------

  server.get(
    '/admin/influencers',
    {
      preHandler: app.requireRole('ADMIN'),
      schema: {
        querystring: z.object({ q: z.string().max(80).optional() }),
        response: {
          200: z.array(
            z.object({
              id: z.string(),
              displayName: z.string(),
              city: z.string(),
              followers: z.number().int(),
              /** Om siffrorna kommer från plattformen eller är påhittade. */
              statsVerified: z.boolean(),
              payoutsReady: z.boolean(),
              contracts: z.number().int(),
            }),
          ),
        },
      },
    },
    async (request) => {
      const profiles = await prisma.influencerProfile.findMany({
        where: request.query.q
          ? {
              OR: [
                { displayName: { contains: request.query.q, mode: 'insensitive' } },
                { city: { contains: request.query.q, mode: 'insensitive' } },
              ],
            }
          : {},
        include: {
          socialAccounts: true,
          _count: { select: { contracts: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return profiles.map((profile) => ({
        id: profile.id,
        displayName: profile.displayName,
        city: profile.city,
        followers: aggregateStats(profile.socialAccounts).followers,
        statsVerified: profile.socialAccounts.some((item) => item.statsSource === 'PLATFORM'),
        payoutsReady: Boolean(profile.stripeAccountId),
        contracts: profile._count.contracts,
      }));
    },
  );

  server.get(
    '/admin/influencers/:id',
    {
      preHandler: app.requireRole('ADMIN'),
      schema: {
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({
            id: z.string(),
            displayName: z.string(),
            bio: z.string(),
            city: z.string(),
            contactName: z.string(),
            /** Maskerat. Hela numret finns bara som hash och går inte att visa. */
            personalNumberMask: z.string().nullable(),
            priceMin: z.number().int(),
            priceTarget: z.number().int(),
            payoutsReady: z.boolean(),
            createdAt: z.string(),
            rating: ratingSummarySchema,
            socials: z.array(
              z.object({
                platform: z.string(),
                handle: z.string(),
                followers: z.number().int(),
                avgViews: z.number().int(),
                statsSource: z.string(),
                /** Sant om kontot är kopplat med inloggning. Nyckeln visas aldrig. */
                connected: z.boolean(),
              }),
            ),
            contracts: z.array(
              z.object({
                id: z.string(),
                campaignTitle: z.string(),
                businessName: z.string(),
                status: contractStatusSchema,
                fee: z.number().int(),
                payout: z.number().int(),
              }),
            ),
          }),
          404: problemSchema,
        },
      },
    },
    async (request) => {
      const profile = await prisma.influencerProfile.findUnique({
        where: { id: request.params.id },
        include: {
          user: { select: { name: true, personalNumberMask: true } },
          socialAccounts: true,
          contracts: {
            orderBy: { createdAt: 'desc' },
            include: {
              campaign: { select: { title: true, business: { select: { companyName: true } } } },
            },
          },
        },
      });
      if (!profile) throw notFound('Kreatören hittades inte.');

      const ratings = await ratingsFor(prisma, 'INFLUENCER', [profile.id]);

      return {
        id: profile.id,
        displayName: profile.displayName,
        bio: profile.bio,
        city: profile.city,
        contactName: profile.user.name,
        personalNumberMask: profile.user.personalNumberMask,
        priceMin: profile.priceMin,
        priceTarget: profile.priceTarget,
        payoutsReady: Boolean(profile.stripeAccountId),
        createdAt: profile.createdAt.toISOString(),
        rating: ratings.get(profile.id) ?? emptyRatingSummary(),
        socials: profile.socialAccounts.map((account) => ({
          platform: account.platform,
          handle: account.handle,
          followers: account.followers,
          avgViews: account.avgViews,
          statsSource: account.statsSource,
          connected: account.accessTokenEnc !== null,
        })),
        contracts: profile.contracts.map((contract) => ({
          id: contract.id,
          campaignTitle: contract.campaign.title,
          businessName: contract.campaign.business.companyName,
          status: contract.status,
          fee: contract.fee,
          payout: splitFee(contract.fee, {
            businessFeeBps: contract.businessFeeBps,
            creatorFeeBps: contract.creatorFeeBps,
          }).net,
        })),
      };
    },
  );

  // --- Avtal ----------------------------------------------------------------

  server.get(
    '/admin/contracts',
    {
      preHandler: app.requireRole('ADMIN'),
      schema: {
        querystring: z.object({ status: contractStatusSchema.optional() }),
        response: {
          200: z.array(
            z.object({
              id: z.string(),
              campaignTitle: z.string(),
              businessName: z.string(),
              influencerName: z.string(),
              status: contractStatusSchema,
              fee: z.number().int(),
              paymentStatus: z.string().nullable(),
              createdAt: z.string(),
            }),
          ),
        },
      },
    },
    async (request) => {
      const contracts = await prisma.contract.findMany({
        where: request.query.status ? { status: request.query.status } : {},
        include: {
          campaign: { select: { title: true, business: { select: { companyName: true } } } },
          influencer: { select: { displayName: true } },
          payment: { select: { status: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return contracts.map((contract) => ({
        id: contract.id,
        campaignTitle: contract.campaign.title,
        businessName: contract.campaign.business.companyName,
        influencerName: contract.influencer.displayName,
        status: contract.status,
        fee: contract.fee,
        paymentStatus: contract.payment?.status ?? null,
        createdAt: contract.createdAt.toISOString(),
      }));
    },
  );

  /** Hela avtalet: text, signaturer, pengar, leverans och tillägg. */
  server.get(
    '/admin/contracts/:id',
    {
      preHandler: app.requireRole('ADMIN'),
      schema: {
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({
            id: z.string(),
            campaignId: z.string(),
            campaignTitle: z.string(),
            businessId: z.string(),
            businessName: z.string(),
            influencerId: z.string(),
            influencerName: z.string(),
            status: contractStatusSchema,
            fee: z.number().int(),
            charge: z.number().int(),
            platformFee: z.number().int(),
            payout: z.number().int(),
            dueDate: z.string(),
            terms: z.string(),
            signedByBusinessAt: z.string().nullable(),
            signedByInfluencerAt: z.string().nullable(),
            deliveredAt: z.string().nullable(),
            completedAt: z.string().nullable(),
            deliveryUrls: z.array(z.string()),
            payment: z
              .object({
                status: z.string(),
                amount: z.number().int(),
                payout: z.number().int(),
                escrowedAt: z.string().nullable(),
                releasedAt: z.string().nullable(),
              })
              .nullable(),
            usageRights: z
              .object({
                status: z.string(),
                amount: z.number().int(),
                creatorShare: z.number().int(),
                paymentStatus: z.string(),
              })
              .nullable(),
            views: z.number().int(),
          }),
          404: problemSchema,
        },
      },
    },
    async (request) => {
      const contract = await prisma.contract.findUnique({
        where: { id: request.params.id },
        include: {
          campaign: {
            select: {
              title: true,
              businessId: true,
              business: { select: { companyName: true } },
            },
          },
          influencer: { select: { displayName: true } },
          payment: true,
          delivery: { select: { urls: true } },
          usageRights: true,
          metrics: { select: { views: true } },
        },
      });
      if (!contract) throw notFound('Avtalet hittades inte.');

      const money = splitFee(contract.fee, {
        businessFeeBps: contract.businessFeeBps,
        creatorFeeBps: contract.creatorFeeBps,
      });

      return {
        id: contract.id,
        campaignId: contract.campaignId,
        campaignTitle: contract.campaign.title,
        businessId: contract.campaign.businessId,
        businessName: contract.campaign.business.companyName,
        influencerId: contract.influencerId,
        influencerName: contract.influencer.displayName,
        status: contract.status,
        fee: money.fee,
        charge: money.charge,
        platformFee: money.platformFee,
        payout: money.net,
        dueDate: contract.dueDate.toISOString(),
        terms: contract.terms,
        signedByBusinessAt: contract.signedByBusinessAt?.toISOString() ?? null,
        signedByInfluencerAt: contract.signedByInfluencerAt?.toISOString() ?? null,
        deliveredAt: contract.deliveredAt?.toISOString() ?? null,
        completedAt: contract.completedAt?.toISOString() ?? null,
        deliveryUrls: contract.delivery?.urls ?? [],
        payment: contract.payment
          ? {
              status: contract.payment.status,
              amount: contract.payment.amount,
              payout: contract.payment.payout,
              escrowedAt: contract.payment.escrowedAt?.toISOString() ?? null,
              releasedAt: contract.payment.releasedAt?.toISOString() ?? null,
            }
          : null,
        usageRights: contract.usageRights
          ? {
              status: contract.usageRights.status,
              amount: contract.usageRights.amount,
              creatorShare: contract.usageRights.creatorShare,
              paymentStatus: contract.usageRights.paymentStatus,
            }
          : null,
        views: contract.metrics.reduce((sum, metric) => sum + metric.views, 0),
      };
    },
  );

  // --- Kampanjer åt företagen ----------------------------------------------

  /**
   * Skapar en kampanj i företagets namn.
   *
   * Den läggs alltid som utkast. Att publicera är företagets beslut – det är
   * de som binder sig ekonomiskt, inte vi.
   */
  server.post(
    '/admin/campaigns',
    {
      preHandler: app.requireRole('ADMIN'),
      schema: {
        body: z.object({ businessId: z.string(), campaign: campaignInputSchema }),
        response: {
          200: z.object({ id: z.string(), status: campaignStatusSchema }),
          400: problemSchema,
          404: problemSchema,
        },
      },
    },
    async (request) => {
      const business = await prisma.businessProfile.findUnique({
        where: { id: request.body.businessId },
      });
      if (!business) throw notFound('Företaget hittades inte.');

      const input = request.body.campaign;
      const campaign = await prisma.campaign.create({
        data: {
          businessId: business.id,
          ...input,
          imageUrl: input.imageUrl ?? null,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          status: 'DRAFT',
        },
      });

      await recordAudit(prisma, {
        userId: request.user.sub,
        action: 'admin.campaign_created',
        entityType: 'Campaign',
        entityId: campaign.id,
        metadata: { businessId: business.id },
      });
      return { id: campaign.id, status: campaign.status };
    },
  );

  server.patch(
    '/admin/campaigns/:id',
    {
      preHandler: app.requireRole('ADMIN'),
      schema: {
        params: z.object({ id: z.string() }),
        body: z.object({
          campaign: campaignInputSchema.optional(),
          status: campaignStatusSchema.optional(),
        }),
        response: {
          200: z.object({ id: z.string(), status: campaignStatusSchema }),
          400: problemSchema,
          404: problemSchema,
        },
      },
    },
    async (request) => {
      const existing = await prisma.campaign.findUnique({ where: { id: request.params.id } });
      if (!existing) throw notFound('Kampanjen hittades inte.');

      const input = request.body.campaign;
      const campaign = await prisma.campaign.update({
        where: { id: existing.id },
        data: {
          ...(input
            ? {
                ...input,
                imageUrl: input.imageUrl ?? null,
                startDate: new Date(input.startDate),
                endDate: new Date(input.endDate),
              }
            : {}),
          ...(request.body.status ? { status: request.body.status } : {}),
        },
      });

      await recordAudit(prisma, {
        userId: request.user.sub,
        action: 'admin.campaign_updated',
        entityType: 'Campaign',
        entityId: campaign.id,
        metadata: { status: campaign.status },
      });
      return { id: campaign.id, status: campaign.status };
    },
  );

  /**
   * Tar bort en kampanj.
   *
   * Bara om den aldrig lett till ett avtal. Ett signerat avtal är ett åtagande
   * mellan två parter och kan ha pengar spärrade – att radera kampanjen under
   * det hade tagit med sig avtalet, betalningen och omdömena i fallet. En
   * kampanj som hunnit så långt stängs i stället.
   */
  server.delete(
    '/admin/campaigns/:id',
    {
      preHandler: app.requireRole('ADMIN'),
      schema: {
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({ deleted: z.boolean() }),
          409: problemSchema,
          404: problemSchema,
        },
      },
    },
    async (request) => {
      const campaign = await prisma.campaign.findUnique({
        where: { id: request.params.id },
        include: {
          contracts: { where: { status: { not: 'CANCELLED' } }, select: { id: true } },
        },
      });
      if (!campaign) throw notFound('Kampanjen hittades inte.');
      if (campaign.contracts.length > 0) {
        throw conflict(
          `Kampanjen har ${campaign.contracts.length} avtal och går inte att radera. Stäng den i stället.`,
        );
      }

      await prisma.campaign.delete({ where: { id: campaign.id } });
      await recordAudit(prisma, {
        userId: request.user.sub,
        action: 'admin.campaign_deleted',
        entityType: 'Campaign',
        entityId: campaign.id,
        metadata: { businessId: campaign.businessId, title: campaign.title },
      });
      return { deleted: true };
    },
  );

  /** Spåret över vad vi själva gjort. Full insyn kräver att den går att granska. */
  server.get(
    '/admin/audit',
    {
      preHandler: app.requireRole('ADMIN'),
      schema: {
        querystring: z.object({ entityId: z.string().optional() }),
        response: {
          200: z.array(
            z.object({
              id: z.string(),
              action: z.string(),
              entityType: z.string(),
              entityId: z.string(),
              userId: z.string().nullable(),
              createdAt: z.string(),
            }),
          ),
        },
      },
    },
    async (request) => {
      const events = await prisma.auditEvent.findMany({
        where: request.query.entityId ? { entityId: request.query.entityId } : {},
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return events.map((event) => ({
        id: event.id,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        userId: event.userId,
        createdAt: event.createdAt.toISOString(),
      }));
    },
  );
}
