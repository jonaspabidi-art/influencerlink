import {
  REVIEW_WINDOW_DAYS,
  checkReviewEligibility,
  daysLeftToReview,
  problemSchema,
  ratingSummarySchema,
  reviewInputSchema,
  reviewSchema,
} from '@pacta/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { forbidden, notFound } from '../lib/errors.js';
import { requireProfileId } from '../plugins/auth.js';
import type { Services } from '../services/index.js';
import {
  reviewInclude,
  reviewsForProfile,
  submitReview,
  toReviewDto,
} from '../services/reviews.js';

const reviewStateSchema = z.object({
  /** Får den inloggade parten skriva just nu? */
  canReview: z.boolean(),
  reason: z.string().nullable(),
  /** Dagar kvar av fönstret. 0 när avtalet inte är avslutat. */
  daysLeft: z.number().int().min(0),
  /** Det egna omdömet, synligt direkt även innan det publicerats. */
  mine: reviewSchema.nullable(),
  /** Motpartens – null så länge det fortfarande är blint. */
  theirs: reviewSchema.nullable(),
  /** True när motparten skrivit men omdömena ännu inte släppts fram. */
  theirsPending: z.boolean(),
});

export async function reviewRoutes(app: FastifyInstance, services: Services): Promise<void> {
  const server = app.withTypeProvider<ZodTypeProvider>();
  const { prisma } = services;

  /** Läget för ett avtal: vad jag skrivit, vad motparten skrivit, och om jag får skriva. */
  server.get(
    '/contracts/:id/reviews',
    {
      preHandler: app.requireRole('INFLUENCER', 'BUSINESS'),
      schema: {
        params: z.object({ id: z.string() }),
        response: { 200: reviewStateSchema, 403: problemSchema, 404: problemSchema },
      },
    },
    async (request) => {
      const role = request.user.role === 'INFLUENCER' ? 'INFLUENCER' : 'BUSINESS';
      const contract = await loadContract(services, request.params.id, role, requireProfileId(request));
      const now = new Date();

      const reviews = await prisma.review.findMany({
        where: { contractId: contract.id },
        include: reviewInclude,
      });
      const mine = reviews.find((review) => review.authorRole === role) ?? null;
      const theirs = reviews.find((review) => review.authorRole !== role) ?? null;
      const theirsVisible =
        theirs !== null && (theirs.publishedAt !== null || theirs.visibleAt.getTime() <= now.getTime());

      const eligibility = checkReviewEligibility({
        status: contract.status,
        completedAt: contract.completedAt,
        alreadyReviewed: mine !== null,
        now,
      });

      return {
        canReview: eligibility.allowed,
        reason: eligibility.reason ?? null,
        daysLeft: contract.completedAt ? daysLeftToReview(contract.completedAt, now) : 0,
        mine: mine ? toReviewDto(mine) : null,
        theirs: theirsVisible && theirs ? toReviewDto(theirs) : null,
        theirsPending: theirs !== null && !theirsVisible,
      };
    },
  );

  server.post(
    '/contracts/:id/reviews',
    {
      preHandler: app.requireRole('INFLUENCER', 'BUSINESS'),
      schema: {
        params: z.object({ id: z.string() }),
        body: reviewInputSchema,
        response: { 200: reviewSchema, 400: problemSchema, 403: problemSchema, 404: problemSchema },
      },
    },
    async (request) => {
      const role = request.user.role === 'INFLUENCER' ? 'INFLUENCER' : 'BUSINESS';
      const review = await submitReview(prisma, {
        contractId: request.params.id,
        userId: request.user.sub,
        role,
        profileId: requireProfileId(request),
        review: request.body,
      });
      return toReviewDto(review);
    },
  );

  const profileResponse = z.object({
    summary: ratingSummarySchema,
    reviews: z.array(reviewSchema),
  });

  server.get(
    '/influencers/:id/reviews',
    {
      preHandler: app.authenticate,
      schema: { params: z.object({ id: z.string() }), response: { 200: profileResponse } },
    },
    async (request) => {
      const result = await reviewsForProfile(prisma, 'INFLUENCER', request.params.id);
      return { summary: result.summary, reviews: result.reviews.map(toReviewDto) };
    },
  );

  server.get(
    '/businesses/:id/reviews',
    {
      preHandler: app.authenticate,
      schema: { params: z.object({ id: z.string() }), response: { 200: profileResponse } },
    },
    async (request) => {
      const result = await reviewsForProfile(prisma, 'BUSINESS', request.params.id);
      return { summary: result.summary, reviews: result.reviews.map(toReviewDto) };
    },
  );

  /** Egna omdömen att skriva: avslutade avtal där fönstret fortfarande är öppet. */
  server.get(
    '/reviews/pending',
    {
      preHandler: app.requireRole('INFLUENCER', 'BUSINESS'),
      schema: {
        response: {
          200: z.array(
            z.object({
              contractId: z.string(),
              campaignTitle: z.string(),
              counterpartName: z.string(),
              completedAt: z.string(),
              daysLeft: z.number().int().min(0),
            }),
          ),
        },
      },
    },
    async (request) => {
      const role = request.user.role === 'INFLUENCER' ? 'INFLUENCER' : 'BUSINESS';
      const profileId = requireProfileId(request);
      const now = new Date();

      const contracts = await prisma.contract.findMany({
        where: {
          status: 'COMPLETED',
          // Bara avtal där fönstret fortfarande är öppet.
          completedAt: { gt: new Date(now.getTime() - REVIEW_WINDOW_DAYS * DAY_MS) },
          reviews: { none: { authorRole: role } },
          ...(role === 'INFLUENCER'
            ? { influencerId: profileId }
            : { campaign: { businessId: profileId } }),
        },
        include: {
          campaign: { include: { business: { select: { companyName: true } } } },
          influencer: { select: { displayName: true } },
        },
        orderBy: { completedAt: 'desc' },
      });

      return contracts.map((contract) => ({
        contractId: contract.id,
        campaignTitle: contract.campaign.title,
        counterpartName:
          role === 'INFLUENCER'
            ? contract.campaign.business.companyName
            : contract.influencer.displayName,
        completedAt: (contract.completedAt as Date).toISOString(),
        daysLeft: daysLeftToReview(contract.completedAt as Date, now),
      }));
    },
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Hämtar avtalet och kastar om den inloggade parten inte hör till det. */
async function loadContract(
  services: Services,
  contractId: string,
  role: 'INFLUENCER' | 'BUSINESS',
  profileId: string,
) {
  const contract = await services.prisma.contract.findUnique({
    where: { id: contractId },
    include: { campaign: { select: { businessId: true } } },
  });
  if (!contract) throw notFound('Avtalet hittades inte.');

  const isParty =
    role === 'INFLUENCER'
      ? contract.influencerId === profileId
      : contract.campaign.businessId === profileId;
  if (!isParty) throw forbidden('Du var inte part i det här samarbetet.');
  return contract;
}
