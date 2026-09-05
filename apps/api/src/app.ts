import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { ZodError } from 'zod';
import type { Config } from './config.js';
import { AppError } from './lib/errors.js';
import authPlugin from './plugins/auth.js';
import { registerRoutes } from './routes/index.js';
import type { Services } from './services/index.js';

export type App = FastifyInstance & { withTypeProvider: unknown };

export async function buildApp(services: Services): Promise<FastifyInstance> {
  const config: Config = services.config;

  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      // Personnummer och tokens får aldrig hamna i loggen.
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers["stripe-signature"]',
          'req.body.personalNumber',
          'req.body.authorizationCode',
        ],
        remove: true,
      },
      ...(config.isProduction ? {} : { transport: { target: 'pino-pretty' } }),
    },
    trustProxy: true,
    // Bilder skickas som base64 i JSON. En nedskalad bild landar långt under
    // det här, men base64 lägger på en tredjedel och PNG komprimerar sämre.
    bodyLimit: 5_000_000,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cors, {
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : false,
    credentials: true,
    // Måste anges explicit. Standarden är bara GET, HEAD och POST, vilket får
    // webbläsaren att blockera profilsparandet (PUT) redan i preflight.
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['authorization', 'content-type'],
  });
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
  });
  await app.register(authPlugin, { secret: config.JWT_SECRET });

  app.decorate('services', services);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      reply.status(error.statusCode).send({
        error: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      });
      return;
    }
    if (error instanceof ZodError || (error as { validation?: unknown }).validation) {
      reply.status(400).send({
        error: 'validation_error',
        message: 'Några fält är felaktigt ifyllda.',
        details: error instanceof ZodError ? error.issues : (error as { validation: unknown }).validation,
      });
      return;
    }
    if ((error as { statusCode?: number }).statusCode === 429) {
      reply.status(429).send({
        error: 'rate_limited',
        message: 'För många anrop. Vänta en stund och försök igen.',
      });
      return;
    }

    request.log.error({ err: error }, 'obehandlat fel');
    reply.status(500).send({
      error: 'internal_error',
      message: 'Något gick fel hos oss. Försök igen.',
    });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ error: 'not_found', message: 'Slutpunkten finns inte.' });
  });

  app.get('/health', async () => ({
    status: 'ok',
    bankIdMode: config.BANKID_MODE,
    // Syns utåt så att ingen tror att en demomiljö är skarp.
    mockIntegrations: config.mockIntegrations,
  }));

  if (config.mockIntegrations.length > 0) {
    app.log.warn(
      { mockIntegrations: config.mockIntegrations },
      'SIMULERADE INTEGRATIONER: ingen riktig legitimering och inga riktiga betalningar',
    );
  }

  await registerRoutes(app, services);

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    services: Services;
  }
}
