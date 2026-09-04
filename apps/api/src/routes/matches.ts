import {
  applicationInputSchema,
  applicationStatusSchema,
  emptyRatingSummary,
  matchStatusSchema,
  messageInputSchema,
  problemSchema,
  ratingSummarySchema,
} from '@influencerlink/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { requireProfileId } from '../plugins/auth.js';
import type { Services } from '../services/index.js';
import { recordSwipe } from '../services/matching.js';
import { ratingsFor } from '../services/reviews.js';

const matchSchema = z.object({
  id: z.string(),
  status: matchStatusSchema,
  matchScore: z.number(),
  matchReason: z.string(),
  createdAt: z.string(),
  campaign: z.object({
    id: z.string(),
    title: z.string(),
    businessId: z.string(),
    businessName: z.string(),
    budgetPerCreator: z.number().int(),
    city: z.string(),
  }),
  influencer: z.object({
    id: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
    city: z.string(),
  }),
  contractId: z.string().nullable(),
  lastMessage: z.string().nullable(),
  /** Motpartens betyg – restaurangens för influencern, och tvärtom. */
  counterpartRating: ratingSummarySchema,
});

const messageSchema = z.object({
  id: z.string(),
  senderId: z.string(),
  senderName: z.string(),
  body: z.string(),
  createdAt: z.string(),
});

export async function matchRoutes(app: FastifyInstance, services: Services): Promise<void> {
  const server = app.withTypeProvider<ZodTypeProvider>();
  const { prisma } = services;

  server.get(
    '/matches',
    {
      preHandler: app.requireRole('INFLUENCER', 'BUSINESS'),
      schema: { response: { 200: z.array(matchSchema) } },
    },
    async (request) => {
      const profileId = requireProfileId(request);
      const matches = await prisma.match.findMany({
        where:
          request.user.role === 'INFLUENCER'
            ? { influencerId: profileId }
            : { campaign: { businessId: profileId } },
        include: {
          campaign: { include: { business: true } },
          influencer: true,
          contracts: { select: { id: true }, orderBy: { createdAt: 'desc' }, take: 1 },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { updatedAt: 'desc' },
      });

      const counterpartIsInfluencer = request.user.role === 'BUSINESS';
      const ratings = await ratingsFor(
        prisma,
        counterpartIsInfluencer ? 'INFLUENCER' : 'BUSINESS',
        matches.map((match) =>
          counterpartIsInfluencer ? match.influencerId : match.campaign.businessId,
        ),
      );

      return matches.map((match) => ({
        id: match.id,
        status: match.status,
        matchScore: match.matchScore,
        matchReason: match.matchReason,
        createdAt: match.createdAt.toISOString(),
        campaign: {
          id: match.campaign.id,
          title: match.campaign.title,
          businessId: match.campaign.businessId,
          businessName: match.campaign.business.companyName,
          budgetPerCreator: match.campaign.budgetPerCreator,
          city: match.campaign.city,
        },
        influencer: {
          id: match.influencer.id,
          displayName: match.influencer.displayName,
          avatarUrl: match.influencer.avatarUrl,
          city: match.influencer.city,
        },
        contractId: match.contracts[0]?.id ?? null,
        lastMessage: match.messages[0]?.body ?? null,
        counterpartRating:
          ratings.get(
            counterpartIsInfluencer ? match.influencerId : match.campaign.businessId,
          ) ?? emptyRatingSummary(),
      }));
    },
  );

  server.get(
    '/matches/:id/messages',
    {
      preHandler: app.requireRole('INFLUENCER', 'BUSINESS'),
      schema: {
        params: z.object({ id: z.string() }),
        response: { 200: z.array(messageSchema), 403: problemSchema },
      },
    },
    async (request) => {
      await assertMatchParty(services, request.params.id, request.user.role, requireProfileId(request));
      const messages = await prisma.message.findMany({
        where: { matchId: request.params.id },
        include: { sender: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
        take: 200,
      });
      return messages.map((message) => ({
        id: message.id,
        senderId: message.senderId,
        senderName: message.sender.name,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
      }));
    },
  );

  server.post(
    '/matches/:id/messages',
    {
      preHandler: app.requireRole('INFLUENCER', 'BUSINESS'),
      schema: {
        params: z.object({ id: z.string() }),
        body: messageInputSchema,
        response: { 200: messageSchema, 403: problemSchema },
      },
    },
    async (request) => {
      await assertMatchParty(services, request.params.id, request.user.role, requireProfileId(request));

      const [message] = await prisma.$transaction([
        prisma.message.create({
          data: { matchId: request.params.id, senderId: request.user.sub, body: request.body.body },
          include: { sender: { select: { name: true } } },
        }),
        // Matchen flyttas till "pågår" så fort någon skrivit första meddelandet.
        prisma.match.updateMany({
          where: { id: request.params.id, status: 'NEW' },
          data: { status: 'IN_CONVERSATION' },
        }),
      ]);

      return {
        id: message.id,
        senderId: message.senderId,
        senderName: message.sender.name,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
      };
    },
  );

  // --- Ansökningar --------------------------------------------------------

  /**
   * Influencern kan söka en kampanj med en egen pitch istället för att bara
   * swipa. Ansökan räknas som ett högersvep från influencern.
   */
  server.post(
    '/applications',
    {
      preHandler: app.requireRole('INFLUENCER'),
      schema: {
        body: applicationInputSchema,
        response: {
          200: z.object({
            id: z.string(),
            status: applicationStatusSchema,
            matchId: z.string().nullable(),
          }),
          400: problemSchema,
        },
      },
    },
    async (request) => {
      const influencerId = requireProfileId(request);
      const { match } = await recordSwipe(prisma, {
        campaignId: request.body.campaignId,
        influencerId,
        actor: 'INFLUENCER',
        direction: 'LIKE',
        userId: request.user.sub,
      });

      const application = await prisma.application.upsert({
        where: {
          campaignId_influencerId: { campaignId: request.body.campaignId, influencerId },
        },
        create: {
          campaignId: request.body.campaignId,
          influencerId,
          pitch: request.body.pitch,
          proposedFee: request.body.proposedFee ?? null,
        },
        update: {
          pitch: request.body.pitch,
          proposedFee: request.body.proposedFee ?? null,
          status: 'PENDING',
        },
      });

      return { id: application.id, status: application.status, matchId: match?.id ?? null };
    },
  );

  server.get(
    '/campaigns/:id/applications',
    {
      preHandler: app.requireRole('BUSINESS'),
      schema: {
        params: z.object({ id: z.string() }),
        response: {
          200: z.array(
            z.object({
              id: z.string(),
              status: applicationStatusSchema,
              pitch: z.string(),
              proposedFee: z.number().int().nullable(),
              createdAt: z.string(),
              influencer: z.object({
                id: z.string(),
                displayName: z.string(),
                avatarUrl: z.string().nullable(),
                city: z.string(),
              }),
            }),
          ),
        },
      },
    },
    async (request) => {
      const businessId = requireProfileId(request);
      const campaign = await prisma.campaign.findUnique({ where: { id: request.params.id } });
      if (!campaign) throw notFound('Kampanjen hittades inte.');
      if (campaign.businessId !== businessId) throw forbidden('Kampanjen tillhör ett annat konto.');

      const applications = await prisma.application.findMany({
        where: { campaignId: campaign.id },
        include: { influencer: true },
        orderBy: { createdAt: 'desc' },
      });
      return applications.map((application) => ({
        id: application.id,
        status: application.status,
        pitch: application.pitch,
        proposedFee: application.proposedFee,
        createdAt: application.createdAt.toISOString(),
        influencer: {
          id: application.influencer.id,
          displayName: application.influencer.displayName,
          avatarUrl: application.influencer.avatarUrl,
          city: application.influencer.city,
        },
      }));
    },
  );

  /** Att godkänna en ansökan är samma sak som att restaurangen swipar höger. */
  server.post(
    '/applications/:id/decision',
    {
      preHandler: app.requireRole('BUSINESS'),
      schema: {
        params: z.object({ id: z.string() }),
        body: z.object({ accept: z.boolean() }),
        response: {
          200: z.object({ status: applicationStatusSchema, matchId: z.string().nullable() }),
        },
      },
    },
    async (request) => {
      const businessId = requireProfileId(request);
      const application = await prisma.application.findUnique({
        where: { id: request.params.id },
        include: { campaign: true },
      });
      if (!application) throw notFound('Ansökan hittades inte.');
      if (application.campaign.businessId !== businessId) {
        throw forbidden('Ansökan tillhör en kampanj på ett annat konto.');
      }
      if (application.status !== 'PENDING') {
        throw badRequest('Ansökan är redan behandlad.');
      }

      const { match } = await recordSwipe(prisma, {
        campaignId: application.campaignId,
        influencerId: application.influencerId,
        actor: 'BUSINESS',
        direction: request.body.accept ? 'LIKE' : 'PASS',
        userId: request.user.sub,
      });

      const updated = await prisma.application.update({
        where: { id: application.id },
        data: { status: request.body.accept ? 'ACCEPTED' : 'REJECTED' },
      });
      return { status: updated.status, matchId: match?.id ?? null };
    },
  );
}

/** Kastar om den inloggade parten inte hör till matchen. */
async function assertMatchParty(
  services: Services,
  matchId: string,
  role: string,
  profileId: string,
): Promise<void> {
  const match = await services.prisma.match.findUnique({
    where: { id: matchId },
    include: { campaign: { select: { businessId: true } } },
  });
  if (!match) throw notFound('Matchen hittades inte.');

  const allowed =
    role === 'INFLUENCER'
      ? match.influencerId === profileId
      : match.campaign.businessId === profileId;
  if (!allowed) throw forbidden('Du är inte part i den här matchningen.');
}
