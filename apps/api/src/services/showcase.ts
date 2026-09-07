import type { PrismaClient } from '@prisma/client';
import type { TikTokClient } from './social/tiktok.js';
import { tiktokAccessToken } from './social/tokens.js';

/**
 * Håller miniatyrbilderna på profilen vid liv.
 *
 * TikTok lämnar ut omslagsbilder på signerade adresser som slutar gälla efter
 * några timmar. Adressen till själva videon är permanent, så länken fortsätter
 * fungera medan bilden tyst blir en tom ruta – det ser ut som att profilen är
 * trasig, fast innehållet finns kvar.
 *
 * Bilderna hämtas därför om när någon tittar på profilen, inte enligt schema.
 * En profil ingen besöker behöver inga färska bilder, och det finns inget jobb
 * att glömma bort.
 */

/**
 * Hur länge en hämtad adress litas på.
 *
 * TikTok anger inte hur länge de gäller och har ändrat sig förr, så marginalen
 * är tilltagen: hellre ett extra anrop än en profil med tomma rutor.
 */
const THUMBNAIL_TTL_MS = 2 * 60 * 60 * 1000;

export async function refreshShowcase(
  prisma: PrismaClient,
  client: TikTokClient | null,
  influencerId: string,
): Promise<void> {
  if (!client) return;

  const items = await prisma.showcaseItem.findMany({
    where: { influencerId, platform: 'TIKTOK', postId: { not: null } },
    select: { id: true, postId: true, refreshedAt: true },
  });
  if (items.length === 0) return;

  const cutoff = new Date(Date.now() - THUMBNAIL_TTL_MS);
  const stale = items.filter((item) => !item.refreshedAt || item.refreshedAt < cutoff);
  if (stale.length === 0) return;

  let videos;
  try {
    const accessToken = await tiktokAccessToken(prisma, client, influencerId);
    videos = await client.recentVideos(accessToken);
  } catch {
    // En misslyckad uppdatering får aldrig fälla profilvyn. De gamla
    // adresserna visas vidare; är de utgångna ritas platshållaren i appen.
    return;
  }

  const byId = new Map(videos.map((video) => [video.id, video]));
  const refreshedAt = new Date();

  for (const item of stale) {
    const video = item.postId ? byId.get(item.postId) : undefined;
    // Videon kan vara borttagen eller ha fallit ur listan över de senaste.
    // Då lämnas raden orörd: länken fungerar även utan färsk bild.
    if (!video) continue;

    await prisma.showcaseItem.update({
      where: { id: item.id },
      data: {
        thumbnailUrl: video.coverImageUrl,
        views: video.views,
        title: video.title,
        refreshedAt,
      },
    });
  }
}
