import type { CampaignCandidate, InfluencerCandidate } from '@pacta/shared';
import { checkEligibility, isTravelling, type TravelPlan } from '@pacta/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import { aggregateStats } from './social/index.js';

/** Så många kandidater hämtas ur databasen innan rangordningen. */
const CANDIDATE_POOL = 100;

/** Resan som tre kolumner blir en resa, eller ingen alls. */
export function toTravelPlan(profile: {
  travelCity: string | null;
  travelFrom: Date | null;
  travelTo: Date | null;
}): TravelPlan | null {
  if (!profile.travelCity || !profile.travelFrom || !profile.travelTo) return null;
  return { city: profile.travelCity, from: profile.travelFrom, to: profile.travelTo };
}

const influencerWithSocials = {
  include: { socialAccounts: true },
} satisfies Prisma.InfluencerProfileDefaultArgs;

type InfluencerRow = Prisma.InfluencerProfileGetPayload<typeof influencerWithSocials>;

export function toInfluencerCandidate(
  profile: InfluencerRow,
  now = new Date(),
): InfluencerCandidate {
  const stats = aggregateStats(profile.socialAccounts);
  /*
   * Resan räknas bara medan den pågår.
   *
   * En planerad resa syns för företag som letar, men den ska inte påverka
   * rangordningen i kortleken förrän kreatören faktiskt är där – annars
   * föreslås uppdrag som ska utföras innan hen rest.
   */
  const travel = toTravelPlan(profile);
  return {
    id: profile.id,
    displayName: profile.displayName,
    city: profile.city,
    travelCity: isTravelling(travel, now) ? travel!.city : null,
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
 * Influencers som företaget ännu inte har swipat på för den här kampanjen
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
    .map((row) => toInfluencerCandidate(row))
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
