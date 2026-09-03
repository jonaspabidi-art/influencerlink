import { problemSchema } from '@influencerlink/shared';
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
import { publicCampaignSchema, toPublicCampaign } from './campaigns.js';

/** Kort i swipe-decken: kortet plus varför det visas. */
const scoredSchema = z.object({
  score: z.number(),
  reason: z.string(),
  aiReviewed: z.boolean(),
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
              campaign: toPublicCampaign(campaign),
            },
          ];
        });
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

      return top.flatMap((entry) => {
        const profile = byId.get(entry.influencer.id);
        if (!profile) return [];
        return [
          {
            score: entry.finalScore,
            reason: entry.reason,
            aiReviewed: entry.aiReviewed,
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
