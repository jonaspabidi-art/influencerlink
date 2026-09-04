import {
  checkReviewEligibility,
  emptyRatingSummary,
  overallRating,
  reviewDeadline,
  summarizeRatings,
  type RatingSummary,
  type ReviewInput,
} from '@influencerlink/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { recordAudit } from '../lib/audit.js';

/**
 * Ett omdöme är publicerat när båda parter lämnat sitt (publishedAt), eller
 * när fönstret gått ut och det ensamma släpps fram (visibleAt). Villkoret
 * finns bara här så att ingen fråga råkar läcka ett blint omdöme.
 */
export function publishedWhere(now: Date = new Date()): Prisma.ReviewWhereInput {
  return { OR: [{ publishedAt: { not: null } }, { visibleAt: { lte: now } }] };
}

export const reviewInclude = {
  contract: { select: { campaignId: true, campaign: { select: { title: true } } } },
  author: { select: { name: true } },
} satisfies Prisma.ReviewInclude;

export type ReviewRow = Prisma.ReviewGetPayload<{ include: typeof reviewInclude }>;

/** Formen appen får. `subject` är den part omdömet handlar om, inte författaren. */
export function toReviewDto(review: ReviewRow) {
  return {
    id: review.id,
    contractId: review.contractId,
    campaignTitle: review.contract.campaign.title,
    subject: review.authorRole === 'BUSINESS' ? ('INFLUENCER' as const) : ('BUSINESS' as const),
    authorName: review.author.name,
    rating: review.rating,
    scores: {
      communication: review.communication,
      asDescribed: review.asDescribed,
      again: review.again,
    },
    comment: review.comment,
    createdAt: review.createdAt.toISOString(),
    publishedAt: review.publishedAt?.toISOString() ?? null,
  };
}

/**
 * Sparar ett omdöme och publicerar paret om motparten redan skrivit sitt.
 *
 * Behörigheten kontrolleras mot avtalet, inte mot något klienten skickar in:
 * bara den som är part i ett avslutat avtal kommer förbi, och bara en gång.
 */
export async function submitReview(
  prisma: PrismaClient,
  input: {
    contractId: string;
    userId: string;
    role: 'INFLUENCER' | 'BUSINESS';
    profileId: string;
    review: ReviewInput;
    now?: Date;
  },
): Promise<ReviewRow> {
  const now = input.now ?? new Date();
  const contract = await prisma.contract.findUnique({
    where: { id: input.contractId },
    include: { campaign: { select: { businessId: true } }, reviews: true },
  });
  if (!contract) throw notFound('Avtalet hittades inte.');

  const isParty =
    input.role === 'INFLUENCER'
      ? contract.influencerId === input.profileId
      : contract.campaign.businessId === input.profileId;
  if (!isParty) throw forbidden('Du var inte part i det här samarbetet.');

  const eligibility = checkReviewEligibility({
    status: contract.status,
    completedAt: contract.completedAt,
    alreadyReviewed: contract.reviews.some((review) => review.authorRole === input.role),
    now,
  });
  if (!eligibility.allowed) throw badRequest(eligibility.reason ?? 'Omdömet går inte att lämna.');

  // completedAt är satt – checkReviewEligibility släpper inte igenom annars.
  const completedAt = contract.completedAt as Date;
  const counterpart = contract.reviews.find((review) => review.authorRole !== input.role);

  const review = await prisma.review.create({
    data: {
      contractId: contract.id,
      authorRole: input.role,
      authorId: input.userId,
      influencerId: contract.influencerId,
      businessId: contract.campaign.businessId,
      rating: overallRating(input.review.scores),
      communication: input.review.scores.communication,
      asDescribed: input.review.scores.asDescribed,
      again: input.review.scores.again,
      comment: input.review.comment,
      visibleAt: reviewDeadline(completedAt),
      // Finns motpartens omdöme redan blir båda synliga i samma stund.
      publishedAt: counterpart ? now : null,
    },
    include: reviewInclude,
  });

  if (counterpart) {
    await prisma.review.update({ where: { id: counterpart.id }, data: { publishedAt: now } });
  }

  await recordAudit(prisma, {
    userId: input.userId,
    action: 'review.submitted',
    entityType: 'Contract',
    entityId: contract.id,
    metadata: { authorRole: input.role, rating: review.rating, published: Boolean(counterpart) },
  });

  return review;
}

/**
 * Medelbetyg per profil i en enda fråga. Används av flödena, där ett betyg per
 * kort annars hade blivit lika många frågor som det finns kort.
 */
export async function ratingsFor(
  prisma: PrismaClient,
  subject: 'INFLUENCER' | 'BUSINESS',
  ids: string[],
  now: Date = new Date(),
): Promise<Map<string, RatingSummary>> {
  const summaries = new Map<string, RatingSummary>();
  if (ids.length === 0) return summaries;

  const reviews = await prisma.review.findMany({
    where: {
      // Restaurangens omdömen handlar om kreatören, och tvärtom.
      authorRole: subject === 'INFLUENCER' ? 'BUSINESS' : 'INFLUENCER',
      ...(subject === 'INFLUENCER'
        ? { influencerId: { in: ids } }
        : { businessId: { in: ids } }),
      ...publishedWhere(now),
    },
    select: { rating: true, influencerId: true, businessId: true },
  });

  const byId = new Map<string, number[]>();
  for (const review of reviews) {
    const key = subject === 'INFLUENCER' ? review.influencerId : review.businessId;
    const bucket = byId.get(key);
    if (bucket) bucket.push(review.rating);
    else byId.set(key, [review.rating]);
  }

  for (const id of ids) {
    summaries.set(id, summarizeRatings(byId.get(id) ?? []));
  }
  return summaries;
}

/** Enskild profils omdömen, publicerade och nyast först. */
export async function reviewsForProfile(
  prisma: PrismaClient,
  subject: 'INFLUENCER' | 'BUSINESS',
  profileId: string,
  now: Date = new Date(),
): Promise<{ summary: RatingSummary; reviews: ReviewRow[] }> {
  const reviews = await prisma.review.findMany({
    where: {
      authorRole: subject === 'INFLUENCER' ? 'BUSINESS' : 'INFLUENCER',
      ...(subject === 'INFLUENCER' ? { influencerId: profileId } : { businessId: profileId }),
      ...publishedWhere(now),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: reviewInclude,
  });

  return {
    summary: reviews.length
      ? summarizeRatings(reviews.map((review) => review.rating))
      : emptyRatingSummary(),
    reviews,
  };
}
