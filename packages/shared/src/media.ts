/**
 * Bilder i appen.
 *
 * En uppladdad bild får adressen `/media/<id>`, relativ med flit: appen kör mot
 * olika API-adresser i utveckling, demo och drift, och en sparad absolut adress
 * hade slutat fungera så fort domänen bytte.
 */

import { z } from 'zod';

/** Längsta sida efter nedskalning i appen. Räcker för en kortbild i retina. */
export const MAX_IMAGE_DIMENSION = 1280;

/** Största bild servern tar emot, efter nedskalning. */
export const MAX_IMAGE_BYTES = 3_000_000;

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number];

export function mediaPath(id: string): string {
  return `/media/${id}`;
}

/**
 * Adress till en bild: antingen en vi lagrar själva eller en https-adress
 * någon annanstans ifrån, t.ex. en miniatyr från TikTok.
 */
export const mediaUrlSchema = z
  .string()
  .max(500)
  .refine((value) => value.startsWith('/media/') || value.startsWith('https://'), {
    message: 'Bildadressen måste peka på en uppladdad bild eller en https-adress',
  });

export const uploadInputSchema = z.object({
  mimeType: z.enum(IMAGE_MIME_TYPES),
  /** Bilden som base64, utan `data:`-prefix. */
  data: z.string().min(1),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
export type UploadInput = z.infer<typeof uploadInputSchema>;
