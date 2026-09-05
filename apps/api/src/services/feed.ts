import type { CampaignCandidate, InfluencerCandidate } from '@pacta/shared';
import { checkEligibility } from '@pacta/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import { aggregateStats } from './social.js';

/** Så många kandidater hämtas ur databasen innan rangordningen. */
const CANDIDATE_POOL = 100;

const influencerWithSocials = {
  include: { socialAccounts: true },
} satisfies Prisma.InfluencerProfileDefaultArgs;

type InfluencerRow = Prisma.InfluencerProfileGetPayload<typeof influencerWithSocials>;

export function toInfluencerCandidate(profile: InfluencerRow): InfluencerCandidate {
  const stats = aggregateStats(profile.socialAccounts);
  return {
    id: profile.id,
    displayName: profile.displayName,
    city: profile.city,
    categories: profile.categories,
    platforms: profile.socialAccounts.map((account) => account.platform),
    followers: stats.followers,
    avgViews: stats.avgViews,
    engagementRate: stats.engagementRate,
    priceMin: profile.priceMin,
    priceTarget: Math.max(profile.priceTarget, profile.priceMin),
  };
}

export function toCampaignCandidate(campaign: {
  id: string;
  title: string;
  city: string;
  categories: CampaignCandidate['categories'];
  platforms: CampaignCandidate['platforms'];
  deliverables: CampaignCandidate['deliverables'];
  minFollowers: number;
  budgetPerCreator: number;
}): CampaignCandidate {
  return {
    id: campaign.id,
    title: campaign.title,
    city: campaign.city,
    categories: campaign.categories,
    platforms: campaign.platforms,
    deliverables: campaign.deliverables,
    minFollowers: campaign.minFollowers,
    budgetPerCreator: campaign.budgetPerCreator,
  };
}

/**
 * Influencers som restaurangen ännu inte har swipat på för den här kampanjen
 * och som klarar kampanjens hårda krav.
 */
export async function findInfluencerCandidates(
  prisma: PrismaClient,
  campaign: CampaignCandidate,
): Promise<InfluencerCandidate[]> {
  const rows = await prisma.influencerProfile.findMany({
    where: {
      user: { onboardingComplete: true },
      socialAccounts: { some: {} },
      // Redan bedömda profiler ska inte dyka upp igen i decken.
      swipes: { none: { campaignId: campaign.id, actor: 'BUSINESS' } },
    },
    include: { socialAccounts: true },
    take: CANDIDATE_POOL,
    orderBy: { updatedAt: 'desc' },
  });

  return rows
    .map(toInfluencerCandidate)
    .filter((candidate) => checkEligibility(campaign, candidate).eligible);
}

/**
 * Kampanjer som influencern kan söka: aktiva, inte utgångna, med lediga
 * platser, inte redan swipade och där influencern klarar kraven.
 */
export async function findCampaignCandidates(
  prisma: PrismaClient,
  influencer: InfluencerCandidate,
): Promise<CampaignCandidate[]> {
  const now = new Date();
  const rows = await prisma.campaign.findMany({
    where: {
      status: 'ACTIVE',
      endDate: { gte: now },
      swipes: { none: { influencerId: influencer.id, actor: 'INFLUENCER' } },
    },
    include: { contracts: { select: { status: true } } },
    take: CANDIDATE_POOL,
    orderBy: { createdAt: 'desc' },
  });

  return rows
    .filter((campaign) => {
      const taken = campaign.contracts.filter((contract) => contract.status !== 'CANCELLED').length;
      return taken < campaign.slots;
    })
    .map(toCampaignCandidate)
    .filter((candidate) => checkEligibility(candidate, influencer).eligible);
}
