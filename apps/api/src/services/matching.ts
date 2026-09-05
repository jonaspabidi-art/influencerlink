import type { SwipeActor, SwipeDirection } from '@pacta/shared';
import { scoreMatch } from '@pacta/shared';
import type { PrismaClient } from '@prisma/client';
import { badRequest, notFound } from '../lib/errors.js';
import { recordAudit } from '../lib/audit.js';
import { toCampaignCandidate, toInfluencerCandidate } from './feed.js';

export interface RecordSwipeInput {
  campaignId: string;
  influencerId: string;
  actor: SwipeActor;
  direction: SwipeDirection;
  /** Loggas i spårbarhetsloggen när en match uppstår. */
  userId: string;
}

export interface RecordSwipeResult {
  match: {
    id: string;
    campaignId: string;
    influencerId: string;
    matchScore: number;
    matchReason: string;
  } | null;
}

/**
 * Registrerar en swipe och skapar en match när båda parter svajpat höger.
 *
 * Uppslaget av motpartens swipe och skapandet av matchen sker i samma
 * transaktion, så två samtidiga högersvep kan inte ge två matcher – den unika
 * nyckeln på (campaignId, influencerId) fångar kapplöpningen.
 */
export async function recordSwipe(
  prisma: PrismaClient,
  input: RecordSwipeInput,
): Promise<RecordSwipeResult> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: input.campaignId },
    include: { contracts: { select: { status: true } } },
  });
  if (!campaign) throw notFound('Kampanjen hittades inte.');
  if (campaign.status !== 'ACTIVE') {
    throw badRequest('Kampanjen tar inte emot nya intresseanmälningar just nu.');
  }

  const takenSlots = campaign.contracts.filter((contract) => contract.status !== 'CANCELLED').length;
  if (takenSlots >= campaign.slots) {
    throw badRequest('Kampanjen är fullbokad.');
  }

  const influencer = await prisma.influencerProfile.findUnique({
    where: { id: input.influencerId },
    include: { socialAccounts: true },
  });
  if (!influencer) throw notFound('Influencerprofilen hittades inte.');

  const opposite: SwipeActor = input.actor === 'INFLUENCER' ? 'BUSINESS' : 'INFLUENCER';

  return prisma.$transaction(async (tx) => {
    await tx.swipe.upsert({
      where: {
        campaignId_influencerId_actor: {
          campaignId: input.campaignId,
          influencerId: input.influencerId,
          actor: input.actor,
        },
      },
      create: {
        campaignId: input.campaignId,
        influencerId: input.influencerId,
        actor: input.actor,
        direction: input.direction,
      },
      // En ändrad swipe skriver över den gamla – men bara riktningen.
      update: { direction: input.direction },
    });

    if (input.direction === 'PASS') return { match: null };

    const counterpart = await tx.swipe.findUnique({
      where: {
        campaignId_influencerId_actor: {
          campaignId: input.campaignId,
          influencerId: input.influencerId,
          actor: opposite,
        },
      },
    });
    if (!counterpart || counterpart.direction !== 'LIKE') return { match: null };

    const breakdown = scoreMatch(toCampaignCandidate(campaign), toInfluencerCandidate(influencer));
    const matchReason =
      breakdown.reasons[0] ?? 'Ömsesidigt intresse mellan restaurangen och influencern';

    const match = await tx.match.upsert({
      where: {
        campaignId_influencerId: {
          campaignId: input.campaignId,
          influencerId: input.influencerId,
        },
      },
      create: {
        campaignId: input.campaignId,
        influencerId: input.influencerId,
        matchScore: breakdown.total,
        matchReason,
      },
      update: {},
    });

    await recordAudit(tx, {
      userId: input.userId,
      action: 'match.created',
      entityType: 'Match',
      entityId: match.id,
      metadata: { campaignId: input.campaignId, influencerId: input.influencerId, score: breakdown.total },
    });

    return {
      match: {
        id: match.id,
        campaignId: match.campaignId,
        influencerId: match.influencerId,
        matchScore: match.matchScore,
        matchReason: match.matchReason,
      },
    };
  });
}
