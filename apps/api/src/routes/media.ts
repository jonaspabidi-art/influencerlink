import { MAX_IMAGE_BYTES, mediaPath, problemSchema, uploadInputSchema } from '@pacta/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { badRequest, notFound } from '../lib/errors.js';
import type { Services } from '../services/index.js';

/** Vad vi tar emot. Allt annat avvisas – ingen SVG, som kan innehålla skript. */
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * Bilder: profilbilder, logotyper och kampanjbilder.
 *
 * De ligger i databasen i stället för hos en filtjänst. Det håller
 * uppsättningen till det som redan finns – ingen bucket, inga fler nycklar –
 * och bilderna är små: appen skalar ned dem till 1280 px innan de skickas.
 * Byts det någon gång mot objektlagring är det den här filen som ändras, för
 * adressen appen sparar (`/media/<id>`) kan peka vart som helst.
 */
export async function mediaRoutes(app: FastifyInstance, services: Services): Promise<void> {
  const server = app.withTypeProvider<ZodTypeProvider>();
  const { prisma } = services;

  server.post(
    '/media',
    {
      preHandler: app.authenticate,
      schema: {
        body: uploadInputSchema,
        response: {
          200: z.object({ url: z.string(), width: z.number().int().nullable(), height: z.number().int().nullable() }),
          400: problemSchema,
        },
      },
    },
    async (request) => {
      const { mimeType, data, width, height } = request.body;
      if (!ALLOWED_TYPES.includes(mimeType as (typeof ALLOWED_TYPES)[number])) {
        throw badRequest('Bilden måste vara JPEG, PNG eller WebP.');
      }

      const bytes = Buffer.from(data, 'base64');
      // base64 är tåligt: skräptecken tappas tyst, så en tom buffert betyder
      // att det som skickades aldrig var en bild.
      if (bytes.length === 0) throw badRequest('Bilden gick inte att läsa.');
      if (bytes.length > MAX_IMAGE_BYTES) {
        throw badRequest('Bilden är för stor. Välj en mindre eller beskär den.');
      }

      const asset = await prisma.mediaAsset.create({
        data: {
          ownerId: request.user.sub,
          mimeType,
          bytes,
          size: bytes.length,
          width: width ?? null,
          height: height ?? null,
        },
        select: { id: true, width: true, height: true },
      });

      return { url: mediaPath(asset.id), width: asset.width, height: asset.height };
    },
  );

  // Öppen med flit: bilderna visas på kort som motparten ser, och en adress
  // med ett cuid i går inte att gissa sig till.
  server.get(
    '/media/:id',
    {
      // Inget svarsschema: kroppen är bytes, inte JSON.
      schema: { params: z.object({ id: z.string().min(1).max(40) }) },
    },
    async (request, reply) => {
      const asset = await prisma.mediaAsset.findUnique({
        where: { id: request.params.id },
        select: { mimeType: true, bytes: true },
      });
      if (!asset) throw notFound('Bilden hittades inte.');

      // Innehållet på en adress ändras aldrig – en ny bild får ett nytt id.
      return reply
        .header('content-type', asset.mimeType)
        .header('cache-control', 'public, max-age=31536000, immutable')
        .send(Buffer.from(asset.bytes));
    },
  );
}
