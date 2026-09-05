import type { Platform, PrismaClient } from '@prisma/client';
import { recogniseLink, shouldRemeasure, isMeasurementFinal } from '@pacta/shared';
import type { TikTokClient } from './social/tiktok.js';
import { tiktokAccessToken } from './social/tokens.js';

/**
 * Mätning av vad ett samarbete gav.
 *
 * Siffrorna finns bara hos plattformen, och plattformen lämnar bara ut dem
 * till kreatören själv. Vi hämtar dem alltså med hennes token och sparar en
 * mätning per publicerad länk. Företaget ser resultatet utan att någonsin
 * komma åt kreatörens konto.
 *
 * Mätningen sker när någon tittar, inte enligt schema. En kampanj som ingen
 * bryr sig om behöver inte mätas, och det finns inget jobb att glömma bort.
 */
export async function refreshMetrics(
  prisma: PrismaClient,
  client: TikTokClient | null,
  contract: {
    id: string;
    influencerId: string;
    deliveredAt: Date | null;
    delivery: { urls: string[] } | null;
  },
): Promise<void> {
  const urls = contract.delivery?.urls ?? [];
  if (urls.length === 0 || !contract.deliveredAt) return;

  const existing = await prisma.postMetric.findMany({ where: { contractId: contract.id } });
  const byUrl = new Map(existing.map((metric) => [metric.url, metric]));
  const final = isMeasurementFinal(contract.deliveredAt);

  // Alla länkar är redan mätta och fönstret har inte hunnit gå ut igen.
  const stale = urls.filter((url) => {
    const metric = byUrl.get(url);
    return shouldRemeasure(metric?.measuredAt ?? null, metric?.final ?? false);
  });
  if (stale.length === 0) return;

  const links = stale
    .map((url) => ({ url, link: recogniseLink(url) }))
    .filter((entry): entry is { url: string; link: NonNullable<typeof entry.link> } =>
      entry.link !== null,
    );
  // Bara TikTok går att mäta i dag. Instagram och YouTube kräver sina egna
  // godkännanden, och tills dess sparas ingen rad för dem.
  const tiktok = links.filter((entry) => entry.link.platform === 'TIKTOK');
  if (tiktok.length === 0 || !client) return;

  let videos;
  try {
    const accessToken = await tiktokAccessToken(prisma, client, contract.influencerId);
    videos = await client.recentVideos(accessToken);
  } catch {
    // Mätningen får aldrig fälla avtalsvyn. Utan färska siffror visas de gamla.
    return;
  }

  const byId = new Map(videos.map((video) => [video.id, video]));
  const measuredAt = new Date();

  for (const entry of tiktok) {
    const video = entry.link.postId ? byId.get(entry.link.postId) : undefined;
    if (!video) continue;

    const data = {
      platform: 'TIKTOK' as Platform,
      postId: video.id,
      views: video.views,
      likes: video.likes,
      comments: video.comments,
      shares: video.shares,
      measuredAt,
      final,
    };
    await prisma.postMetric.upsert({
      where: { contractId_url: { contractId: contract.id, url: entry.url } },
      create: { contractId: contract.id, url: entry.url, ...data },
      update: data,
    });
  }
}
