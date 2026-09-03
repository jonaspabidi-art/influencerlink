import type { Category, Platform } from '@influencerlink/shared';
import {
  businessProfileInputSchema,
  categorySchema,
  influencerProfileInputSchema,
  platformSchema,
  problemSchema,
  socialAccountInputSchema,
  socialAccountSchema,
} from '@influencerlink/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { encryptToken } from '../lib/crypto.js';
import { conflict, notFound } from '../lib/errors.js';
import { recordAudit } from '../lib/audit.js';
import { buildSessionPayload } from '../lib/session.js';
import { requireProfileId } from '../plugins/auth.js';
import type { Services } from '../services/index.js';
import { aggregateStats } from '../services/social.js';

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
});

const publicBusinessSchema = z.object({
  id: z.string(),
  companyName: z.string(),
  city: z.string(),
  description: z.string(),
  logoUrl: z.string().nullable(),
  categories: z.array(categorySchema),
});

export async function profileRoutes(app: FastifyInstance, services: Services): Promise<void> {
  const server = app.withTypeProvider<ZodTypeProvider>();
  const { prisma, social, payments } = services;

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
        include: { socialAccounts: true },
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
        include: { socialAccounts: true },
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

  // --- Företagsprofil -----------------------------------------------------

  server.put(
    '/me/business-profile',
    {
      preHandler: app.requireRole('BUSINESS'),
      schema: {
        body: businessProfileInputSchema,
        response: {
          200: z.object({ profile: publicBusinessSchema, accessToken: z.string() }),
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
    '/businesses/:id',
    {
      preHandler: app.authenticate,
      schema: {
        params: z.object({ id: z.string() }),
        response: { 200: publicBusinessSchema, 404: problemSchema },
      },
    },
    async (request) => {
      const profile = await prisma.businessProfile.findUnique({ where: { id: request.params.id } });
      if (!profile) throw notFound('Företaget hittades inte.');
      return toPublicBusiness(profile);
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
    lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
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
  };
}

function toPublicBusiness(profile: {
  id: string;
  companyName: string;
  city: string;
  description: string;
  logoUrl: string | null;
  categories: Category[];
}) {
  return {
    id: profile.id,
    companyName: profile.companyName,
    city: profile.city,
    description: profile.description,
    logoUrl: profile.logoUrl,
    categories: profile.categories,
  };
}
