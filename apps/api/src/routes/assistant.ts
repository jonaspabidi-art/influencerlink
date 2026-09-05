import { emptyRatingSummary, problemSchema } from '@pacta/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { notFound } from '../lib/errors.js';
import { requireProfileId } from '../plugins/auth.js';
import { aggregateStats } from '../services/social/index.js';
import { ratingsFor } from '../services/reviews.js';
import type { Services } from '../services/index.js';

/** Så många kreatörer får plats i underlaget. Fler ger inte bättre råd. */
const CANDIDATE_LIMIT = 20;

/**
 * Rådgivaren.
 *
 * Företagaren är sällan van vid influencermarknadsföring och har ont om tid.
 * Den här slutpunkten samlar ihop det som faktiskt finns – verksamheten, den
 * valda kampanjen och kreatörerna i rätt stad – och låter modellen resonera om
 * det. Den söker aldrig själv och kan därför inte hitta på en profil.
 */
export async function assistantRoutes(app: FastifyInstance, services: Services): Promise<void> {
  const server = app.withTypeProvider<ZodTypeProvider>();
  const { prisma, ai } = services;

  server.post(
    '/assistant/ask',
    {
      preHandler: app.requireRole('BUSINESS'),
      // Varje fråga kostar ett modellanrop. Tjugo i timmen räcker gott för en
      // företagare och hindrar att en trasig klient bränner budgeten.
      config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
      schema: {
        body: z.object({
          question: z.string().min(3).max(600),
          /** Frågan gäller ofta en viss kampanj. Utan den svarar vi allmänt. */
          campaignId: z.string().optional(),
        }),
        response: {
          200: z.object({
            available: z.boolean(),
            answer: z.string().nullable(),
            /** Antal kreatörer svaret bygger på, så användaren vet underlaget. */
            candidateCount: z.number().int(),
          }),
          404: problemSchema,
        },
      },
    },
    async (request) => {
      const businessId = requireProfileId(request);
      const business = await prisma.businessProfile.findUniqueOrThrow({
        where: { id: businessId },
      });

      const campaign = request.body.campaignId
        ? await prisma.campaign.findUnique({ where: { id: request.body.campaignId } })
        : null;
      if (request.body.campaignId && !campaign) throw notFound('Kampanjen hittades inte.');
      if (campaign && campaign.businessId !== businessId) {
        throw notFound('Kampanjen hittades inte.');
      }

      // Kandidaterna: i kampanjens stad om en kampanj är vald, annars i
      // företagets egen. Ett råd om kreatörer i fel stad är inget råd.
      const city = campaign?.city || business.city;
      const profiles = await prisma.influencerProfile.findMany({
        where: {
          user: { onboardingComplete: true },
          socialAccounts: { some: {} },
          city: { equals: city, mode: 'insensitive' },
        },
        include: { socialAccounts: true, showcase: { select: { id: true } } },
        take: CANDIDATE_LIMIT,
        orderBy: { updatedAt: 'desc' },
      });

      const ratings = await ratingsFor(
        prisma,
        'INFLUENCER',
        profiles.map((profile) => profile.id),
      );

      const candidates = profiles.map((profile) => {
        const stats = aggregateStats(profile.socialAccounts);
        const rating = ratings.get(profile.id) ?? emptyRatingSummary();
        return {
          displayName: profile.displayName,
          city: profile.city,
          categories: profile.categories as string[],
          followers: stats.followers,
          avgViews: stats.avgViews,
          engagementRate: stats.engagementRate,
          priceMin: profile.priceMin,
          priceTarget: profile.priceTarget,
          ratingAverage: rating.average,
          ratingCount: rating.count,
          // Skillnaden hör hemma i underlaget: ett råd som vilar på ogranskade
          // siffror ska säga det.
          statsVerified: profile.socialAccounts.some(
            (account) => account.statsSource === 'PLATFORM',
          ),
          showcaseCount: profile.showcase.length,
        };
      });

      const answer = await ai.advise({
        question: request.body.question,
        business: {
          companyName: business.companyName,
          city: business.city,
          categories: business.categories as string[],
          description: business.description,
        },
        campaign: campaign
          ? {
              title: campaign.title,
              brief: campaign.brief,
              budgetPerCreator: campaign.budgetPerCreator,
              slots: campaign.slots,
            }
          : null,
        candidates,
      });

      return {
        available: ai.enabled,
        answer,
        candidateCount: candidates.length,
      };
    },
  );
}
