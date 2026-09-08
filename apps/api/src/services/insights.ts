import {
  creatorInsights,
  type CreatorInsights,
  type InsightCampaign,
  type InfluencerCandidate,
} from '@pacta/shared';
import type { PrismaClient } from '@prisma/client';
import { toCampaignCandidate, toInfluencerCandidate } from './feed.js';

/**
 * Så många öppna kampanjer underlaget bygger på. Samma tak som kortleken har,
 * så att siffrorna kreatören ser matchar det hen faktiskt kan mötas av.
 */
const CAMPAIGN_POOL = 100;

/**
 * Underlaget till kreatörens insiktsvy.
 *
 * Skillnaden mot kortlekens hämtning är att den här inte filtrerar bort
 * någonting. Kortleken vill bara ha kampanjer kreatören kan söka; det här vill veta
 * hur många kreatören *inte* kan söka, och varför.
 */
export async function buildCreatorInsights(
  prisma: PrismaClient,
  influencerId: string,
): Promise<{ insights: CreatorInsights; candidate: InfluencerCandidate }> {
  const profile = await prisma.influencerProfile.findUniqueOrThrow({
    where: { id: influencerId },
    include: { socialAccounts: true, showcase: { select: { id: true } } },
  });
  const candidate = toInfluencerCandidate(profile);

  const now = new Date();
  const rows = await prisma.campaign.findMany({
    where: { status: 'ACTIVE', endDate: { gte: now } },
    include: {
      contracts: { select: { status: true } },
      swipes: { where: { influencerId, actor: 'INFLUENCER' }, select: { id: true } },
    },
    take: CAMPAIGN_POOL,
    orderBy: { createdAt: 'desc' },
  });

  const campaigns: InsightCampaign[] = rows
    .filter((campaign) => {
      const taken = campaign.contracts.filter((contract) => contract.status !== 'CANCELLED').length;
      return taken < campaign.slots;
    })
    .map((campaign) => ({
      ...toCampaignCandidate(campaign),
      reviewed: campaign.swipes.length > 0,
    }));

  const matches = await prisma.match.count({ where: { influencerId } });

  return {
    candidate,
    insights: creatorInsights({
      influencer: candidate,
      campaigns,
      matches,
      signals: {
        hasAvatar: profile.avatarUrl !== null && profile.avatarUrl !== '',
        bioLength: profile.bio.trim().length,
        showcaseCount: profile.showcase.length,
        statsVerified: profile.socialAccounts.some(
          (account) => account.statsSource === 'PLATFORM',
        ),
      },
    }),
  };
}
