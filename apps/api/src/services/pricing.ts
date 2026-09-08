import {
  suggestRetainerRate,
  type RetainerRateSuggestion,
} from '@pacta/shared';
import type { PrismaClient } from '@prisma/client';

/**
 * Underlaget till kreatörens prisförslag.
 *
 * Två av de tre talen kommer från andra användare, och därför lämnar de aldrig
 * det här lagret som enskilda priser – bara som antal, median och ytterlägen.
 * Att visa "Sara tar 8 000" för en konkurrent vore att lämna ut något kreatören
 * lämnat till oss för matchningens skull, inte för insyn.
 */

/** Så många grannar och kampanjer underlaget som mest bygger på. */
const SAMPLE_LIMIT = 40;

export async function buildRateSuggestion(
  prisma: PrismaClient,
  influencerId: string,
): Promise<{ suggestion: RetainerRateSuggestion; city: string; priceTarget: number }> {
  const profile = await prisma.influencerProfile.findUniqueOrThrow({
    where: { id: influencerId },
    include: { socialAccounts: true },
  });

  const peers = await prisma.influencerProfile.findMany({
    where: {
      id: { not: influencerId },
      city: { equals: profile.city, mode: 'insensitive' },
      acceptsRetainers: true,
      retainerBaseRate: { not: null },
    },
    select: { retainerBaseRate: true },
    take: SAMPLE_LIMIT,
  });

  // Vad företagen i staden faktiskt budgeterar. Det är taket kreatören förhandlar
  // mot, oavsett vad kreatören själv tycker att arbetet är värt.
  const campaigns = await prisma.campaign.findMany({
    where: {
      city: { equals: profile.city, mode: 'insensitive' },
      status: 'ACTIVE',
      budgetPerCreator: { gt: 0 },
    },
    select: { budgetPerCreator: true },
    take: SAMPLE_LIMIT,
    orderBy: { createdAt: 'desc' },
  });

  return {
    city: profile.city,
    priceTarget: Math.max(profile.priceTarget, profile.priceMin),
    suggestion: suggestRetainerRate({
      priceTarget: Math.max(profile.priceTarget, profile.priceMin),
      peerRates: peers.flatMap((peer) => (peer.retainerBaseRate === null ? [] : [peer.retainerBaseRate])),
      cityBudgets: campaigns.map((campaign) => campaign.budgetPerCreator),
      statsVerified: profile.socialAccounts.some((account) => account.statsSource === 'PLATFORM'),
    }),
  };
}
