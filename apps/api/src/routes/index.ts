import type { FastifyInstance } from 'fastify';
import type { Services } from '../services/index.js';
import { assistantRoutes } from './assistant.js';
import { authRoutes } from './auth.js';
import { campaignRoutes } from './campaigns.js';
import { contractRoutes } from './contracts.js';
import { feedRoutes } from './feed.js';
import { matchRoutes } from './matches.js';
import { mediaRoutes } from './media.js';
import { profileRoutes } from './profiles.js';
import { reviewRoutes } from './reviews.js';
import { swipeRoutes } from './swipes.js';
import { webhookRoutes } from './webhooks.js';

export async function registerRoutes(app: FastifyInstance, services: Services): Promise<void> {
  await app.register(async (instance) => {
    /*
     * Tom kropp med JSON-huvud läses som ett tomt objekt.
     *
     * Appen sätter innehållstypen på varje anrop, även på en POST utan fält.
     * Fastifys standardtolk avvisar det, och slutpunkter som inte tar emot
     * något blev därför obrukbara. Att tolka det som {} är rimligare än att
     * kräva att varje klient håller reda på när huvudet får sättas – och en
     * gammal app som ligger kvar i någons webbläsare fortsätter fungera.
     *
     * Ligger här och inte på roten: webhooken har en egen tolk som behöver rå
     * kropp för signaturkontrollen, och två tolkar för samma typ krockar.
     */
    instance.addContentTypeParser(
      'application/json',
      { parseAs: 'string' },
      (_request, body: string, done) => {
        if (body.trim() === '') return done(null, {});
        try {
          done(null, JSON.parse(body));
        } catch (caught) {
          const error = caught as Error & { statusCode?: number };
          error.statusCode = 400;
          done(error, undefined);
        }
      },
    );

    await authRoutes(instance, services);
    await profileRoutes(instance, services);
    await mediaRoutes(instance, services);
    await campaignRoutes(instance, services);
    await feedRoutes(instance, services);
    await swipeRoutes(instance, services);
    await matchRoutes(instance, services);
    await contractRoutes(instance, services);
    await reviewRoutes(instance, services);
    await assistantRoutes(instance, services);
  });

  // Egen scope: webhooken behöver rå request-body för signaturkontrollen.
  await app.register(async (instance) => {
    await webhookRoutes(instance, services);
  });
}
