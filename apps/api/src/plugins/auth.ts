import fastifyJwt from '@fastify/jwt';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { Role } from '@influencerlink/shared';
import { forbidden, unauthorized } from '../lib/errors.js';

export interface SessionPayload {
  sub: string;
  role: Role;
  /** Profil-id (influencer eller business). Saknas tills onboarding är klar. */
  pid?: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    /** preHandler som kräver giltig session. */
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** preHandler-fabrik som dessutom kräver en viss roll. */
    requireRole: (
      ...roles: Role[]
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: SessionPayload;
    user: SessionPayload;
  }
}

/** Sessioner är korta – appen förnyar tokenen tyst via /auth/refresh. */
export const SESSION_TTL = '12h';

const authPlugin: FastifyPluginAsync<{ secret: string }> = async (fastify, options) => {
  await fastify.register(fastifyJwt, {
    secret: options.secret,
    sign: { expiresIn: SESSION_TTL },
  });

  fastify.decorate('authenticate', async (request: FastifyRequest) => {
    try {
      await request.jwtVerify();
    } catch {
      throw unauthorized('Sessionen har gått ut. Logga in med BankID igen.');
    }
  });

  fastify.decorate(
    'requireRole',
    (...roles: Role[]) =>
      async (request: FastifyRequest) => {
        try {
          await request.jwtVerify();
        } catch {
          throw unauthorized('Sessionen har gått ut. Logga in med BankID igen.');
        }
        if (!roles.includes(request.user.role)) {
          throw forbidden('Den här funktionen är inte tillgänglig för din kontotyp.');
        }
      },
  );
};

export default fp(authPlugin, { name: 'auth' });

/** Hämtar profil-id ur sessionen, eller kastar om onboardingen inte är klar. */
export function requireProfileId(request: FastifyRequest): string {
  const profileId = request.user.pid;
  if (!profileId) {
    throw forbidden('Du behöver slutföra din profil innan du kan göra det här.');
  }
  return profileId;
}
