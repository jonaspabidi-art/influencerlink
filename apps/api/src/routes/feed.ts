import { emptyRatingSummary, problemSchema, ratingSummarySchema } from '@pacta/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { forbidden, notFound } from '../lib/errors.js';
import { requireProfileId } from '../plugins/auth.js';
import type { Services } from '../services/index.js';
import {
  findCampaignCandidates,
  findInfluencerCandidates,
  toCampaignCandidate,
  toInfluencerCandidate,
} from '../services/feed.js';
import { ratingsFor } from '../services/reviews.js';
import { publicCampaignSchema, toPublicCampaign } from './campaigns.js';

/** Kort i swipe-decken: kortet plus varför det visas. */
const scoredSchema = z.object({
  score: z.number(),
  reason: z.string(),
  aiReviewed: z.boolean(),
  /** Motpartens betyg. count 0 betyder att ingen hunnit lämna omdöme än. */
  rating: ratingSummarySchema,
});

const influencerCardSchema = scoredSchema.extend({
  influencer: z.object({
    id: z.string(),
    displayName: z.string(),
    bio: z.string(),
    city: z.string(),
    avatarUrl: z.string().nullable(),
    categories: z.array(z.string()),
    platforms: z.array(z.string()),
    followers: z.number().int(),
    avgViews: z.number().int(),
    engagementRate: z.number(),
    priceTarget: z.number().int(),
  }),
});

const campaignCardSchema = scoredSchema.extend({ campaign: publicCampaignSchema });

export async function feedRoutes(app: FastifyInstance, services: Services): Promise<void> {
  const server = app.withTypeProvider<ZodTypeProvider>();
  const { prisma, ai } = services;

  /** Influencerns deck: kampanjer att swipa på. */
  server.get(
    '/feed/campaigns',
    {
      preHandler: app.requireRole('INFLUENCER'),
      schema: {
        querystring: z.object({ limit: z.coerce.number().int().min(1).max(30).default(20) }),
        response: { 200: z.array(campaignCardSchema), 403: problemSchema },
      },
    },
    async (request) => {
      const influencerId = requireProfileId(request);
      const profile = await prisma.influencerProfile.findUniqueOrThrow({
        where: { id: influencerId },
        include: { socialAccounts: true },
      });
      const candidate = toInfluencerCandidate(profile);
      if (candidate.platforms.length === 0) {
        throw forbidden('Koppla minst ett socialt konto innan du börjar swipa.');
      }

      const candidates = await findCampaignCandidates(prisma, candidate);
      if (candidates.length === 0) return [];

      const ranked = await ai.rankCampaignsForInfluencer(candidate, candidates);
      const ids = ranked.slice(0, request.query.limit).map((entry) => entry.campaign.id);
      const campaigns = await prisma.campaign.findMany({
        where: { id: { in: ids } },
        include: { business: true, contracts: { select: { status: true } } },
      });
      const byId = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
      const ratings = await ratingsFor(
        prisma,
        'BUSINESS',
        campaigns.map((campaign) => campaign.businessId),
      );

      return ranked
        .slice(0, request.query.limit)
        .flatMap((entry) => {
          const campaign = byId.get(entry.campaign.id);
          if (!campaign) return [];
          return [
            {
              score: entry.finalScore,
              reason: entry.reason,
              aiReviewed: entry.aiReviewed,
              rating: ratings.get(campaign.businessId) ?? emptyRatingSummary(),
              campaign: toPublicCampaign(campaign),
            },
          ];
        });
    },
  );

  /**
   * Kampanjer influencern svajpat höger på men där restaurangen inte svarat
   * ännu. Driver det tomma läget i decken: "du är i kö på tre kampanjer".
   */
  server.get(
    '/feed/pending',
    {
      preHandler: app.requireRole('INFLUENCER'),
      schema: {
        response: {
          200: z.array(
            z.object({
              campaignId: z.string(),
              title: z.string(),
              businessName: z.string(),
              businessLogoUrl: z.string().nullable(),
              budgetPerCreator: z.number().int(),
              likedAt: z.string(),
            }),
          ),
        },
      },
    },
    async (request) => {
      const influencerId = requireProfileId(request);
      const swipes = await prisma.swipe.findMany({
        where: {
          influencerId,
          actor: 'INFLUENCER',
          direction: 'LIKE',
          // Har en matchning uppstått är kampanjen inte längre "i kö".
          campaign: { matches: { none: { influencerId } }, status: 'ACTIVE' },
        },
        include: { campaign: { include: { business: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      return swipes.map((swipe) => ({
        campaignId: swipe.campaignId,
        title: swipe.campaign.title,
        businessName: swipe.campaign.business.companyName,
        businessLogoUrl: swipe.campaign.business.logoUrl,
        budgetPerCreator: swipe.campaign.budgetPerCreator,
        likedAt: swipe.createdAt.toISOString(),
      }));
    },
  );

  /** Restaurangens deck: influencers att swipa på för en viss kampanj. */
  server.get(
    '/feed/influencers',
    {
      preHandler: app.requireRole('BUSINESS'),
      schema: {
        querystring: z.object({
          campaignId: z.string().min(1),
          limit: z.coerce.number().int().min(1).max(30).default(20),
        }),
        response: { 200: z.array(influencerCardSchema), 404: problemSchema },
      },
    },
    async (request) => {
      const businessId = requireProfileId(request);
      const campaign = await prisma.campaign.findUnique({
        where: { id: request.query.campaignId },
      });
      if (!campaign) throw notFound('Kampanjen hittades inte.');
      if (campaign.businessId !== businessId) throw forbidden('Kampanjen tillhör ett annat konto.');

      const candidate = toCampaignCandidate(campaign);
      const candidates = await findInfluencerCandidates(prisma, candidate);
      if (candidates.length === 0) return [];

      const ranked = await ai.rankInfluencersForCampaign(candidate, candidates);
      const top = ranked.slice(0, request.query.limit);
      const profiles = await prisma.influencerProfile.findMany({
        where: { id: { in: top.map((entry) => entry.influencer.id) } },
      });
      const byId = new Map(profiles.map((profile) => [profile.id, profile]));
      const ratings = await ratingsFor(
        prisma,
        'INFLUENCER',
        profiles.map((profile) => profile.id),
      );

      return top.flatMap((entry) => {
        const profile = byId.get(entry.influencer.id);
        if (!profile) return [];
        return [
          {
            score: entry.finalScore,
            reason: entry.reason,
            aiReviewed: entry.aiReviewed,
            rating: ratings.get(profile.id) ?? emptyRatingSummary(),
            influencer: {
              id: profile.id,
              displayName: profile.displayName,
              bio: profile.bio,
              city: profile.city,
              avatarUrl: profile.avatarUrl,
              categories: profile.categories as string[],
              platforms: entry.influencer.platforms as string[],
              followers: entry.influencer.followers,
              avgViews: entry.influencer.avgViews,
              engagementRate: entry.influencer.engagementRate,
              priceTarget: entry.influencer.priceTarget,
            },
          },
        ];
      });
    },
  );
}
