import { problemSchema, swipeInputSchema, swipeResponseSchema } from '@pacta/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { requireProfileId } from '../plugins/auth.js';
import type { Services } from '../services/index.js';
import { recordSwipe } from '../services/matching.js';

export async function swipeRoutes(app: FastifyInstance, services: Services): Promise<void> {
  const server = app.withTypeProvider<ZodTypeProvider>();
  const { prisma } = services;

  server.post(
    '/swipes',
    {
      preHandler: app.requireRole('INFLUENCER', 'BUSINESS'),
      config: { rateLimit: { max: 200, timeWindow: '1 minute' } },
      schema: {
        body: swipeInputSchema,
        response: { 200: swipeResponseSchema, 400: problemSchema, 403: problemSchema },
      },
    },
    async (request) => {
      const profileId = requireProfileId(request);
      const isInfluencer = request.user.role === 'INFLUENCER';

      let influencerId: string;
      if (isInfluencer) {
        influencerId = profileId;
      } else {
        if (!request.body.influencerId) {
          throw badRequest('influencerId krävs när ett företag swipar.');
        }
        // Företaget får bara swipa inom sina egna kampanjer.
        const campaign = await prisma.campaign.findUnique({
          where: { id: request.body.campaignId },
          select: { businessId: true },
        });
        if (!campaign) throw notFound('Kampanjen hittades inte.');
        if (campaign.businessId !== profileId) {
          throw forbidden('Kampanjen tillhör ett annat konto.');
        }
        influencerId = request.body.influencerId;
      }

      const result = await recordSwipe(prisma, {
        campaignId: request.body.campaignId,
        influencerId,
        actor: isInfluencer ? 'INFLUENCER' : 'BUSINESS',
        direction: request.body.direction,
        userId: request.user.sub,
      });

      return { recorded: true as const, match: result.match };
    },
  );
}
