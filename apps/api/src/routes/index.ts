import type { FastifyInstance } from 'fastify';
import type { Services } from '../services/index.js';
import { authRoutes } from './auth.js';
import { campaignRoutes } from './campaigns.js';
import { contractRoutes } from './contracts.js';
import { feedRoutes } from './feed.js';
import { matchRoutes } from './matches.js';
import { profileRoutes } from './profiles.js';
import { reviewRoutes } from './reviews.js';
import { swipeRoutes } from './swipes.js';
import { webhookRoutes } from './webhooks.js';

export async function registerRoutes(app: FastifyInstance, services: Services): Promise<void> {
  await app.register(async (instance) => {
    await authRoutes(instance, services);
    await profileRoutes(instance, services);
    await campaignRoutes(instance, services);
    await feedRoutes(instance, services);
    await swipeRoutes(instance, services);
    await matchRoutes(instance, services);
    await contractRoutes(instance, services);
    await reviewRoutes(instance, services);
  });

  // Egen scope: webhooken behöver rå request-body för signaturkontrollen.
  await app.register(async (instance) => {
    await webhookRoutes(instance, services);
  });
}
