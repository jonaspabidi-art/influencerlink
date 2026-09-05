import {
  costPerMille,
  isMeasurementFinal,
  shouldRemeasure,
  summariseMetrics,
} from '@pacta/shared';
import { describe, expect, it } from 'vitest';

const post = (views: number, likes = 0, comments = 0, shares = 0) => ({
  url: `https://www.tiktok.com/@a/video/${views}`,
  views,
  likes,
  comments,
  shares,
});

describe('costPerMille', () => {
  it('räknar arvodet per tusen visningar', () => {
    // 4 000 kr och 85 000 visningar blir 47 kr per tusen.
    expect(costPerMille(400_000, 85_000)).toBe(4_706);
  });

  // En kampanj ingen sett har inte oändligt pris, den har inte gett något än.
  it('ger noll utan visningar', () => {
    expect(costPerMille(400_000, 0)).toBe(0);
    expect(costPerMille(400_000, -5)).toBe(0);
  });
});

describe('summariseMetrics', () => {
  it('summerar flera inlägg', () => {
    const totals = summariseMetrics([post(40_000, 3_000, 120, 80), post(20_000, 1_000, 40, 20)]);
    expect(totals.views).toBe(60_000);
    expect(totals.likes).toBe(4_000);
  });

  it('räknar engagemang mot visningar', () => {
    expect(summariseMetrics([post(10_000, 400, 50, 50)]).engagementRate).toBe(0.05);
  });

  it('ger noll för ett samarbete utan mätningar', () => {
    expect(summariseMetrics([])).toEqual({
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      engagementRate: 0,
    });
  });
});

describe('mätfönstret', () => {
  const publishedAt = new Date('2026-09-01T12:00:00Z');

  it('är öppet första månaden', () => {
    expect(isMeasurementFinal(publishedAt, new Date('2026-09-20T12:00:00Z'))).toBe(false);
  });

  it('stängs efter trettio dagar', () => {
    expect(isMeasurementFinal(publishedAt, new Date('2026-10-01T12:00:01Z'))).toBe(true);
  });
});

describe('shouldRemeasure', () => {
  const now = new Date('2026-09-05T12:00:00Z');

  it('mäter när ingen mätning finns', () => {
    expect(shouldRemeasure(null, false, now)).toBe(true);
  });

  // Siffran rör sig långsamt; att fråga oftare ger inget och kostar anrop.
  it('väntar en timme mellan mätningar', () => {
    expect(shouldRemeasure(new Date('2026-09-05T11:30:00Z'), false, now)).toBe(false);
    expect(shouldRemeasure(new Date('2026-09-05T10:30:00Z'), false, now)).toBe(true);
  });

  it('slutar mäta när fönstret är slut', () => {
    expect(shouldRemeasure(null, true, now)).toBe(false);
    expect(shouldRemeasure(new Date('2026-01-01T00:00:00Z'), true, now)).toBe(false);
  });
});
