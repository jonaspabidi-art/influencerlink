import type { Category, Platform } from '@pacta/shared';
import {
  businessProfileInputSchema,
  compensationTypeSchema,
  emptyRatingSummary,
  ratingSummarySchema,
  categorySchema,
  influencerProfileInputSchema,
  platformSchema,
  problemSchema,
  recogniseLink,
  showcaseItemInputSchema,
  showcaseItemSchema,
  showcaseSelectionSchema,
  socialAccountInputSchema,
  socialAccountSchema,
  tiktokAuthorizationSchema,
  tiktokConnectSchema,
  tiktokVideoSchema,
} from '@pacta/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { encryptToken } from '../lib/crypto.js';
import { randomUUID } from 'node:crypto';
import { signState, verifyState } from '../lib/oauthstate.js';
import { badRequest, conflict, notFound, serviceUnavailable } from '../lib/errors.js';
import { recordAudit } from '../lib/audit.js';
import { buildSessionPayload } from '../lib/session.js';
import { requireProfileId } from '../plugins/auth.js';
import type { Services } from '../services/index.js';
import { aggregateStats } from '../services/social/index.js';
import { ratingsFor } from '../services/reviews.js';
import { createTikTokClient, type StatsSource } from '../services/social/index.js';
import { TikTokError } from '../services/social/tiktok.js';
import { tiktokAccessToken } from '../services/social/tokens.js';

const publicInfluencerSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  bio: z.string(),
  city: z.string(),
  avatarUrl: z.string().nullable(),
  categories: z.array(categorySchema),
  priceMin: z.number().int(),
  priceTarget: z.number().int(),
  payoutsEnabled: z.boolean(),
  followers: z.number().int(),
  avgViews: z.number().int(),
  engagementRate: z.number(),
  platforms: z.array(platformSchema),
  socialAccounts: z.array(socialAccountSchema),
  showcase: z.array(showcaseItemSchema),
});

/** Så många inlägg får en profil visa upp. Fler blir bara brus i kortet. */
const MAX_SHOWCASE_ITEMS = 12;

/** Företagets egen vy: samma fält som PUT tar emot, så formuläret kan fyllas. */
const ownBusinessSchema = z.object({
  id: z.string(),
  companyName: z.string(),
  orgNumber: z.string(),
  city: z.string(),
  address: z.string(),
  description: z.string(),
  logoUrl: z.string().nullable(),
  photos: z.array(z.string()),
  categories: z.array(categorySchema),
});

const publicBusinessSchema = z.object({
  id: z.string(),
  companyName: z.string(),
  city: z.string(),
  address: z.string(),
  description: z.string(),
  logoUrl: z.string().nullable(),
  photos: z.array(z.string()),
  categories: z.array(categorySchema),
  /** Publicerade kampanjer, så kreatören ser vad stället söker just nu. */
  openCampaigns: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      budgetPerCreator: z.number().int(),
      compensationType: compensationTypeSchema,
      productValue: z.number().int(),
    }),
  ),
});

export async function profileRoutes(app: FastifyInstance, services: Services): Promise<void> {
  const server = app.withTypeProvider<ZodTypeProvider>();
  const { prisma, social, payments, oembed, config } = services;
  const tiktok = createTikTokClient(config);

  // --- Influencerprofil ---------------------------------------------------

  server.put(
    '/me/influencer-profile',
    {
      preHandler: app.requireRole('INFLUENCER'),
      schema: {
        body: influencerProfileInputSchema,
        response: {
          200: z.object({ profile: publicInfluencerSchema, accessToken: z.string() }),
          400: problemSchema,
        },
      },
    },
    async (request) => {
      const body = request.body;
      const data = {
        displayName: body.displayName,
        bio: body.bio,
        city: body.city,
        categories: body.categories,
        priceMin: body.priceMin,
        priceTarget: Math.max(body.priceTarget, body.priceMin),
        avatarUrl: body.avatarUrl ?? null,
      };

      const profile = await prisma.influencerProfile.upsert({
        where: { userId: request.user.sub },
        create: { userId: request.user.sub, ...data },
        update: data,
        include: { socialAccounts: true, showcase: { orderBy: { position: 'asc' } } },
      });

      // Profilen räknas som klar först när minst ett socialt konto är kopplat.
      await prisma.user.update({
        where: { id: request.user.sub },
        data: { onboardingComplete: profile.socialAccounts.length > 0 },
      });

      return {
        profile: toPublicInfluencer(profile),
        // Sessionen får profil-id först nu, så appen byter till en färsk token.
        accessToken: server.jwt.sign(await buildSessionPayload(prisma, request.user.sub)),
      };
    },
  );

  /**
   * Kreatörer att bläddra bland, utan kampanj.
   *
   * Tidigare gick de bara att se genom en kampanjs kortlek, vilket tvingade
   * företaget att skriva ihop ett samarbete innan den sett om det ens fanns
   * någon att samarbeta med. Det här är utbudet, i den egna staden först.
   */
  server.get(
    '/influencers',
    {
      preHandler: app.authenticate,
      schema: {
        querystring: z.object({
          city: z.string().max(80).optional(),
          category: categorySchema.optional(),
          limit: z.coerce.number().int().min(1).max(50).default(30),
        }),
        response: {
          200: z.array(
            publicInfluencerSchema.extend({
              rating: ratingSummarySchema,
              showcase: z.array(showcaseItemSchema),
            }),
          ),
        },
      },
    },
    async (request) => {
      const { city, category, limit } = request.query;
      const profiles = await prisma.influencerProfile.findMany({
        where: {
          user: { onboardingComplete: true },
          socialAccounts: { some: {} },
          ...(city ? { city: { equals: city, mode: 'insensitive' } } : {}),
          ...(category ? { categories: { has: category } } : {}),
        },
        include: {
          socialAccounts: true,
          showcase: { orderBy: { position: 'asc' } },
        },
        take: limit,
        orderBy: { updatedAt: 'desc' },
      });

      const ratings = await ratingsFor(
        prisma,
        'INFLUENCER',
        profiles.map((profile) => profile.id),
      );

      return profiles.map((profile) => ({
        ...toPublicInfluencer(profile),
        rating: ratings.get(profile.id) ?? emptyRatingSummary(),
      }));
    },
  );

  server.get(
    '/influencers/:id',
    {
      preHandler: app.authenticate,
      schema: {
        params: z.object({ id: z.string() }),
        response: { 200: publicInfluencerSchema, 404: problemSchema },
      },
    },
    async (request) => {
      const profile = await prisma.influencerProfile.findUnique({
        where: { id: request.params.id },
        include: { socialAccounts: true, showcase: { orderBy: { position: 'asc' } } },
      });
      if (!profile) throw notFound('Profilen hittades inte.');
      return toPublicInfluencer(profile);
    },
  );

  server.post(
    '/me/influencer-profile/socials',
    {
      preHandler: app.requireRole('INFLUENCER'),
      schema: {
        body: socialAccountInputSchema,
        response: { 200: socialAccountSchema, 409: problemSchema },
      },
    },
    async (request) => {
      const influencerId = requireProfileId(request);
      const stats = await social.connect(request.body);

      const account = await prisma.socialAccount.upsert({
        where: {
          influencerId_platform: { influencerId, platform: request.body.platform },
        },
        create: {
          influencerId,
          platform: request.body.platform,
          handle: stats.handle,
          externalId: stats.externalId,
          followers: stats.followers,
          avgViews: stats.avgViews,
          engagementRate: stats.engagementRate,
          verified: stats.verified,
          statsSource: stats.source,
          sampleSize: stats.sampleSize ?? null,
          accessTokenEnc: stats.accessToken ? encryptToken(stats.accessToken) : null,
          refreshTokenEnc: stats.refreshToken ? encryptToken(stats.refreshToken) : null,
          tokenExpiresAt: stats.tokenExpiresAt ?? null,
          lastSyncedAt: new Date(),
        },
        update: {
          handle: stats.handle,
          externalId: stats.externalId,
          followers: stats.followers,
          avgViews: stats.avgViews,
          engagementRate: stats.engagementRate,
          verified: stats.verified,
          statsSource: stats.source,
          sampleSize: stats.sampleSize ?? null,
          lastSyncedAt: new Date(),
        },
      });

      await prisma.user.update({
        where: { id: request.user.sub },
        data: { onboardingComplete: true },
      });

      return toPublicSocialAccount(account);
    },
  );

  server.post(
    '/me/influencer-profile/socials/:id/sync',
    {
      preHandler: app.requireRole('INFLUENCER'),
      schema: {
        params: z.object({ id: z.string() }),
        response: { 200: socialAccountSchema, 404: problemSchema },
      },
    },
    async (request) => {
      const influencerId = requireProfileId(request);
      const existing = await prisma.socialAccount.findFirst({
        where: { id: request.params.id, influencerId },
      });
      if (!existing) throw notFound('Kontot hittades inte.');

      const stats = await social.refresh({
        platform: existing.platform,
        handle: existing.handle,
        externalId: existing.externalId ?? '',
      });
      const account = await prisma.socialAccount.update({
        where: { id: existing.id },
        data: {
          followers: stats.followers,
          avgViews: stats.avgViews,
          engagementRate: stats.engagementRate,
          verified: stats.verified,
          statsSource: stats.source,
          sampleSize: stats.sampleSize ?? null,
          lastSyncedAt: new Date(),
        },
      });
      return toPublicSocialAccount(account);
    },
  );

  server.delete(
    '/me/influencer-profile/socials/:id',
    {
      preHandler: app.requireRole('INFLUENCER'),
      schema: {
        params: z.object({ id: z.string() }),
        response: { 200: z.object({ deleted: z.literal(true) }), 404: problemSchema },
      },
    },
    async (request) => {
      const influencerId = requireProfileId(request);
      const { count } = await prisma.socialAccount.deleteMany({
        where: { id: request.params.id, influencerId },
      });
      if (count === 0) throw notFound('Kontot hittades inte.');
      return { deleted: true as const };
    },
  );

  // --- TikTok-inloggning ---------------------------------------------------

  // Ett användarnamn räcker inte: TikTok lämnar bara ut följarantal och
  // videostatistik för den som själv loggat in och gett appen tillstånd.
  // Därför den här omvägen, och därför är siffrorna efteråt värda något.

  server.post(
    '/me/influencer-profile/socials/tiktok/authorize',
    {
      preHandler: app.requireRole('INFLUENCER'),
      schema: {
        response: { 200: tiktokAuthorizationSchema, 503: problemSchema },
      },
    },
    async (request) => {
      const client = requireTikTok();
      const influencerId = requireProfileId(request);
      const { url, codeVerifier } = client.authorizationUrl(randomUUID());

      // PKCE-verifieraren måste överleva till inväxlingen. Den signeras in i
      // state i stället för att lagras, så det inte behövs någon städning av
      // påbörjade inloggningar som aldrig slutfördes.
      const state = signState(
        { purpose: 'tiktok', userId: request.user.sub, influencerId, codeVerifier },
        config.JWT_SECRET,
      );

      const authorizeUrl = new URL(url);
      authorizeUrl.searchParams.set('state', state);
      return { url: authorizeUrl.toString(), state };
    },
  );

  server.post(
    '/me/influencer-profile/socials/tiktok/connect',
    {
      preHandler: app.requireRole('INFLUENCER'),
      schema: {
        body: tiktokConnectSchema,
        response: { 200: socialAccountSchema, 400: problemSchema, 503: problemSchema },
      },
    },
    async (request) => {
      const client = requireTikTok();
      const influencerId = requireProfileId(request);

      const claims = verifyState(request.body.state, config.JWT_SECRET);
      if (!claims) throw badRequest('Inloggningen tog för lång tid. Försök igen.');
      // Koden ska lösas in av samma konto som startade inloggningen.
      if (
        claims.purpose !== 'tiktok' ||
        claims.userId !== request.user.sub ||
        claims.influencerId !== influencerId
      ) {
        throw badRequest('Inloggningen hörde till ett annat konto.');
      }

      let stats;
      try {
        const tokens = await client.exchangeCode(request.body.code, claims.codeVerifier);
        stats = await client.statsFor(tokens);
      } catch (caught) {
        if (caught instanceof TikTokError) {
          request.log.warn({ code: caught.code }, 'TikTok-koppling misslyckades');
          throw badRequest(`Kopplingen till TikTok gick inte igenom: ${caught.message}`);
        }
        throw caught;
      }

      const data = {
        handle: stats.handle,
        externalId: stats.externalId,
        followers: stats.followers,
        avgViews: stats.avgViews,
        engagementRate: stats.engagementRate,
        verified: stats.verified,
        statsSource: stats.source,
        sampleSize: stats.sampleSize ?? null,
        accessTokenEnc: stats.accessToken ? encryptToken(stats.accessToken) : null,
        refreshTokenEnc: stats.refreshToken ? encryptToken(stats.refreshToken) : null,
        tokenExpiresAt: stats.tokenExpiresAt ?? null,
        lastSyncedAt: new Date(),
      };

      const account = await prisma.socialAccount.upsert({
        where: { influencerId_platform: { influencerId, platform: 'TIKTOK' } },
        create: { influencerId, platform: 'TIKTOK', ...data },
        update: data,
      });

      await prisma.user.update({
        where: { id: request.user.sub },
        data: { onboardingComplete: true },
      });
      await recordAudit(prisma, {
        userId: request.user.sub,
        action: 'social.tiktok_connected',
        entityType: 'SocialAccount',
        entityId: account.id,
      });

      return toPublicSocialAccount(account);
    },
  );

  // --- Videor att visa upp på profilen ------------------------------------

  server.get(
    '/me/influencer-profile/tiktok/videos',
    {
      preHandler: app.requireRole('INFLUENCER'),
      schema: {
        response: { 200: z.array(tiktokVideoSchema), 400: problemSchema, 503: problemSchema },
      },
    },
    async (request) => {
      const client = requireTikTok();
      const influencerId = requireProfileId(request);
      const accessToken = await tiktokAccessToken(prisma, client, influencerId);

      const [videos, showcased] = await Promise.all([
        client.recentVideos(accessToken),
        prisma.showcaseItem.findMany({
          where: { influencerId, platform: 'TIKTOK' },
          select: { postId: true },
        }),
      ]);

      const chosen = new Set(showcased.map((item) => item.postId));
      return videos.map((video) => ({ ...video, showcased: chosen.has(video.id) }));
    },
  );

  server.put(
    '/me/influencer-profile/showcase/tiktok',
    {
      preHandler: app.requireRole('INFLUENCER'),
      schema: {
        body: showcaseSelectionSchema,
        response: { 200: z.array(showcaseItemSchema), 400: problemSchema, 503: problemSchema },
      },
    },
    async (request) => {
      const client = requireTikTok();
      const influencerId = requireProfileId(request);
      const accessToken = await tiktokAccessToken(prisma, client, influencerId);

      const videos = await client.recentVideos(accessToken);
      const byId = new Map(videos.map((video) => [video.id, video]));
      // Ordningen kreatören valde i är den ordning de visas i.
      const chosen = request.body.videoIds
        .map((id) => byId.get(id))
        .filter((video): video is NonNullable<typeof video> => video !== undefined);

      const handle = (await prisma.socialAccount.findUnique({
        where: { influencerId_platform: { influencerId, platform: 'TIKTOK' } },
        select: { handle: true },
      }))?.handle ?? '';

      // Valet ersätter det tidigare: det kreatören ser i rutnätet är det som
      // ligger på profilen efteråt, inget mer.
      await prisma.$transaction([
        prisma.showcaseItem.deleteMany({ where: { influencerId, platform: 'TIKTOK' } }),
        prisma.showcaseItem.createMany({
          data: chosen.map((video, index) => ({
            influencerId,
            platform: 'TIKTOK' as const,
            url: video.shareUrl ?? `https://www.tiktok.com/@${handle}/video/${video.id}`,
            postId: video.id,
            title: video.title,
            authorName: handle,
            thumbnailUrl: video.coverImageUrl,
            views: video.views,
            refreshedAt: new Date(),
            position: index,
          })),
        }),
      ]);

      const saved = await prisma.showcaseItem.findMany({
        where: { influencerId },
        orderBy: { position: 'asc' },
      });
      return saved.map(toPublicShowcaseItem);
    },
  );

  function requireTikTok() {
    if (!tiktok) {
      throw serviceUnavailable(
        'TikTok-inloggningen är inte påslagen än. Koppla kontot med användarnamn så länge.',
      );
    }
    return tiktok;
  }

  // --- Uppvisat innehåll --------------------------------------------------

  // Tills OAuth mot TikTok och Instagram är på plats klistrar kreatören in
  // länkar själv. Vi läser adressen, hämtar miniatyr via oEmbed och sparar.

  server.get(
    '/me/influencer-profile/showcase',
    {
      preHandler: app.requireRole('INFLUENCER'),
      schema: { response: { 200: z.array(showcaseItemSchema) } },
    },
    async (request) => {
      const influencerId = requireProfileId(request);
      const items = await prisma.showcaseItem.findMany({
        where: { influencerId },
        orderBy: { position: 'asc' },
      });
      return items.map(toPublicShowcaseItem);
    },
  );

  server.post(
    '/me/influencer-profile/showcase',
    {
      preHandler: app.requireRole('INFLUENCER'),
      schema: {
        body: showcaseItemInputSchema,
        response: { 200: showcaseItemSchema, 400: problemSchema, 409: problemSchema },
      },
    },
    async (request) => {
      const influencerId = requireProfileId(request);
      const link = recogniseLink(request.body.url);
      if (!link) {
        throw badRequest('Länken känns inte igen. Klistra in en länk till ett inlägg på TikTok, Instagram eller YouTube.');
      }

      const existing = await prisma.showcaseItem.findUnique({
        where: { influencerId_url: { influencerId, url: link.url } },
      });
      if (existing) throw conflict('Inlägget finns redan på profilen.');

      const count = await prisma.showcaseItem.count({ where: { influencerId } });
      if (count >= MAX_SHOWCASE_ITEMS) {
        throw conflict(`Du kan visa upp högst ${MAX_SHOWCASE_ITEMS} inlägg. Ta bort ett först.`);
      }

      // Uppslaget får aldrig fälla sparandet – utan bild syns länken ändå.
      const meta = await oembed.lookup(link);

      const item = await prisma.showcaseItem.create({
        data: {
          influencerId,
          platform: link.platform,
          url: link.url,
          postId: link.postId,
          title: meta.title,
          authorName: meta.authorName || (link.handle ?? ''),
          thumbnailUrl: meta.thumbnailUrl,
          thumbnailWidth: meta.thumbnailWidth,
          thumbnailHeight: meta.thumbnailHeight,
          refreshedAt: new Date(),
          position: count,
        },
      });
      return toPublicShowcaseItem(item);
    },
  );

  server.delete(
    '/me/influencer-profile/showcase/:id',
    {
      preHandler: app.requireRole('INFLUENCER'),
      schema: {
        params: z.object({ id: z.string() }),
        response: { 200: z.object({ deleted: z.literal(true) }), 404: problemSchema },
      },
    },
    async (request) => {
      const influencerId = requireProfileId(request);
      const { count } = await prisma.showcaseItem.deleteMany({
        where: { id: request.params.id, influencerId },
      });
      if (count === 0) throw notFound('Inlägget hittades inte.');
      return { deleted: true as const };
    },
  );

  // --- Företagsprofil -----------------------------------------------------

  server.put(
    '/me/business-profile',
    {
      preHandler: app.requireRole('BUSINESS'),
      schema: {
        body: businessProfileInputSchema,
        response: {
          200: z.object({
            profile: publicBusinessSchema.omit({ openCampaigns: true }),
            accessToken: z.string(),
          }),
          409: problemSchema,
        },
      },
    },
    async (request) => {
      const body = request.body;
      const taken = await prisma.businessProfile.findFirst({
        where: { orgNumber: body.orgNumber, userId: { not: request.user.sub } },
        select: { id: true },
      });
      if (taken) {
        throw conflict('Organisationsnumret är redan registrerat på ett annat konto.');
      }

      const data = {
        companyName: body.companyName,
        orgNumber: body.orgNumber,
        city: body.city,
        address: body.address,
        description: body.description,
        categories: body.categories,
        logoUrl: body.logoUrl ?? null,
        photos: body.photos,
      };
      const profile = await prisma.businessProfile.upsert({
        where: { userId: request.user.sub },
        create: { userId: request.user.sub, ...data },
        update: data,
      });

      await prisma.user.update({
        where: { id: request.user.sub },
        data: { onboardingComplete: true },
      });

      return {
        profile: toPublicBusiness(profile),
        accessToken: server.jwt.sign(await buildSessionPayload(prisma, request.user.sub)),
      };
    },
  );

  server.get(
    '/me/business-profile',
    {
      preHandler: app.requireRole('BUSINESS'),
      schema: { response: { 200: ownBusinessSchema, 404: problemSchema } },
    },
    async (request) => {
      const profile = await prisma.businessProfile.findUnique({
        where: { userId: request.user.sub },
      });
      if (!profile) throw notFound('Företagsprofilen hittades inte.');
      return {
        id: profile.id,
        companyName: profile.companyName,
        orgNumber: profile.orgNumber,
        city: profile.city,
        address: profile.address,
        description: profile.description,
        logoUrl: profile.logoUrl,
        photos: profile.photos,
        categories: profile.categories,
      };
    },
  );

  server.get(
    '/businesses/:id',
    {
      preHandler: app.authenticate,
      schema: {
        params: z.object({ id: z.string() }),
        response: { 200: publicBusinessSchema, 404: problemSchema },
      },
    },
    async (request) => {
      const profile = await prisma.businessProfile.findUnique({
        where: { id: request.params.id },
        include: {
          campaigns: {
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
              id: true,
              title: true,
              budgetPerCreator: true,
              compensationType: true,
              productValue: true,
            },
          },
        },
      });
      if (!profile) throw notFound('Företaget hittades inte.');
      return { ...toPublicBusiness(profile), openCampaigns: profile.campaigns };
    },
  );

  // --- Utbetalningskonto (Stripe Connect) ---------------------------------

  server.post(
    '/me/payouts/onboarding',
    {
      preHandler: app.requireRole('INFLUENCER'),
      schema: {
        response: {
          200: z.object({ onboardingUrl: z.string(), accountId: z.string() }),
        },
      },
    },
    async (request) => {
      const influencerId = requireProfileId(request);
      const profile = await prisma.influencerProfile.findUniqueOrThrow({
        where: { id: influencerId },
        include: { user: true },
      });

      if (profile.stripeAccountId) {
        return {
          accountId: profile.stripeAccountId,
          onboardingUrl: await payments.createOnboardingLink(profile.stripeAccountId),
        };
      }

      const account = await payments.createConnectedAccount({
        influencerId: profile.id,
        email: profile.user.email ?? undefined,
        city: profile.city,
      });
      await prisma.influencerProfile.update({
        where: { id: profile.id },
        data: { stripeAccountId: account.accountId },
      });
      await recordAudit(prisma, {
        userId: request.user.sub,
        action: 'payouts.account_created',
        entityType: 'InfluencerProfile',
        entityId: profile.id,
      });
      return account;
    },
  );

  server.get(
    '/me/payouts/status',
    {
      preHandler: app.requireRole('INFLUENCER'),
      schema: {
        response: {
          200: z.object({
            connected: z.boolean(),
            payoutsEnabled: z.boolean(),
            pendingPayout: z.number().int(),
            paidOut: z.number().int(),
          }),
        },
      },
    },
    async (request) => {
      const influencerId = requireProfileId(request);
      const profile = await prisma.influencerProfile.findUniqueOrThrow({
        where: { id: influencerId },
      });

      // Stripe är sanningskällan för om utbetalningar är påslagna.
      let payoutsEnabled = profile.payoutsEnabled;
      if (profile.stripeAccountId) {
        payoutsEnabled = await payments.isPayoutsEnabled(profile.stripeAccountId);
        if (payoutsEnabled !== profile.payoutsEnabled) {
          await prisma.influencerProfile.update({
            where: { id: profile.id },
            data: { payoutsEnabled },
          });
        }
      }

      const [pending, paid] = await Promise.all([
        prisma.payment.aggregate({
          _sum: { payout: true },
          where: { status: 'ESCROWED', contract: { influencerId } },
        }),
        prisma.payment.aggregate({
          _sum: { payout: true },
          where: { status: 'RELEASED', contract: { influencerId } },
        }),
      ]);

      return {
        connected: profile.stripeAccountId !== null,
        payoutsEnabled,
        pendingPayout: pending._sum.payout ?? 0,
        paidOut: paid._sum.payout ?? 0,
      };
    },
  );
}

type SocialAccountRow = {
  id: string;
  platform: Platform;
  handle: string;
  followers: number;
  avgViews: number;
  engagementRate: number;
  verified: boolean;
  statsSource: StatsSource;
  sampleSize: number | null;
  lastSyncedAt: Date | null;
};

function toPublicSocialAccount(account: SocialAccountRow) {
  return {
    id: account.id,
    platform: account.platform,
    handle: account.handle,
    followers: account.followers,
    avgViews: account.avgViews,
    engagementRate: account.engagementRate,
    verified: account.verified,
    statsSource: account.statsSource,
    sampleSize: account.sampleSize,
    lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
  };
}

type ShowcaseRow = {
  id: string;
  platform: Platform;
  url: string;
  postId: string | null;
  title: string;
  authorName: string;
  thumbnailUrl: string | null;
  thumbnailWidth: number | null;
  thumbnailHeight: number | null;
  views: number | null;
  position: number;
};

function toPublicShowcaseItem(item: ShowcaseRow) {
  return {
    id: item.id,
    platform: item.platform,
    url: item.url,
    postId: item.postId,
    title: item.title,
    authorName: item.authorName,
    thumbnailUrl: item.thumbnailUrl,
    thumbnailWidth: item.thumbnailWidth,
    thumbnailHeight: item.thumbnailHeight,
    views: item.views,
    position: item.position,
  };
}

/** Tokens finns aldrig med här – de lämnar aldrig servern. */
export function toPublicInfluencer(profile: {
  id: string;
  displayName: string;
  bio: string;
  city: string;
  avatarUrl: string | null;
  categories: Category[];
  priceMin: number;
  priceTarget: number;
  payoutsEnabled: boolean;
  socialAccounts: SocialAccountRow[];
  showcase?: ShowcaseRow[];
}) {
  const stats = aggregateStats(profile.socialAccounts);
  return {
    id: profile.id,
    displayName: profile.displayName,
    bio: profile.bio,
    city: profile.city,
    avatarUrl: profile.avatarUrl,
    categories: profile.categories,
    priceMin: profile.priceMin,
    priceTarget: profile.priceTarget,
    payoutsEnabled: profile.payoutsEnabled,
    followers: stats.followers,
    avgViews: stats.avgViews,
    engagementRate: stats.engagementRate,
    platforms: profile.socialAccounts.map((account) => account.platform),
    socialAccounts: profile.socialAccounts.map(toPublicSocialAccount),
    showcase: (profile.showcase ?? []).map(toPublicShowcaseItem),
  };
}

function toPublicBusiness(profile: {
  id: string;
  companyName: string;
  city: string;
  address: string;
  description: string;
  logoUrl: string | null;
  photos: string[];
  categories: Category[];
}) {
  return {
    id: profile.id,
    companyName: profile.companyName,
    city: profile.city,
    address: profile.address,
    description: profile.description,
    logoUrl: profile.logoUrl,
    photos: profile.photos,
    categories: profile.categories,
  };
}
