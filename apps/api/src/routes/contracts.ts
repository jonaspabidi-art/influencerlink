import { randomUUID } from 'node:crypto';
import type { DeliverableKind } from '@pacta/shared';
import {
  costPerMille,
  contractInputSchema,
  contractStatusSchema,
  daysLeftToReviewDraft,
  DEFAULT_FEE_SPLIT,
  deliverableKindSchema,
  deliveryProofInputSchema,
  draftReviewSchema,
  draftSchema,
  draftSubmitSchema,
  draftUploadRequestSchema,
  draftUploadTargetSchema,
  isDraftCleared,
  MAX_VIDEO_BYTES,
  paymentStatusSchema,
  problemSchema,
  canOfferUsageRights,
  splitFee,
  summariseMetrics,
  usageRightsPrice,
  USAGE_RIGHTS_MONTHS,
  type FeeSplit,
} from '@pacta/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { badRequest, forbidden, notFound, serviceUnavailable } from '../lib/errors.js';
import { StorageError } from '../services/storage.js';
import { createTikTokClient } from '../services/social/index.js';
import { refreshMetrics } from '../services/results.js';
import { recordAudit } from '../lib/audit.js';
import { requireProfileId } from '../plugins/auth.js';
import type { Services } from '../services/index.js';
import { renderContractTerms } from '../services/contracts.js';
import {
  payUsageRights,
  requestUsageRights,
  respondToUsageRights,
} from '../services/rights.js';
import { createEscrow, refundEscrow, releasePayout } from '../services/payments/escrow.js';

/** Tillägget om annonsering, så som parterna ser det. */
const usageRightsSchema = z.object({
  status: z.enum(['REQUESTED', 'ACCEPTED', 'DECLINED']),
  months: z.number().int(),
  amount: z.number().int(),
  creatorShare: z.number().int(),
  terms: z.string(),
  paymentStatus: paymentStatusSchema,
  respondedAt: z.string().nullable(),
});

const contractDetailSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  campaignTitle: z.string(),
  businessId: z.string(),
  businessName: z.string(),
  influencerId: z.string(),
  influencerName: z.string(),
  status: contractStatusSchema,
  /** Det avtalade arvodet. */
  fee: z.number().int(),
  /** Företagets del av avgiften, ovanpå arvodet. */
  businessFee: z.number().int(),
  /** Vad företaget betalar in: arvode plus deras avgift. */
  charge: z.number().int(),
  /** Kreatörens del, dragen från arvodet. */
  creatorFee: z.number().int(),
  /** Hela förmedlingsavgiften – båda delarna. */
  platformFee: z.number().int(),
  /** Vad kreatören får utbetalt. */
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
  const { prisma, payments, config } = services;

  /** Företaget skapar avtalsutkastet utifrån en match. */
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
          campaign: { include: { business: { include: { socials: true } } } },
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
        feeSplit: DEFAULT_FEE_SPLIT,
        dueDate: new Date(request.body.dueDate),
        reviewDays: request.body.reviewDays,
        extraTerms: request.body.extraTerms,
        businessAccounts: match.campaign.business.socials.map((social) => ({
          platform: social.platform,
          handle: social.handle,
        })),
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

  /** Företaget betalar in arvodet till spärrat konto. */
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

  // --- Resultat ------------------------------------------------------------

  /**
   * Vad samarbetet gav.
   *
   * Utan den här siffran har företaget inget att gå på när den ska avgöra
   * om den ska köra igen. Den hämtas när någon tittar, uppdateras medan
   * mätfönstret är öppet och fryses därefter.
   */
  server.get(
    '/contracts/:id/results',
    {
      preHandler: app.requireRole('INFLUENCER', 'BUSINESS'),
      schema: {
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({
            /** Null tills något publicerats. */
            measuredAt: z.string().nullable(),
            final: z.boolean(),
            views: z.number().int(),
            likes: z.number().int(),
            comments: z.number().int(),
            shares: z.number().int(),
            engagementRate: z.number(),
            /** Arvodet delat på visningar, per tusen. Noll utan visningar. */
            costPerMille: z.number().int(),
            posts: z.array(
              z.object({
                url: z.string(),
                platform: z.string(),
                views: z.number().int(),
                likes: z.number().int(),
                comments: z.number().int(),
                shares: z.number().int(),
              }),
            ),
            /** Tillägget om annonsering, när det finns ett. */
            usageRights: usageRightsSchema.nullable(),
            /**
             * Vad tillägget skulle kosta, när det går att fråga. Null annars –
             * en förstagångsköpare ska inte se erbjudandet innan det finns ett
             * resultat att bedöma det mot.
             */
            usageRightsOffer: z
              .object({
                amount: z.number().int(),
                creatorShare: z.number().int(),
                months: z.number().int(),
              })
              .nullable(),
          }),
          403: problemSchema,
          404: problemSchema,
        },
      },
    },
    async (request) => {
      const contract = await loadContractForParty(services, request.params.id, request);

      const delivery = await prisma.delivery.findUnique({
        where: { contractId: contract.id },
        select: { urls: true },
      });
      await refreshMetrics(prisma, createTikTokClient(config), {
        id: contract.id,
        influencerId: contract.influencerId,
        deliveredAt: contract.deliveredAt,
        delivery,
      });

      const metrics = await prisma.postMetric.findMany({
        where: { contractId: contract.id },
        orderBy: { views: 'desc' },
      });
      const totals = summariseMetrics(metrics);

      const rights = await prisma.usageRights.findUnique({
        where: { contractId: contract.id },
      });
      const price = usageRightsPrice(contract.fee);
      const canOffer = canOfferUsageRights({
        deliveredAt: contract.deliveredAt,
        views: totals.views,
        existing: rights !== null,
      });

      return {
        usageRights: rights ? toUsageRights(rights) : null,
        usageRightsOffer: canOffer
          ? {
              amount: price.amount,
              creatorShare: price.creatorShare,
              months: USAGE_RIGHTS_MONTHS,
            }
          : null,
        measuredAt: metrics[0]?.measuredAt.toISOString() ?? null,
        final: metrics.length > 0 && metrics.every((metric) => metric.final),
        ...totals,
        costPerMille: costPerMille(contract.fee, totals.views),
        posts: metrics.map((metric) => ({
          url: metric.url,
          platform: metric.platform as string,
          views: metric.views,
          likes: metric.likes,
          comments: metric.comments,
          shares: metric.shares,
        })),
      };
    },
  );

  // --- Videoutkast ---------------------------------------------------------

  /*
   * Kreatören lämnar filmen för godkännande innan den publiceras. Företaget
   * ser vad som ska ut, och får samtidigt filen – det är den nyttjanderätten i
   * avtalet vilar på. Svarar företaget inte i tid räknas utkastet som
   * godkänt, så att ett tyst kök aldrig blockerar kreatören.
   */

  server.post(
    '/contracts/:id/drafts/upload-url',
    {
      preHandler: app.requireRole('INFLUENCER'),
      schema: {
        params: z.object({ id: z.string() }),
        body: draftUploadRequestSchema,
        response: { 200: draftUploadTargetSchema, 400: problemSchema, 503: problemSchema },
      },
    },
    async (request) => {
      const store = requireStorage();
      const contract = await loadContractForParty(services, request.params.id, request);
      if (contract.status !== 'ACTIVE') {
        throw badRequest('Avtalet måste vara aktivt innan du kan lämna ett utkast.');
      }
      if (request.body.sizeBytes > MAX_VIDEO_BYTES) {
        throw badRequest('Filmen är för stor. Exportera i 1080p i stället för 4K.');
      }

      // Sökvägen bär avtalet och en slumpdel, så att två uppladdningar aldrig
      // skriver över varandra och ingen kan gissa sig till någon annans fil.
      const extension = extensionFor(request.body.contentType);
      const path = `${contract.id}/${randomUUID()}${extension}`;
      try {
        const target = await store.createUploadTarget(path, request.body.contentType);
        return { uploadUrl: target.url, storagePath: target.path };
      } catch (caught) {
        if (caught instanceof StorageError) {
          request.log.warn({ code: caught.code }, 'kunde inte skapa uppladdningsadress');
          throw badRequest(caught.message);
        }
        throw caught;
      }
    },
  );

  server.post(
    '/contracts/:id/drafts',
    {
      preHandler: app.requireRole('INFLUENCER'),
      schema: {
        params: z.object({ id: z.string() }),
        body: draftSubmitSchema,
        response: { 200: draftSchema, 400: problemSchema, 503: problemSchema },
      },
    },
    async (request) => {
      const store = requireStorage();
      const contract = await loadContractForParty(services, request.params.id, request);
      if (contract.status !== 'ACTIVE') {
        throw badRequest('Avtalet måste vara aktivt innan du kan lämna ett utkast.');
      }
      // Filen måste ligga under det här avtalets prefix. Annars skulle en
      // kreatör kunna peka på någon annans uppladdning.
      if (!request.body.storagePath.startsWith(`${contract.id}/`)) {
        throw badRequest('Filen hör inte till det här avtalet.');
      }

      const latest = await prisma.draft.findFirst({
        where: { contractId: contract.id },
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      const draft = await prisma.draft.create({
        data: {
          contractId: contract.id,
          version: (latest?.version ?? 0) + 1,
          storagePath: request.body.storagePath,
          contentType: request.body.contentType,
          fileName: request.body.fileName,
          sizeBytes: request.body.sizeBytes,
          note: request.body.note,
        },
      });
      await recordAudit(prisma, {
        userId: request.user.sub,
        action: 'draft.submitted',
        entityType: 'Draft',
        entityId: draft.id,
        metadata: { contractId: contract.id, version: draft.version },
      });

      return toPublicDraft(draft, contract.reviewDays, await playbackUrl(store, draft.storagePath));
    },
  );

  server.get(
    '/contracts/:id/drafts',
    {
      preHandler: app.requireRole('INFLUENCER', 'BUSINESS'),
      schema: {
        params: z.object({ id: z.string() }),
        response: { 200: z.array(draftSchema), 403: problemSchema, 404: problemSchema },
      },
    },
    async (request) => {
      const contract = await loadContractForParty(services, request.params.id, request);
      const drafts = await prisma.draft.findMany({
        where: { contractId: contract.id },
        orderBy: { version: 'desc' },
      });

      const store = services.storage;
      return Promise.all(
        drafts.map(async (draft) =>
          toPublicDraft(draft, contract.reviewDays, await playbackUrl(store, draft.storagePath)),
        ),
      );
    },
  );

  server.post(
    '/drafts/:id/review',
    {
      preHandler: app.requireRole('BUSINESS'),
      schema: {
        params: z.object({ id: z.string() }),
        body: draftReviewSchema,
        response: { 200: draftSchema, 400: problemSchema, 403: problemSchema, 404: problemSchema },
      },
    },
    async (request) => {
      const draft = await prisma.draft.findUnique({
        where: { id: request.params.id },
        include: {
          contract: {
            select: {
              id: true,
              reviewDays: true,
              // Avtalet har ingen egen företagsreferens – den går via kampanjen.
              campaign: { select: { businessId: true } },
            },
          },
        },
      });
      if (!draft) throw notFound('Utkastet hittades inte.');
      if (draft.contract.campaign.businessId !== requireProfileId(request)) {
        throw forbidden('Utkastet hör till ett annat avtal.');
      }
      if (draft.status !== 'PENDING') {
        throw badRequest('Utkastet är redan besvarat.');
      }
      // En begärd ändring utan motivering ger kreatören inget att gå på.
      if (!request.body.approve && request.body.note.trim().length < 3) {
        throw badRequest('Skriv vad som ska ändras.');
      }

      const updated = await prisma.draft.update({
        where: { id: draft.id },
        data: {
          status: request.body.approve ? 'APPROVED' : 'CHANGES_REQUESTED',
          reviewNote: request.body.note.trim(),
          reviewedAt: new Date(),
        },
      });
      await recordAudit(prisma, {
        userId: request.user.sub,
        action: request.body.approve ? 'draft.approved' : 'draft.changes_requested',
        entityType: 'Draft',
        entityId: draft.id,
        metadata: { contractId: draft.contract.id, version: draft.version },
      });

      return toPublicDraft(
        updated,
        draft.contract.reviewDays,
        await playbackUrl(services.storage, updated.storagePath),
      );
    },
  );

  function requireStorage() {
    if (!services.storage) {
      throw serviceUnavailable(
        'Uppladdning av utkast är inte påslaget än. Skicka filmen på annat sätt så länge.',
      );
    }
    return services.storage;
  }

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

      /*
       * Avtalet säger att materialet lämnas för godkännande före publicering,
       * så leveransen kräver ett utkast som är klart. Utan lagring uppsatt
       * finns inget utkast att kräva, och då hoppas steget över.
       */
      if (services.storage) {
        const latest = await prisma.draft.findFirst({
          where: { contractId: contract.id },
          orderBy: { version: 'desc' },
        });
        if (!latest) {
          throw badRequest('Lämna filmen för godkännande innan du rapporterar leverans.');
        }
        if (!isDraftCleared(latest, contract.reviewDays)) {
          throw badRequest(
            latest.status === 'CHANGES_REQUESTED'
              ? 'Företaget har bett om en ändring. Ladda upp en ny version först.'
              : 'Utkastet väntar på företagets godkännande.',
          );
        }
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

  /** Företaget godkänner leveransen, vilket frigör utbetalningen. */
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

  /**
   * Företaget frågar om annonsrätt.
   *
   * Erbjudandet finns bara där det hör hemma: i resultatvyn, när filmen har
   * visningar. Tjänsten avvisar förfrågan om den kommer för tidigt.
   */
  server.post(
    '/contracts/:id/usage-rights',
    {
      preHandler: app.requireRole('BUSINESS'),
      schema: {
        params: z.object({ id: z.string() }),
        response: { 200: usageRightsSchema, 400: problemSchema, 409: problemSchema },
      },
    },
    async (request) => {
      const contract = await loadContractForParty(services, request.params.id, request);
      const rights = await requestUsageRights(prisma, {
        contractId: contract.id,
        userId: request.user.sub,
      });
      return toUsageRights(rights);
    },
  );

  /** Kreatören svarar ja eller nej. Ett nej stänger frågan. */
  server.post(
    '/contracts/:id/usage-rights/respond',
    {
      preHandler: app.requireRole('INFLUENCER'),
      schema: {
        params: z.object({ id: z.string() }),
        body: z.object({ accept: z.boolean() }),
        response: { 200: usageRightsSchema, 400: problemSchema, 409: problemSchema },
      },
    },
    async (request) => {
      const contract = await loadContractForParty(services, request.params.id, request);
      const rights = await respondToUsageRights(prisma, {
        contractId: contract.id,
        userId: request.user.sub,
        accept: request.body.accept,
      });
      return toUsageRights(rights);
    },
  );

  /** Företaget betalar tillägget när kreatören sagt ja. */
  server.post(
    '/contracts/:id/usage-rights/pay',
    {
      preHandler: app.requireRole('BUSINESS'),
      schema: {
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({ clientSecret: z.string(), amount: z.number().int() }),
          400: problemSchema,
          409: problemSchema,
        },
      },
    },
    async (request) => {
      const contract = await loadContractForParty(services, request.params.id, request);
      return payUsageRights(prisma, payments, {
        contractId: contract.id,
        userId: request.user.sub,
      });
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

      // Eventuella inbetalda pengar går tillbaka till företaget.
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
  businessFeeBps: number;
  creatorFeeBps: number;
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

/** Tillägget i den form appen läser det. */
function toUsageRights(rights: {
  status: string;
  months: number;
  amount: number;
  creatorShare: number;
  terms: string;
  paymentStatus: string;
  respondedAt: Date | null;
}) {
  return {
    status: rights.status as 'REQUESTED' | 'ACCEPTED' | 'DECLINED',
    months: rights.months,
    amount: rights.amount,
    creatorShare: rights.creatorShare,
    terms: rights.terms,
    paymentStatus: rights.paymentStatus as 'PENDING' | 'ESCROWED' | 'RELEASED' | 'REFUNDED' | 'FAILED',
    respondedAt: rights.respondedAt?.toISOString() ?? null,
  };
}

/** Avgiftsfördelningen som sparades på avtalet när det tecknades. */
function feeSplitOf(contract: { businessFeeBps: number; creatorFeeBps: number }): FeeSplit {
  return { businessFeeBps: contract.businessFeeBps, creatorFeeBps: contract.creatorFeeBps };
}

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
  const breakdown = splitFee(contract.fee, feeSplitOf(contract));
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
    fee: breakdown.fee,
    businessFee: breakdown.businessFee,
    charge: breakdown.charge,
    creatorFee: breakdown.creatorFee,
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

/** Uppspelningsadressen är signerad och kortlivad, så den hämtas vid varje läsning. */
async function playbackUrl(
  store: Services['storage'],
  storagePath: string,
): Promise<string | null> {
  if (!store) return null;
  try {
    return await store.createPlaybackUrl(storagePath);
  } catch {
    // En trasig adress ska inte fälla hela listan – raden syns ändå.
    return null;
  }
}

type DraftRow = {
  id: string;
  version: number;
  status: 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED';
  fileName: string;
  contentType: string;
  sizeBytes: number;
  note: string;
  reviewNote: string;
  submittedAt: Date;
  reviewedAt: Date | null;
  autoApproved: boolean;
};

function toPublicDraft(draft: DraftRow, reviewDays: number, playback: string | null) {
  return {
    id: draft.id,
    version: draft.version,
    status: draft.status,
    fileName: draft.fileName,
    contentType: draft.contentType,
    sizeBytes: draft.sizeBytes,
    note: draft.note,
    reviewNote: draft.reviewNote,
    submittedAt: draft.submittedAt.toISOString(),
    reviewedAt: draft.reviewedAt?.toISOString() ?? null,
    autoApproved: draft.autoApproved,
    playbackUrl: playback,
    daysLeftToReview:
      draft.status === 'PENDING' ? daysLeftToReviewDraft(draft.submittedAt, reviewDays) : 0,
    cleared: isDraftCleared(draft, reviewDays),
  };
}

/** Filändelsen som hör till innehållstypen. Lagringen bryr sig inte, men människor gör det. */
function extensionFor(contentType: string): string {
  if (contentType === 'video/quicktime') return '.mov';
  if (contentType === 'video/webm') return '.webm';
  return '.mp4';
}
