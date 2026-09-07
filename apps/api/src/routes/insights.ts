import { problemSchema } from '@pacta/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireProfileId } from '../plugins/auth.js';
import type { Services } from '../services/index.js';
import { buildCreatorInsights } from '../services/insights.js';

const insightsSchema = z.object({
  openCampaigns: z.number().int(),
  eligible: z.number().int(),
  eligibleInCity: z.number().int(),
  reviewed: z.number().int(),
  waiting: z.number().int(),
  matches: z.number().int(),
  city: z.string(),
  blockers: z.object({
    followers: z.number().int(),
    platforms: z.number().int(),
    budget: z.number().int(),
  }),
  actions: z.array(
    z.object({
      kind: z.enum(['FOLLOWERS', 'PLATFORMS', 'BUDGET']),
      message: z.string(),
      unlocks: z.number().int(),
      suggestedPriceMin: z.number().int().optional(),
      platform: z.string().optional(),
    }),
  ),
  gaps: z.array(z.object({ field: z.string(), message: z.string() })),
});

/**
 * Varför kreatören får få matchningar.
 *
 * Två slutpunkter och inte en, med flit. Fakta är uträknade och kan visas
 * omedelbart; rådet kostar ett modellanrop och några sekunder. Slår man ihop
 * dem får hon vänta på gissningen innan hon ser det som redan är sant.
 */
export async function insightRoutes(app: FastifyInstance, services: Services): Promise<void> {
  const server = app.withTypeProvider<ZodTypeProvider>();
  const { prisma, ai } = services;

  server.get(
    '/me/insights',
    {
      preHandler: app.requireRole('INFLUENCER'),
      schema: { response: { 200: insightsSchema, 403: problemSchema } },
    },
    async (request) => {
      const { insights, candidate } = await buildCreatorInsights(
        prisma,
        requireProfileId(request),
      );
      return { ...insights, city: candidate.city };
    },
  );

  server.post(
    '/me/insights/advice',
    {
      preHandler: app.requireRole('INFLUENCER'),
      // Underlaget ändras sällan och svaret cachas på det, så en handfull i
      // timmen räcker även för den som verkligen jobbar med sin profil.
      config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
      schema: {
        response: {
          200: z.object({
            available: z.boolean(),
            advice: z.string().nullable(),
          }),
          403: problemSchema,
        },
      },
    },
    async (request) => {
      const { insights, candidate } = await buildCreatorInsights(
        prisma,
        requireProfileId(request),
      );
      return { available: ai.enabled, advice: await ai.adviseCreator(candidate, insights) };
    },
  );
}
