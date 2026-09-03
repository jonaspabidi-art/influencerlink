import { describe, expect, it } from 'vitest';
import { DemoSocialProvider, aggregateStats } from '../services/social.js';

describe('DemoSocialProvider', () => {
  const provider = new DemoSocialProvider();

  it('ger samma statistik för samma användarnamn', async () => {
    const first = await provider.connect({ platform: 'TIKTOK', handle: 'annakarlsson' });
    const second = await provider.connect({ platform: 'TIKTOK', handle: 'annakarlsson' });
    expect(first).toEqual(second);
  });

  it('tar bort inledande @ men behåller versalerna användaren skrev', async () => {
    const decorated = await provider.connect({ platform: 'TIKTOK', handle: '@AnnaKarlsson' });
    expect(decorated.handle).toBe('AnnaKarlsson');
  });

  it('slår upp samma konto oavsett versaler i användarnamnet', async () => {
    const plain = await provider.connect({ platform: 'TIKTOK', handle: 'annakarlsson' });
    const decorated = await provider.connect({ platform: 'TIKTOK', handle: '@AnnaKarlsson' });
    expect(decorated.followers).toBe(plain.followers);
    expect(decorated.externalId).toBe(plain.externalId);
  });

  it('skiljer på plattformar för samma användarnamn', async () => {
    const tiktok = await provider.connect({ platform: 'TIKTOK', handle: 'samma' });
    const instagram = await provider.connect({ platform: 'INSTAGRAM', handle: 'samma' });
    expect(tiktok.followers).not.toBe(instagram.followers);
  });

  it('ger rimliga värden inom förväntade intervall', async () => {
    for (const handle of ['a', 'kockenkalle', 'foodie_gbg', 'x'.repeat(40)]) {
      const stats = await provider.connect({ platform: 'INSTAGRAM', handle });
      expect(stats.followers).toBeGreaterThan(1_000);
      expect(stats.engagementRate).toBeGreaterThan(0);
      expect(stats.engagementRate).toBeLessThan(0.1);
      expect(stats.avgViews).toBeGreaterThan(0);
    }
  });
});

describe('aggregateStats', () => {
  it('summerar följare och medelvärdesbildar visningar', () => {
    const stats = aggregateStats([
      { followers: 10_000, avgViews: 8_000, engagementRate: 0.05 },
      { followers: 30_000, avgViews: 12_000, engagementRate: 0.01 },
    ]);
    expect(stats.followers).toBe(40_000);
    expect(stats.avgViews).toBe(10_000);
  });

  it('viktar engagemanget med följarantal', () => {
    // (0.05*10000 + 0.01*30000) / 40000 = 0.02
    const stats = aggregateStats([
      { followers: 10_000, avgViews: 0, engagementRate: 0.05 },
      { followers: 30_000, avgViews: 0, engagementRate: 0.01 },
    ]);
    expect(stats.engagementRate).toBeCloseTo(0.02, 4);
  });

  it('ger nollor för en profil utan kopplade konton', () => {
    expect(aggregateStats([])).toEqual({ followers: 0, avgViews: 0, engagementRate: 0 });
  });

  it('dividerar inte med noll när alla konton saknar följare', () => {
    const stats = aggregateStats([{ followers: 0, avgViews: 0, engagementRate: 0.1 }]);
    expect(stats.engagementRate).toBe(0);
  });
});
