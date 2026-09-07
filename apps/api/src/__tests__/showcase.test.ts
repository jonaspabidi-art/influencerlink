import { describe, expect, it, vi } from 'vitest';
import { refreshShowcase } from '../services/showcase.js';
import type { TikTokClient } from '../services/social/tiktok.js';

// Tokenhanteringen har egna tester. Här handlar det om vilka bilder som
// hämtas om, och vad som händer när TikTok inte svarar.
vi.mock('../services/social/tokens.js', () => ({
  tiktokAccessToken: vi.fn(async () => 'token-abc'),
}));

const NYSS = new Date();
const GAMMALT = new Date(Date.now() - 5 * 60 * 60 * 1000);

/** Prisma-stubb med bara det som showcase-tjänsten rör. */
function prismaStub(items: Array<{ id: string; postId: string | null; refreshedAt: Date | null }>) {
  const updates: Array<{ where: unknown; data: Record<string, unknown> }> = [];
  return {
    updates,
    client: {
      showcaseItem: {
        findMany: vi.fn(async () => items),
        update: vi.fn(async (args: { where: unknown; data: Record<string, unknown> }) => {
          updates.push(args);
          return args;
        }),
      },
    } as never,
  };
}

function tiktokStub(videos: Array<{ id: string; coverImageUrl: string; views: number; title: string }>) {
  return {
    recentVideos: vi.fn(async () => videos),
  } as unknown as TikTokClient;
}

describe('refreshShowcase', () => {
  it('gör ingenting utan TikTok-klient', async () => {
    const { client, updates } = prismaStub([{ id: 'a', postId: '1', refreshedAt: GAMMALT }]);
    await refreshShowcase(client, null, 'inf_1');
    expect(updates).toHaveLength(0);
  });

  it('rör inte bilder som hämtades nyss', async () => {
    const { client, updates } = prismaStub([{ id: 'a', postId: '1', refreshedAt: NYSS }]);
    const tiktok = tiktokStub([{ id: '1', coverImageUrl: 'https://ny', views: 10, title: 'T' }]);
    await refreshShowcase(client, tiktok, 'inf_1');

    expect(tiktok.recentVideos).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it('hämtar om en bild vars adress hunnit bli gammal', async () => {
    const { client, updates } = prismaStub([{ id: 'a', postId: '1', refreshedAt: GAMMALT }]);
    await refreshShowcase(
      client,
      tiktokStub([{ id: '1', coverImageUrl: 'https://ny-adress', views: 4200, title: 'Lunch' }]),
      'inf_1',
    );

    expect(updates).toHaveLength(1);
    expect(updates[0]?.data).toMatchObject({
      thumbnailUrl: 'https://ny-adress',
      views: 4200,
      title: 'Lunch',
    });
  });

  it('hämtar om även när adressen aldrig har uppdaterats', async () => {
    const { client, updates } = prismaStub([{ id: 'a', postId: '1', refreshedAt: null }]);
    await refreshShowcase(
      client,
      tiktokStub([{ id: '1', coverImageUrl: 'https://ny', views: 1, title: 'T' }]),
      'inf_1',
    );
    expect(updates).toHaveLength(1);
  });

  it('lämnar en video som fallit ur listan orörd – länken fungerar ändå', async () => {
    const { client, updates } = prismaStub([{ id: 'a', postId: 'borttagen', refreshedAt: GAMMALT }]);
    await refreshShowcase(
      client,
      tiktokStub([{ id: 'annan', coverImageUrl: 'https://ny', views: 1, title: 'T' }]),
      'inf_1',
    );
    expect(updates).toHaveLength(0);
  });

  it('sväljer fel från TikTok – profilen ska visas ändå', async () => {
    const { client, updates } = prismaStub([{ id: 'a', postId: '1', refreshedAt: GAMMALT }]);
    const trasig = {
      recentVideos: vi.fn(async () => {
        throw new Error('401 från TikTok');
      }),
    } as unknown as TikTokClient;

    await expect(refreshShowcase(client, trasig, 'inf_1')).resolves.toBeUndefined();
    expect(updates).toHaveLength(0);
  });
});
