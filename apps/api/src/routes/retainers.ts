import { randomUUID } from 'node:crypto';
import {
  MAX_VIDEO_BYTES,
  PREPAY_DISCOUNT_CHOICES,
  PREPAY_MONTHS,
  RETAINER_PACKAGES,
  VIDEO_MIME_TYPES,
  MAX_RETAINER_BASE_RATE,
  MIN_RETAINER_BASE_RATE,
  PREPAY_DISCOUNT_CHOICES as DISCOUNTS,
  PLATFORMS,
  problemSchema,
  retainerPackages,
} from '@pacta/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { badRequest, conflict, failedDependency, notFound } from '../lib/errors.js';
import { requireProfileId } from '../plugins/auth.js';
import type { Services } from '../services/index.js';
import {
  cancelRetainer,
  closePeriod,
  deliveredCount,
  payPeriod,
  requestRetainer,
  respondToRequest,
} from '../services/retainers.js';
import { buildRateSuggestion } from '../services/pricing.js';
import { StorageError } from '../services/storage.js';

const postSchema = z.object({
  id: z.string(),
  platform: z.string(),
  fileName: z.string(),
  caption: z.string(),
  note: z.string(),
  status: z.enum(['PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'PUBLISHED']),
  revision: z.number().int(),
  reviewNote: z.string(),
  submittedAt: z.string(),
  publishedAt: z.string().nullable(),
  publishedUrl: z.string().nullable(),
  /** Signerad adress för uppspelning. Null när lagringen inte är konfigurerad. */
  playbackUrl: z.string().nullable(),
});

const periodSchema = z.object({
  id: z.string(),
  index: z.number().int(),
  startsAt: z.string(),
  endsAt: z.string(),
  videosAgreed: z.number().int(),
  videosDelivered: z.number().int(),
  grossAmount: z.number().int(),
  chargeAmount: z.number().int(),
  releasedAmount: z.number().int(),
  refundedAmount: z.number().int(),
  status: z.enum(['AWAITING_PAYMENT', 'ACTIVE', 'CLOSED']),
  posts: z.array(postSchema),
});

const retainerSchema = z.object({
  id: z.string(),
  status: z.enum(['REQUESTED', 'DECLINED', 'ACTIVE', 'CANCELLING', 'ENDED']),
  videosPerMonth: z.number().int(),
  listRate: z.number().int(),
  monthlyRate: z.number().int(),
  prepaidMonths: z.number().int(),
  requestNote: z.string(),
  businessId: z.string(),
  businessName: z.string(),
  businessLogoUrl: z.string().nullable(),
  influencerId: z.string(),
  influencerName: z.string(),
  influencerAvatarUrl: z.string().nullable(),
  accessGranted: z.boolean(),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  createdAt: z.string(),
});

const retainerDetailSchema = retainerSchema.extend({
  terms: z.string(),
  periods: z.array(periodSchema),
});

/** Samma stege för båda rabatterna hon kan ge. */
const discountSchema = z.union([
  z.literal(DISCOUNTS[0]),
  z.literal(DISCOUNTS[1]),
  z.literal(DISCOUNTS[2]),
  z.literal(DISCOUNTS[3]),
]);

const availabilitySchema = z.object({
  acceptsRetainers: z.boolean(),
  slots: z.number().int().min(0).max(20),
  /** Månadspris för grundpaketet, i öre. Null när hon inte satt något. */
  baseRate: z.number().int().nullable(),
  /** Rabatter hon ger, i baspunkter. Noll = ingen. */
  prepayDiscountBps: z.number().int(),
  volumeDiscountBps: z.number().int(),
  packages: z.array(
    z.object({ videosPerMonth: z.number().int(), monthlyRate: z.number().int() }),
  ),
});

const rateSuggestionSchema = z.object({
  city: z.string(),
  low: z.number().int(),
  mid: z.number().int(),
  high: z.number().int(),
  confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  /**
   * Antal jämförbara kreatörer. Deras enskilda priser lämnar aldrig servern –
   * de har lämnat dem för matchningens skull, inte för konkurrenternas insyn.
   */
  peerCount: z.number().int(),
  peerMedian: z.number().int().nullable(),
  basis: z.array(z.string()),
});

/**
 * Löpande uppdrag.
 *
 * Skilt från kontrakten med flit: här produceras innehåll åt företagets egna
 * kanaler, månad efter månad, och pengarna rör sig per period i stället för i
 * ett enda avslut. Kreatören publicerar i företagets namn, vilket är varför
 * varje video måste godkännas och varför ingenting auto-godkänns.
 */
export async function retainerRoutes(app: FastifyInstance, services: Services): Promise<void> {
  const server = app.withTypeProvider<ZodTypeProvider>();
  const { prisma, payments, storage, ai } = services;

  const playback = async (path: string): Promise<string | null> => {
    if (!storage) return null;
    try {
      return await storage.createPlaybackUrl(path);
    } catch {
      return null;
    }
  };

  const toPost = async (post: {
    id: string;
    platform: string;
    fileName: string;
    caption: string;
    note: string;
    status: string;
    revision: number;
    reviewNote: string;
    submittedAt: Date;
    publishedAt: Date | null;
    publishedUrl: string | null;
    storagePath: string;
  }) => ({
    id: post.id,
    platform: post.platform,
    fileName: post.fileName,
    caption: post.caption,
    note: post.note,
    status: post.status as 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED' | 'PUBLISHED',
    revision: post.revision,
    reviewNote: post.reviewNote,
    submittedAt: post.submittedAt.toISOString(),
    publishedAt: post.publishedAt?.toISOString() ?? null,
    publishedUrl: post.publishedUrl,
    playbackUrl: await playback(post.storagePath),
  });

  /** Uppdraget som båda parter ser det. Beloppen är desamma; rollen avgör vad appen visar. */
  function toRetainer(retainer: {
    id: string;
    status: string;
    videosPerMonth: number;
    listRate: number;
    monthlyRate: number;
    prepaidMonths: number;
    requestNote: string;
    accessGrantedAt: Date | null;
    accessRevokedAt: Date | null;
    startedAt: Date | null;
    endedAt: Date | null;
    createdAt: Date;
    business: { id: string; companyName: string; logoUrl: string | null };
    influencer: { id: string; displayName: string; avatarUrl: string | null };
  }) {
    return {
      id: retainer.id,
      status: retainer.status as 'REQUESTED' | 'DECLINED' | 'ACTIVE' | 'CANCELLING' | 'ENDED',
      videosPerMonth: retainer.videosPerMonth,
      listRate: retainer.listRate,
      monthlyRate: retainer.monthlyRate,
      prepaidMonths: retainer.prepaidMonths,
      requestNote: retainer.requestNote,
      businessId: retainer.business.id,
      businessName: retainer.business.companyName,
      businessLogoUrl: retainer.business.logoUrl,
      influencerId: retainer.influencer.id,
      influencerName: retainer.influencer.displayName,
      influencerAvatarUrl: retainer.influencer.avatarUrl,
      accessGranted:
        retainer.accessGrantedAt !== null && retainer.accessRevokedAt === null,
      startedAt: retainer.startedAt?.toISOString() ?? null,
      endedAt: retainer.endedAt?.toISOString() ?? null,
      createdAt: retainer.createdAt.toISOString(),
    };
  }

  /** Laddar ett uppdrag och kontrollerar att den som frågar är part i det. */
  async function loadForParty(id: string, role: string, profileId: string) {
    const retainer = await prisma.retainer.findUnique({
      where: { id },
      include: {
        business: true,
        influencer: true,
        periods: { orderBy: { index: 'asc' }, include: { posts: { orderBy: { submittedAt: 'asc' } } } },
      },
    });
    if (!retainer) throw notFound('Uppdraget hittades inte.');
    const isParty =
      (role === 'BUSINESS' && retainer.businessId === profileId) ||
      (role === 'INFLUENCER' && retainer.influencerId === profileId);
    if (!isParty) throw notFound('Uppdraget hittades inte.');
    return retainer;
  }

  // --- Kreatörens tillgänglighet -------------------------------------------

  server.get(
    '/me/retainer-availability',
    {
      preHandler: app.requireRole('INFLUENCER'),
      schema: { response: { 200: availabilitySchema } },
    },
    async (request) => {
      const profile = await prisma.influencerProfile.findUniqueOrThrow({
        where: { id: requireProfileId(request) },
      });
      return {
        acceptsRetainers: profile.acceptsRetainers,
        slots: profile.retainerSlots,
        baseRate: profile.retainerBaseRate,
        prepayDiscountBps: profile.retainerPrepayDiscountBps,
        volumeDiscountBps: profile.retainerVolumeDiscountBps,
        packages: profile.retainerBaseRate
          ? retainerPackages(profile.retainerBaseRate, profile.retainerVolumeDiscountBps)
          : [],
      };
    },
  );

  server.put(
    '/me/retainer-availability',
    {
      preHandler: app.requireRole('INFLUENCER'),
      schema: {
        body: z.object({
          acceptsRetainers: z.boolean(),
          slots: z.number().int().min(0).max(20),
          baseRate: z.number().int().min(MIN_RETAINER_BASE_RATE).max(MAX_RETAINER_BASE_RATE).nullable(),
          /** Hennes egna satser. Rabatterna dras på hennes arvode, inte på vår avgift. */
          prepayDiscountBps: discountSchema,
          volumeDiscountBps: discountSchema,
        }),
        response: { 200: availabilitySchema, 400: problemSchema },
      },
    },
    async (request) => {
      const { acceptsRetainers, slots, baseRate, prepayDiscountBps, volumeDiscountBps } =
        request.body;
      // Ett läge som säger "tar uppdrag" utan pris är ett löfte utan innehåll:
      // företaget ser en ledig plats men får inget att ta ställning till.
      if (acceptsRetainers && baseRate === null) {
        throw badRequest('Sätt ett månadspris innan du öppnar för löpande uppdrag.');
      }
      const profile = await prisma.influencerProfile.update({
        where: { id: requireProfileId(request) },
        data: {
          acceptsRetainers,
          retainerSlots: slots,
          retainerBaseRate: baseRate,
          retainerPrepayDiscountBps: prepayDiscountBps,
          retainerVolumeDiscountBps: volumeDiscountBps,
        },
      });
      return {
        acceptsRetainers: profile.acceptsRetainers,
        slots: profile.retainerSlots,
        baseRate: profile.retainerBaseRate,
        prepayDiscountBps: profile.retainerPrepayDiscountBps,
        volumeDiscountBps: profile.retainerVolumeDiscountBps,
        packages: profile.retainerBaseRate
          ? retainerPackages(profile.retainerBaseRate, profile.retainerVolumeDiscountBps)
          : [],
      };
    },
  );

  /**
   * Vad hon är värd i ett löpande uppdrag.
   *
   * Uträkningen först och rådet separat, som på insiktsvyn: talen är räknade
   * och kan visas direkt, medan modellen kostar ett anrop och några sekunder.
   */
  server.get(
    '/me/retainer-rate',
    {
      preHandler: app.requireRole('INFLUENCER'),
      schema: { response: { 200: rateSuggestionSchema } },
    },
    async (request) => {
      const { suggestion, city } = await buildRateSuggestion(prisma, requireProfileId(request));
      return {
        city,
        low: suggestion.low,
        mid: suggestion.mid,
        high: suggestion.high,
        confidence: suggestion.confidence,
        peerCount: suggestion.peerCount,
        peerMedian: suggestion.peerMedian,
        basis: suggestion.basis,
      };
    },
  );

  server.post(
    '/me/retainer-rate/advice',
    {
      preHandler: app.requireRole('INFLUENCER'),
      config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
      schema: {
        response: {
          200: z.object({ available: z.boolean(), advice: z.string().nullable() }),
        },
      },
    },
    async (request) => {
      const { suggestion, city } = await buildRateSuggestion(prisma, requireProfileId(request));
      return { available: ai.enabled, advice: await ai.adviseRate(city, suggestion) };
    },
  );

  // --- Uppdragen -----------------------------------------------------------

  server.get(
    '/retainers',
    {
      preHandler: app.requireRole('INFLUENCER', 'BUSINESS'),
      schema: { response: { 200: z.array(retainerSchema) } },
    },
    async (request) => {
      const profileId = requireProfileId(request);
      const rows = await prisma.retainer.findMany({
        where:
          request.user.role === 'BUSINESS'
            ? { businessId: profileId }
            : { influencerId: profileId },
        include: { business: true, influencer: true },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map(toRetainer);
    },
  );

  server.get(
    '/retainers/:id',
    {
      preHandler: app.requireRole('INFLUENCER', 'BUSINESS'),
      schema: {
        params: z.object({ id: z.string() }),
        response: { 200: retainerDetailSchema, 404: problemSchema },
      },
    },
    async (request) => {
      const retainer = await loadForParty(
        request.params.id,
        request.user.role,
        requireProfileId(request),
      );
      return {
        ...toRetainer(retainer),
        terms: retainer.terms,
        periods: await Promise.all(
          retainer.periods.map(async (period) => ({
            id: period.id,
            index: period.index,
            startsAt: period.startsAt.toISOString(),
            endsAt: period.endsAt.toISOString(),
            videosAgreed: period.videosAgreed,
            videosDelivered: deliveredCount(period.posts),
            grossAmount: period.grossAmount,
            chargeAmount: period.chargeAmount,
            releasedAmount: period.releasedAmount,
            refundedAmount: period.refundedAmount,
            status: period.status,
            posts: await Promise.all(period.posts.map(toPost)),
          })),
        ),
      };
    },
  );

  server.post(
    '/retainers',
    {
      preHandler: app.requireRole('BUSINESS'),
      schema: {
        body: z.object({
          influencerId: z.string().min(1),
          videosPerMonth: z.union([z.literal(4), z.literal(8), z.literal(12)]),
          prepaidMonths: z.union([z.literal(1), z.literal(PREPAY_MONTHS)]).default(1),
          note: z.string().max(1000).default(''),
        }),
        response: { 200: retainerSchema, 400: problemSchema, 409: problemSchema },
      },
    },
    async (request) => {
      const created = await requestRetainer(prisma, {
        businessId: requireProfileId(request),
        influencerId: request.body.influencerId,
        videosPerMonth: request.body.videosPerMonth,
        prepaidMonths: request.body.prepaidMonths,
        note: request.body.note,
        userId: request.user.sub,
      });
      const full = await prisma.retainer.findUniqueOrThrow({
        where: { id: created.id },
        include: { business: true, influencer: true },
      });
      return toRetainer(full);
    },
  );

  server.post(
    '/retainers/:id/respond',
    {
      preHandler: app.requireRole('INFLUENCER'),
      schema: {
        params: z.object({ id: z.string() }),
        body: z.object({ accept: z.boolean() }),
        response: { 200: retainerSchema, 404: problemSchema, 409: problemSchema },
      },
    },
    async (request) => {
      await respondToRequest(prisma, {
        retainerId: request.params.id,
        influencerId: requireProfileId(request),
        accept: request.body.accept,
        userId: request.user.sub,
      });
      const full = await prisma.retainer.findUniqueOrThrow({
        where: { id: request.params.id },
        include: { business: true, influencer: true },
      });
      return toRetainer(full);
    },
  );

  /**
   * Företaget bekräftar att kreatören fått åtkomst till kanalerna.
   *
   * Åtkomsten ges i plattformarnas egna verktyg, utanför Pacta – vi tar aldrig
   * emot ett lösenord. Det här är bara en kvittens, och den behövs för att
   * kreatören ska få publicera: utan den kan hon producera men inte lägga upp.
   */
  server.post(
    '/retainers/:id/access',
    {
      preHandler: app.requireRole('BUSINESS'),
      schema: {
        params: z.object({ id: z.string() }),
        body: z.object({ granted: z.boolean() }),
        response: { 200: retainerSchema, 404: problemSchema },
      },
    },
    async (request) => {
      await loadForParty(request.params.id, 'BUSINESS', requireProfileId(request));
      await prisma.retainer.update({
        where: { id: request.params.id },
        data: request.body.granted
          ? { accessGrantedAt: new Date(), accessRevokedAt: null }
          : { accessRevokedAt: new Date() },
      });
      const full = await prisma.retainer.findUniqueOrThrow({
        where: { id: request.params.id },
        include: { business: true, influencer: true },
      });
      return toRetainer(full);
    },
  );

  server.post(
    '/retainers/:id/cancel',
    {
      preHandler: app.requireRole('INFLUENCER', 'BUSINESS'),
      schema: {
        params: z.object({ id: z.string() }),
        response: { 200: retainerSchema, 404: problemSchema, 409: problemSchema },
      },
    },
    async (request) => {
      await loadForParty(request.params.id, request.user.role, requireProfileId(request));
      await cancelRetainer(prisma, {
        retainerId: request.params.id,
        userId: request.user.sub,
        actor: request.user.role === 'BUSINESS' ? 'BUSINESS' : 'INFLUENCER',
      });
      const full = await prisma.retainer.findUniqueOrThrow({
        where: { id: request.params.id },
        include: { business: true, influencer: true },
      });
      return toRetainer(full);
    },
  );

  // --- Perioder ------------------------------------------------------------

  server.post(
    '/retainer-periods/:id/payment',
    {
      preHandler: app.requireRole('BUSINESS'),
      schema: {
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({ clientSecret: z.string(), amount: z.number().int() }),
          404: problemSchema,
          409: problemSchema,
        },
      },
    },
    async (request) =>
      payPeriod(prisma, payments, {
        periodId: request.params.id,
        businessId: requireProfileId(request),
        userId: request.user.sub,
      }),
  );

  /**
   * Stänger en period och gör upp pengarna.
   *
   * Får bara köras när perioden löpt ut. Att stänga i förtid vore att avräkna
   * mot ett antal videor som fortfarande kunde ha blivit fler.
   */
  server.post(
    '/retainer-periods/:id/close',
    {
      preHandler: app.requireRole('ADMIN'),
      schema: {
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({ payout: z.number().int(), refund: z.number().int() }),
          400: problemSchema,
          404: problemSchema,
        },
      },
    },
    async (request) => {
      const period = await prisma.retainerPeriod.findUnique({ where: { id: request.params.id } });
      if (!period) throw notFound('Perioden hittades inte.');
      if (period.endsAt.getTime() > Date.now()) {
        throw badRequest('Perioden pågår fortfarande.');
      }
      return closePeriod(prisma, payments, {
        periodId: request.params.id,
        userId: request.user.sub,
      });
    },
  );

  // --- Videorna ------------------------------------------------------------

  server.post(
    '/retainer-periods/:id/posts/upload-url',
    {
      preHandler: app.requireRole('INFLUENCER'),
      schema: {
        params: z.object({ id: z.string() }),
        body: z.object({
          contentType: z.enum(VIDEO_MIME_TYPES),
          sizeBytes: z.number().int().positive(),
        }),
        response: {
          200: z.object({ uploadUrl: z.string(), storagePath: z.string() }),
          400: problemSchema,
          503: problemSchema,
        },
      },
    },
    async (request) => {
      if (!storage) throw failedDependency('Fillagringen är inte konfigurerad.');
      const period = await prisma.retainerPeriod.findUnique({
        where: { id: request.params.id },
        include: { retainer: true },
      });
      if (!period || period.retainer.influencerId !== requireProfileId(request)) {
        throw notFound('Perioden hittades inte.');
      }
      if (period.status === 'CLOSED') throw conflict('Perioden är avslutad.');
      if (request.body.sizeBytes > MAX_VIDEO_BYTES) {
        throw badRequest('Filmen är för stor. Exportera i 1080p i stället för 4K.');
      }

      const extension =
        request.body.contentType === 'video/quicktime'
          ? '.mov'
          : request.body.contentType === 'video/webm'
            ? '.webm'
            : '.mp4';
      try {
        const target = await storage.createUploadTarget(
          `retainer/${period.id}/${randomUUID()}${extension}`,
          request.body.contentType,
        );
        return { uploadUrl: target.url, storagePath: target.path };
      } catch (caught) {
        if (caught instanceof StorageError) throw badRequest(caught.message);
        throw caught;
      }
    },
  );

  server.post(
    '/retainer-periods/:id/posts',
    {
      preHandler: app.requireRole('INFLUENCER'),
      schema: {
        params: z.object({ id: z.string() }),
        body: z.object({
          storagePath: z.string().min(1),
          fileName: z.string().max(200).default(''),
          contentType: z.enum(VIDEO_MIME_TYPES),
          sizeBytes: z.number().int().nonnegative().default(0),
          platform: z.enum(PLATFORMS),
          caption: z.string().max(2200).default(''),
          note: z.string().max(1000).default(''),
        }),
        response: { 200: postSchema, 400: problemSchema, 404: problemSchema },
      },
    },
    async (request) => {
      const period = await prisma.retainerPeriod.findUnique({
        where: { id: request.params.id },
        include: { retainer: true, posts: { select: { id: true } } },
      });
      if (!period || period.retainer.influencerId !== requireProfileId(request)) {
        throw notFound('Perioden hittades inte.');
      }
      if (period.status !== 'ACTIVE') {
        throw badRequest('Perioden är inte betald ännu.');
      }
      if (!request.body.storagePath.startsWith(`retainer/${period.id}/`)) {
        throw badRequest('Filen hör inte till den här perioden.');
      }
      // Fler videor än avtalat är inte ett fel i sig, men de är inte betalda.
      // Hellre stoppa här än att låta någon lägga tid på något ingen köpt.
      if (period.posts.length >= period.videosAgreed) {
        throw badRequest(`Perioden rymmer ${period.videosAgreed} videor. Alla är inlämnade.`);
      }

      const post = await prisma.retainerPost.create({
        data: {
          periodId: period.id,
          platform: request.body.platform,
          storagePath: request.body.storagePath,
          fileName: request.body.fileName,
          contentType: request.body.contentType,
          sizeBytes: request.body.sizeBytes,
          caption: request.body.caption,
          note: request.body.note,
        },
      });
      return toPost(post);
    },
  );

  /**
   * Företagets svar. Ingen tidsgräns och inget tyst godkännande.
   *
   * På en kampanj auto-godkänns ett utkast som ingen svarat på, så att ett
   * tyst kök inte blockerar kreatören. Här går inlägget ut på företagets eget
   * konto, och ett inlägg som aldrig godkändes går inte att ta tillbaka.
   */
  server.post(
    '/retainer-posts/:id/review',
    {
      preHandler: app.requireRole('BUSINESS'),
      schema: {
        params: z.object({ id: z.string() }),
        body: z.object({
          approve: z.boolean(),
          note: z.string().max(1000).default(''),
        }),
        response: { 200: postSchema, 400: problemSchema, 404: problemSchema },
      },
    },
    async (request) => {
      const post = await prisma.retainerPost.findUnique({
        where: { id: request.params.id },
        include: { period: { include: { retainer: true } } },
      });
      if (!post || post.period.retainer.businessId !== requireProfileId(request)) {
        throw notFound('Videon hittades inte.');
      }
      if (post.status === 'PUBLISHED') {
        throw conflict('Videon är redan publicerad.');
      }
      if (!request.body.approve && request.body.note.trim().length === 0) {
        throw badRequest('Skriv vad som ska ändras, annars vet kreatören inte vad hon ska göra.');
      }

      const updated = await prisma.retainerPost.update({
        where: { id: post.id },
        data: {
          status: request.body.approve ? 'APPROVED' : 'CHANGES_REQUESTED',
          reviewNote: request.body.note,
          reviewedAt: new Date(),
        },
      });
      return toPost(updated);
    },
  );

  /** Kreatören laddar upp en ny version efter en begärd ändring. */
  server.post(
    '/retainer-posts/:id/revision',
    {
      preHandler: app.requireRole('INFLUENCER'),
      schema: {
        params: z.object({ id: z.string() }),
        body: z.object({
          storagePath: z.string().min(1),
          fileName: z.string().max(200).default(''),
          caption: z.string().max(2200).default(''),
          note: z.string().max(1000).default(''),
        }),
        response: { 200: postSchema, 400: problemSchema, 404: problemSchema },
      },
    },
    async (request) => {
      const post = await prisma.retainerPost.findUnique({
        where: { id: request.params.id },
        include: { period: { include: { retainer: true } } },
      });
      if (!post || post.period.retainer.influencerId !== requireProfileId(request)) {
        throw notFound('Videon hittades inte.');
      }
      if (post.status !== 'CHANGES_REQUESTED') {
        throw badRequest('Det finns ingen begärd ändring på den här videon.');
      }

      const updated = await prisma.retainerPost.update({
        where: { id: post.id },
        data: {
          storagePath: request.body.storagePath,
          fileName: request.body.fileName,
          caption: request.body.caption,
          note: request.body.note,
          status: 'PENDING',
          revision: { increment: 1 },
          reviewNote: '',
          reviewedAt: null,
        },
      });
      return toPost(updated);
    },
  );

  /**
   * Kreatören har lagt upp videon på företagets kanal.
   *
   * Länken är inte administration: den är enda vägen till vad inlägget gav.
   * Utan den kan företaget inte se resultatet och vi kan inte mäta något.
   */
  server.post(
    '/retainer-posts/:id/published',
    {
      preHandler: app.requireRole('INFLUENCER'),
      schema: {
        params: z.object({ id: z.string() }),
        body: z.object({ url: z.string().url() }),
        response: { 200: postSchema, 400: problemSchema, 404: problemSchema },
      },
    },
    async (request) => {
      const post = await prisma.retainerPost.findUnique({
        where: { id: request.params.id },
        include: { period: { include: { retainer: true } } },
      });
      if (!post || post.period.retainer.influencerId !== requireProfileId(request)) {
        throw notFound('Videon hittades inte.');
      }
      if (post.status !== 'APPROVED') {
        throw badRequest('Videon måste vara godkänd av företaget innan den publiceras.');
      }
      const retainer = post.period.retainer;
      if (retainer.accessGrantedAt === null || retainer.accessRevokedAt !== null) {
        throw badRequest('Företaget har inte gett dig åtkomst till kanalerna.');
      }

      const updated = await prisma.retainerPost.update({
        where: { id: post.id },
        data: { status: 'PUBLISHED', publishedAt: new Date(), publishedUrl: request.body.url },
      });
      return toPost(updated);
    },
  );

  /** Paketen och rabatten, så att appen slipper känna till reglerna. */
  server.get(
    '/retainer-terms',
    {
      schema: {
        response: {
          200: z.object({
            packages: z.array(z.number().int()),
            prepayMonths: z.number().int(),
            prepayDiscountChoices: z.array(z.number().int()),
          }),
        },
      },
    },
    async () => ({
      packages: [...RETAINER_PACKAGES],
      prepayMonths: PREPAY_MONTHS,
      prepayDiscountChoices: [...PREPAY_DISCOUNT_CHOICES],
    }),
  );
}
