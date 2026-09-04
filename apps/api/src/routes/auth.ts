import {
  bankIdCollectResponseSchema,
  bankIdStartResponseSchema,
  bankIdStartSchema,
  loginInputSchema,
  problemSchema,
  registerInputSchema,
  roleSchema,
} from '@influencerlink/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { hashPersonalNumber, maskPersonalNumber, sha256Hex } from '../lib/crypto.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../lib/errors.js';
import { recordAudit } from '../lib/audit.js';
import { buildSessionPayload } from '../lib/session.js';
import type { SessionPayload } from '../plugins/auth.js';
import type { Services } from '../services/index.js';
import { buildAutoStartUrl, buildQrData, translateBankIdHint } from '../services/bankid/index.js';
import { buildSigningText, hashTerms } from '../services/contracts.js';

export async function authRoutes(app: FastifyInstance, services: Services): Promise<void> {
  const server = app.withTypeProvider<ZodTypeProvider>();
  const { prisma, bankId, config } = services;

  server.post(
    '/auth/bankid/start',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        body: bankIdStartSchema,
        response: {
          200: bankIdStartResponseSchema.extend({ autoStartUrl: z.string() }),
          400: problemSchema,
        },
      },
    },
    async (request) => {
      const { purpose, personalNumber, role, contractId } = request.body;
      const endUserIp = request.ip;

      let order;
      if (purpose === 'SIGN') {
        if (!contractId) throw badRequest('contractId krävs vid signering.');
        const { contract, counterpartName } = await loadContractForSigning(services, contractId);
        order = await bankId.sign({
          endUserIp,
          personalNumber,
          userVisibleData: buildSigningText({
            campaignTitle: contract.campaign.title,
            counterpartName,
            fee: contract.fee,
            contractId: contract.id,
          }),
          // Hashen binder signaturen till exakt den avtalstext som visades.
          userNonVisibleData: hashTerms(contract.terms),
        });
      } else {
        order = await bankId.auth({ endUserIp, personalNumber });
      }

      const session = await prisma.bankIdSession.create({
        data: {
          orderRef: order.orderRef,
          autoStartToken: order.autoStartToken,
          qrStartToken: order.qrStartToken,
          qrStartSecret: order.qrStartSecret,
          purpose,
          contractId: contractId ?? null,
          requestedRole: role ?? null,
        },
      });

      return {
        orderRef: session.orderRef,
        autoStartToken: session.autoStartToken,
        qrData: buildQrData(order.qrStartToken, order.qrStartSecret, session.startedAt),
        autoStartUrl: buildAutoStartUrl(order.autoStartToken, 'influencerlink://bankid/return'),
      };
    },
  );

  server.get(
    '/auth/bankid/:orderRef',
    {
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
      schema: {
        params: z.object({ orderRef: z.string().min(1) }),
        response: {
          200: bankIdCollectResponseSchema.extend({ hintText: z.string() }),
          404: problemSchema,
        },
      },
    },
    async (request) => {
      const session = await prisma.bankIdSession.findUnique({
        where: { orderRef: request.params.orderRef },
      });
      if (!session) throw notFound('BankID-ordern finns inte längre.');

      if (session.status !== 'PENDING') {
        return {
          status: session.status,
          hintCode: session.hintCode ?? undefined,
          hintText: translateBankIdHint(session.hintCode ?? undefined),
        };
      }

      const result = await bankId.collect(session.orderRef);

      if (result.status === 'pending') {
        return {
          status: 'PENDING' as const,
          hintCode: result.hintCode,
          hintText: translateBankIdHint(result.hintCode),
          // QR-koden roteras varje sekund, så den räknas om vid varje polling.
          qrData: buildQrData(session.qrStartToken, session.qrStartSecret, session.startedAt),
        };
      }

      if (result.status === 'failed' || !result.completionData) {
        await prisma.bankIdSession.update({
          where: { id: session.id },
          data: { status: 'FAILED', hintCode: result.hintCode ?? 'unknown', completedAt: new Date() },
        });
        return {
          status: 'FAILED' as const,
          hintCode: result.hintCode,
          hintText: translateBankIdHint(result.hintCode),
        };
      }

      const completion = result.completionData;

      if (session.purpose === 'SIGN') {
        await completeSigning(services, session.id, session.contractId, completion, request.ip);
        return {
          status: 'COMPLETE' as const,
          hintText: 'Avtalet är signerat.',
        };
      }

      // Rollen valdes i appen när inloggningen startades.
      const user = await upsertUserFromBankId(services, {
        personalNumber: completion.personalNumber,
        name: completion.name,
        role: session.requestedRole === 'BUSINESS' ? 'BUSINESS' : 'INFLUENCER',
      });

      await prisma.bankIdSession.update({
        where: { id: session.id },
        data: { status: 'COMPLETE', userId: user.id, completedAt: new Date() },
      });

      const payload = await buildSessionPayload(prisma, user.id);
      return {
        status: 'COMPLETE' as const,
        hintText: 'Legitimeringen lyckades.',
        accessToken: server.jwt.sign(payload),
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          onboardingComplete: user.onboardingComplete,
        },
      };
    },
  );

  server.post(
    '/auth/bankid/:orderRef/cancel',
    {
      schema: {
        params: z.object({ orderRef: z.string().min(1) }),
        response: { 200: z.object({ cancelled: z.literal(true) }) },
      },
    },
    async (request) => {
      await bankId.cancel(request.params.orderRef).catch(() => undefined);
      await prisma.bankIdSession.updateMany({
        where: { orderRef: request.params.orderRef, status: 'PENDING' },
        data: { status: 'FAILED', hintCode: 'cancelled', completedAt: new Date() },
      });
      return { cancelled: true as const };
    },
  );

  server.get(
    '/auth/me',
    {
      preHandler: app.authenticate,
      schema: {
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            role: roleSchema,
            onboardingComplete: z.boolean(),
            personalNumberMask: z.string().nullable(),
            profileId: z.string().nullable(),
          }),
        },
      },
    },
    async (request) => {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: request.user.sub },
        include: {
          influencerProfile: { select: { id: true } },
          businessProfile: { select: { id: true } },
        },
      });
      return {
        id: user.id,
        name: user.name,
        role: user.role,
        onboardingComplete: user.onboardingComplete,
        personalNumberMask: user.personalNumberMask,
        profileId: user.influencerProfile?.id ?? user.businessProfile?.id ?? null,
      };
    },
  );

  server.post(
    '/auth/refresh',
    {
      preHandler: app.authenticate,
      schema: { response: { 200: z.object({ accessToken: z.string() }) } },
    },
    async (request) => ({
      accessToken: server.jwt.sign(await buildSessionPayload(prisma, request.user.sub)),
    }),
  );

  const sessionResponse = z.object({
    accessToken: z.string(),
    user: z.object({
      id: z.string(),
      name: z.string(),
      role: roleSchema,
      onboardingComplete: z.boolean(),
      personalNumberMask: z.string().nullable(),
      profileId: z.string().nullable(),
    }),
  });

  /**
   * Konto med e-post och lösenord.
   *
   * BankID sitter kvar där det juridiskt behövs – på avtalssigneringen – men
   * att kräva det redan vid registreringen stänger ute alla som bara vill
   * titta på appen.
   */
  server.post(
    '/auth/register',
    {
      schema: {
        body: registerInputSchema,
        response: { 200: sessionResponse, 409: problemSchema },
      },
    },
    async (request) => {
      const existing = await prisma.user.findUnique({ where: { email: request.body.email } });
      if (existing) throw conflict('Det finns redan ett konto med den adressen.');

      const user = await prisma.user.create({
        data: {
          email: request.body.email,
          passwordHash: await hashPassword(request.body.password),
          name: request.body.name,
          role: request.body.role,
        },
      });
      await recordAudit(prisma, {
        userId: user.id,
        action: 'user.registered',
        entityType: 'User',
        entityId: user.id,
        metadata: { role: user.role },
      });
      return toSession(server, prisma, user.id);
    },
  );

  server.post(
    '/auth/login',
    {
      schema: {
        body: loginInputSchema,
        response: { 200: sessionResponse, 401: problemSchema },
      },
    },
    async (request) => {
      const user = await prisma.user.findUnique({ where: { email: request.body.email } });
      // Samma svar oavsett om adressen finns eller lösenordet är fel, så att
      // inloggningen inte går att använda för att kartlägga vilka som är med.
      const wrong = unauthorized('Fel e-postadress eller lösenord.');
      if (!user?.passwordHash) throw wrong;
      if (!(await verifyPassword(request.body.password, user.passwordHash))) throw wrong;

      return toSession(server, prisma, user.id);
    },
  );

  /**
   * Kontoväljare för testmiljöer.
   *
   * BankID-simulatorn skapar ett nytt konto vid varje inloggning, så de konton
   * som redan finns i databasen går annars inte att komma åt. Finns bara när
   * BankID är simulerat – i skarp drift svarar båda slutpunkterna 404, vilket
   * också är hur appen avgör om väljaren ska visas.
   */
  if (config.BANKID_MODE === 'mock') {
    server.get(
      '/auth/demo-accounts',
      {
        schema: {
          response: {
            200: z.array(
              z.object({
                id: z.string(),
                name: z.string(),
                role: roleSchema,
                /** Profilnamnet, alltså det som visas i appen. */
                displayName: z.string(),
                onboardingComplete: z.boolean(),
                /** Kort sammanfattning av vad kontot har att titta på. */
                summary: z.string(),
              }),
            ),
          },
        },
      },
      async () => {
        const users = await prisma.user.findMany({
          where: { role: { in: ['INFLUENCER', 'BUSINESS'] } },
          include: {
            influencerProfile: {
              select: {
                displayName: true,
                city: true,
                _count: { select: { matches: true, contracts: true } },
              },
            },
            businessProfile: {
              select: {
                companyName: true,
                city: true,
                _count: { select: { campaigns: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
          take: 30,
        });

        return users.map((user) => {
          const influencer = user.influencerProfile;
          const business = user.businessProfile;
          const parts: string[] = [];

          if (influencer) {
            parts.push(influencer.city);
            const { matches, contracts } = influencer._count;
            if (matches > 0) parts.push(`${matches} ${matches === 1 ? 'matchning' : 'matchningar'}`);
            if (contracts > 0) parts.push(`${contracts} avtal`);
          } else if (business) {
            parts.push(business.city);
            const { campaigns } = business._count;
            if (campaigns > 0) parts.push(`${campaigns} ${campaigns === 1 ? 'kampanj' : 'kampanjer'}`);
          } else {
            parts.push('profilen inte klar');
          }

          return {
            id: user.id,
            name: user.name,
            role: user.role,
            displayName: influencer?.displayName ?? business?.companyName ?? user.name,
            onboardingComplete: user.onboardingComplete,
            summary: parts.join(' · '),
          };
        });
      },
    );

    server.post(
      '/auth/demo-login',
      {
        schema: {
          body: z.object({ userId: z.string().min(1) }),
          response: { 200: z.object({ accessToken: z.string() }), 404: problemSchema },
        },
      },
      async (request) => {
        const user = await prisma.user.findUnique({ where: { id: request.body.userId } });
        if (!user) throw notFound('Kontot hittades inte.');
        return { accessToken: server.jwt.sign(await buildSessionPayload(prisma, user.id)) };
      },
    );
  }

  // Genväg för lokal utveckling och E2E-tester. Avstängd i produktion.
  if (config.devLoginEnabled) {
    server.post(
      '/auth/dev-login',
      {
        schema: {
          body: z.object({
            personalNumber: z.string().regex(/^\d{12}$/),
            name: z.string().min(2),
            role: z.enum(['INFLUENCER', 'BUSINESS']),
          }),
          response: { 200: z.object({ accessToken: z.string(), userId: z.string() }) },
        },
      },
      async (request) => {
        const user = await upsertUserFromBankId(services, request.body);
        return {
          accessToken: server.jwt.sign(await buildSessionPayload(prisma, user.id)),
          userId: user.id,
        };
      },
    );
  }
}

/** Bygger tokenen och användarobjektet som appen förväntar sig efter inloggning. */
async function toSession(
  server: { jwt: { sign: (payload: SessionPayload) => string } },
  prisma: Services['prisma'],
  userId: string,
) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      influencerProfile: { select: { id: true } },
      businessProfile: { select: { id: true } },
    },
  });
  return {
    accessToken: server.jwt.sign(await buildSessionPayload(prisma, user.id)),
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      onboardingComplete: user.onboardingComplete,
      personalNumberMask: user.personalNumberMask,
      profileId: user.influencerProfile?.id ?? user.businessProfile?.id ?? null,
    },
  };
}

async function upsertUserFromBankId(
  services: Services,
  input: { personalNumber: string; name: string; role: 'INFLUENCER' | 'BUSINESS' },
) {
  const personalNumberHash = hashPersonalNumber(input.personalNumber);
  const existing = await services.prisma.user.findUnique({ where: { personalNumberHash } });

  if (existing) {
    return services.prisma.user.update({
      where: { id: existing.id },
      data: { bankIdVerifiedAt: new Date(), name: input.name },
    });
  }

  const user = await services.prisma.user.create({
    data: {
      personalNumberHash,
      personalNumberMask: maskPersonalNumber(input.personalNumber),
      name: input.name,
      role: input.role,
      bankIdVerifiedAt: new Date(),
    },
  });
  await recordAudit(services.prisma, {
    userId: user.id,
    action: 'user.created',
    entityType: 'User',
    entityId: user.id,
    metadata: { role: user.role },
  });
  return user;
}

async function loadContractForSigning(services: Services, contractId: string) {
  const contract = await services.prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      campaign: { include: { business: true } },
      influencer: true,
    },
  });
  if (!contract) throw notFound('Avtalet hittades inte.');
  if (contract.status !== 'SENT' && contract.status !== 'PARTIALLY_SIGNED') {
    throw forbidden('Avtalet går inte att signera i sitt nuvarande läge.');
  }
  return { contract, counterpartName: contract.campaign.business.companyName };
}

/**
 * Skriver signaturen och flyttar kontraktet framåt. Kontraktet blir ACTIVE
 * först när båda parter har signerat.
 */
async function completeSigning(
  services: Services,
  sessionId: string,
  contractId: string | null,
  completion: { personalNumber: string; signature: string; ocspResponse: string },
  ipAddress: string,
): Promise<void> {
  if (!contractId) throw badRequest('Signeringssessionen saknar avtal.');

  const personalNumberHash = hashPersonalNumber(completion.personalNumber);
  const signer = await services.prisma.user.findUnique({ where: { personalNumberHash } });
  if (!signer) throw forbidden('Den som signerade har inget konto i appen.');

  const contract = await services.prisma.contract.findUniqueOrThrow({
    where: { id: contractId },
    include: {
      campaign: { include: { business: true } },
      influencer: true,
    },
  });

  const isInfluencer = contract.influencer.userId === signer.id;
  const isBusiness = contract.campaign.business.userId === signer.id;
  if (!isInfluencer && !isBusiness) {
    throw forbidden('Du är inte part i det här avtalet.');
  }

  await services.prisma.$transaction(async (tx) => {
    await tx.signature.upsert({
      where: { contractId_userId: { contractId, userId: signer.id } },
      create: {
        contractId,
        userId: signer.id,
        bankIdOrderRef: sessionId,
        signatureBlob: completion.signature,
        ocspResponse: completion.ocspResponse,
        termsHash: hashTerms(contract.terms),
        ipAddress,
      },
      update: {},
    });

    const signedByInfluencerAt = isInfluencer
      ? (contract.signedByInfluencerAt ?? new Date())
      : contract.signedByInfluencerAt;
    const signedByBusinessAt = isBusiness
      ? (contract.signedByBusinessAt ?? new Date())
      : contract.signedByBusinessAt;
    const bothSigned = signedByInfluencerAt !== null && signedByBusinessAt !== null;

    await tx.contract.update({
      where: { id: contractId },
      data: {
        signedByInfluencerAt,
        signedByBusinessAt,
        status: bothSigned ? 'ACTIVE' : 'PARTIALLY_SIGNED',
      },
    });

    await tx.bankIdSession.update({
      where: { id: sessionId },
      data: { status: 'COMPLETE', userId: signer.id, completedAt: new Date() },
    });

    await recordAudit(tx, {
      userId: signer.id,
      action: 'contract.signed',
      entityType: 'Contract',
      entityId: contractId,
      metadata: { party: isInfluencer ? 'influencer' : 'business', termsHash: sha256Hex(contract.terms) },
    });
  });
}
