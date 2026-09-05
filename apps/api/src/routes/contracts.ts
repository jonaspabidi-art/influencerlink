import type { DeliverableKind } from '@pacta/shared';
import {
  contractInputSchema,
  contractStatusSchema,
  deliverableKindSchema,
  deliveryProofInputSchema,
  paymentStatusSchema,
  problemSchema,
  splitFee,
} from '@pacta/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { recordAudit } from '../lib/audit.js';
import { requireProfileId } from '../plugins/auth.js';
import type { Services } from '../services/index.js';
import { renderContractTerms } from '../services/contracts.js';
import { createEscrow, refundEscrow, releasePayout } from '../services/payments/escrow.js';

const contractDetailSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  campaignTitle: z.string(),
  businessId: z.string(),
  businessName: z.string(),
  influencerId: z.string(),
  influencerName: z.string(),
  status: contractStatusSchema,
  fee: z.number().int(),
  platformFee: z.number().int(),
  payout: z.number().int(),
  deliverables: z.array(deliverableKindSchema),
  dueDate: z.string(),
  reviewDays: z.number().int(),
  terms: z.string(),
  signedByInfluencerAt: z.string().nullable(),
  signedByBusinessAt: z.string().nullable(),
  deliveredAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  paymentStatus: paymentStatusSchema.nullable(),
  /** Sant för den part som ännu inte har signerat. */
  awaitingMySignature: z.boolean(),
});

export async function contractRoutes(app: FastifyInstance, services: Services): Promise<void> {
  const server = app.withTypeProvider<ZodTypeProvider>();
  const { prisma, payments } = services;

  /** Restaurangen skapar avtalsutkastet utifrån en match. */
  server.post(
    '/contracts',
    {
      preHandler: app.requireRole('BUSINESS'),
      schema: {
        body: contractInputSchema,
        response: { 200: contractDetailSchema, 400: problemSchema, 403: problemSchema },
      },
    },
    async (request) => {
      const businessId = requireProfileId(request);
      const match = await prisma.match.findUnique({
        where: { id: request.body.matchId },
        include: {
          campaign: { include: { business: true } },
          influencer: { include: { user: true } },
          contracts: { where: { status: { not: 'CANCELLED' } }, select: { id: true } },
        },
      });
      if (!match) throw notFound('Matchningen hittades inte.');
      if (match.campaign.businessId !== businessId) {
        throw forbidden('Matchningen tillhör ett annat konto.');
      }
      if (match.contracts.length > 0) {
        throw badRequest('Det finns redan ett avtal för den här matchningen.');
      }

      const contractId = crypto.randomUUID();
      const terms = renderContractTerms({
        contractId,
        businessName: match.campaign.business.companyName,
        businessOrgNumber: match.campaign.business.orgNumber,
        influencerName: match.influencer.displayName,
        influencerPersonalNumberMask: match.influencer.user.personalNumberMask ?? 'okänt',
        campaignTitle: match.campaign.title,
        campaignBrief: match.campaign.brief,
        deliverables: request.body.deliverables,
        fee: request.body.fee,
        platformFeeBps: 1200,
        dueDate: new Date(request.body.dueDate),
        reviewDays: request.body.reviewDays,
        extraTerms: request.body.extraTerms,
      });

      const contract = await prisma.contract.create({
        data: {
          id: contractId,
          matchId: match.id,
          campaignId: match.campaignId,
          influencerId: match.influencerId,
          fee: request.body.fee,
          deliverables: request.body.deliverables,
          dueDate: new Date(request.body.dueDate),
          reviewDays: request.body.reviewDays,
          terms,
          status: 'SENT',
        },
        include: contractInclude,
      });

      await prisma.match.update({ where: { id: match.id }, data: { status: 'CONTRACTED' } });
      await recordAudit(prisma, {
        userId: request.user.sub,
        action: 'contract.created',
        entityType: 'Contract',
        entityId: contract.id,
        metadata: { fee: contract.fee, matchId: match.id },
      });

      return toContractDetail(contract, request.user.role, request.user.sub);
    },
  );

  server.get(
    '/contracts',
    {
      preHandler: app.requireRole('INFLUENCER', 'BUSINESS'),
      schema: { response: { 200: z.array(contractDetailSchema) } },
    },
    async (request) => {
      const profileId = requireProfileId(request);
      const contracts = await prisma.contract.findMany({
        where:
          request.user.role === 'INFLUENCER'
            ? { influencerId: profileId }
            : { campaign: { businessId: profileId } },
        include: contractInclude,
        orderBy: { createdAt: 'desc' },
      });
      return contracts.map((contract) =>
        toContractDetail(contract, request.user.role, request.user.sub),
      );
    },
  );

  server.get(
    '/contracts/:id',
    {
      preHandler: app.requireRole('INFLUENCER', 'BUSINESS'),
      schema: {
        params: z.object({ id: z.string() }),
        response: { 200: contractDetailSchema, 403: problemSchema, 404: problemSchema },
      },
    },
    async (request) => {
      const contract = await loadContractForParty(services, request.params.id, request);
      return toContractDetail(contract, request.user.role, request.user.sub);
    },
  );

  /** Restaurangen betalar in arvodet till spärrat konto. */
  server.post(
    '/contracts/:id/payment',
    {
      preHandler: app.requireRole('BUSINESS'),
      schema: {
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({
            clientSecret: z.string(),
            amount: z.number().int(),
            paymentId: z.string(),
          }),
          400: problemSchema,
        },
      },
    },
    async (request) => {
      await loadContractForParty(services, request.params.id, request);
      return createEscrow(prisma, payments, {
        contractId: request.params.id,
        userId: request.user.sub,
      });
    },
  );

  /** Influencern rapporterar in de publicerade länkarna. */
  server.post(
    '/contracts/:id/delivery',
    {
      preHandler: app.requireRole('INFLUENCER'),
      schema: {
        params: z.object({ id: z.string() }),
        body: deliveryProofInputSchema,
        response: { 200: contractDetailSchema, 400: problemSchema },
      },
    },
    async (request) => {
      const contract = await loadContractForParty(services, request.params.id, request);
      if (contract.status !== 'ACTIVE') {
        throw badRequest('Avtalet måste vara aktivt innan du kan rapportera leverans.');
      }

      await prisma.delivery.upsert({
        where: { contractId: contract.id },
        create: { contractId: contract.id, urls: request.body.urls, note: request.body.note },
        update: { urls: request.body.urls, note: request.body.note, submittedAt: new Date() },
      });
      const updated = await prisma.contract.update({
        where: { id: contract.id },
        data: { status: 'DELIVERED', deliveredAt: new Date() },
        include: contractInclude,
      });
      await recordAudit(prisma, {
        userId: request.user.sub,
        action: 'contract.delivered',
        entityType: 'Contract',
        entityId: contract.id,
        metadata: { urls: request.body.urls },
      });
      return toContractDetail(updated, request.user.role, request.user.sub);
    },
  );

  /** Restaurangen godkänner leveransen, vilket frigör utbetalningen. */
  server.post(
    '/contracts/:id/approve',
    {
      preHandler: app.requireRole('BUSINESS'),
      schema: {
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({ status: contractStatusSchema, payout: z.number().int() }),
          400: problemSchema,
        },
      },
    },
    async (request) => {
      const contract = await loadContractForParty(services, request.params.id, request);
      if (contract.status !== 'DELIVERED') {
        throw badRequest('Det finns ingen inrapporterad leverans att godkänna.');
      }

      const result = await releasePayout(prisma, payments, {
        contractId: contract.id,
        userId: request.user.sub,
      });
      await prisma.$transaction([
        prisma.delivery.update({
          where: { contractId: contract.id },
          data: { approvedAt: new Date() },
        }),
        prisma.contract.update({
          where: { id: contract.id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        }),
      ]);
      return { status: 'COMPLETED' as const, payout: result.payout };
    },
  );

  server.post(
    '/contracts/:id/cancel',
    {
      preHandler: app.requireRole('INFLUENCER', 'BUSINESS'),
      schema: {
        params: z.object({ id: z.string() }),
        body: z.object({ reason: z.string().min(3).max(500) }),
        response: { 200: z.object({ status: contractStatusSchema }), 400: problemSchema },
      },
    },
    async (request) => {
      const contract = await loadContractForParty(services, request.params.id, request);
      if (contract.status === 'COMPLETED' || contract.status === 'CANCELLED') {
        throw badRequest('Avtalet går inte att avbryta i sitt nuvarande läge.');
      }

      // Eventuella inbetalda pengar går tillbaka till restaurangen.
      await refundEscrow(prisma, payments, {
        contractId: contract.id,
        userId: request.user.sub,
        reason: request.body.reason,
      });
      await prisma.contract.update({
        where: { id: contract.id },
        data: { status: 'CANCELLED' },
      });
      await recordAudit(prisma, {
        userId: request.user.sub,
        action: 'contract.cancelled',
        entityType: 'Contract',
        entityId: contract.id,
        metadata: { reason: request.body.reason, by: request.user.role },
      });
      return { status: 'CANCELLED' as const };
    },
  );
}

const contractInclude = {
  campaign: { include: { business: true } },
  influencer: { include: { user: { select: { id: true } } } },
  payment: true,
} as const;

type ContractRow = {
  id: string;
  campaignId: string;
  influencerId: string;
  status: 'DRAFT' | 'SENT' | 'PARTIALLY_SIGNED' | 'ACTIVE' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED';
  fee: number;
  platformFeeBps: number;
  deliverables: DeliverableKind[];
  dueDate: Date;
  reviewDays: number;
  terms: string;
  signedByInfluencerAt: Date | null;
  signedByBusinessAt: Date | null;
  deliveredAt: Date | null;
  completedAt: Date | null;
  campaign: { title: string; businessId: string; business: { companyName: string; userId: string } };
  influencer: { displayName: string; userId: string };
  payment: { status: 'PENDING' | 'ESCROWED' | 'RELEASED' | 'REFUNDED' | 'FAILED' } | null;
};

async function loadContractForParty(
  services: Services,
  contractId: string,
  request: { user: { role: string; sub: string; pid?: string } },
): Promise<ContractRow> {
  const contract = await services.prisma.contract.findUnique({
    where: { id: contractId },
    include: contractInclude,
  });
  if (!contract) throw notFound('Avtalet hittades inte.');

  const allowed =
    request.user.role === 'INFLUENCER'
      ? contract.influencer.userId === request.user.sub
      : contract.campaign.business.userId === request.user.sub;
  if (!allowed) throw forbidden('Du är inte part i det här avtalet.');
  return contract;
}

function toContractDetail(contract: ContractRow, role: string, _userId: string) {
  const breakdown = splitFee(contract.fee, contract.platformFeeBps);
  const mySignature =
    role === 'INFLUENCER' ? contract.signedByInfluencerAt : contract.signedByBusinessAt;

  return {
    id: contract.id,
    campaignId: contract.campaignId,
    campaignTitle: contract.campaign.title,
    businessId: contract.campaign.businessId,
    businessName: contract.campaign.business.companyName,
    influencerId: contract.influencerId,
    influencerName: contract.influencer.displayName,
    status: contract.status,
    fee: breakdown.gross,
    platformFee: breakdown.platformFee,
    payout: breakdown.net,
    deliverables: contract.deliverables,
    dueDate: contract.dueDate.toISOString(),
    reviewDays: contract.reviewDays,
    terms: contract.terms,
    signedByInfluencerAt: contract.signedByInfluencerAt?.toISOString() ?? null,
    signedByBusinessAt: contract.signedByBusinessAt?.toISOString() ?? null,
    deliveredAt: contract.deliveredAt?.toISOString() ?? null,
    completedAt: contract.completedAt?.toISOString() ?? null,
    paymentStatus: contract.payment?.status ?? null,
    awaitingMySignature:
      mySignature === null && (contract.status === 'SENT' || contract.status === 'PARTIALLY_SIGNED'),
  };
}
