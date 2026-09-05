/**
 * Vad ett samarbete gav.
 *
 * Utan den här siffran har företaget inget att gå på när den ska bestämma
 * om den ska köra igen – och då kör den inte. Kostnad per tusen visningar är
 * måttet, eftersom det är det enda som går att jämföra med vad annonsplatsen
 * bredvid kostar.
 */

import type { Ore } from './money.js';

/** Så länge efter publicering fortsätter vi mäta. Sedan fryses siffran. */
export const MEASURE_WINDOW_DAYS = 30;

/** Hur ofta vi frågar plattformen. Oftare ger inget – siffran rör sig långsamt. */
export const MEASURE_INTERVAL_MS = 60 * 60 * 1000;

export interface PostMetric {
  url: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

/**
 * Kostnad per tusen visningar, i öre.
 *
 * Noll visningar ger noll och inte oändligheten: en kampanj som ingen sett har
 * inget pris per visning, den har bara inte gett något än.
 */
export function costPerMille(fee: Ore, views: number): Ore {
  if (views <= 0) return 0;
  return Math.round((fee / views) * 1000);
}

/** Summerar flera inlägg till en rad siffror för hela samarbetet. */
export function summariseMetrics(metrics: PostMetric[]): {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  /** Andel interaktioner av visningar. */
  engagementRate: number;
} {
  const total = metrics.reduce(
    (sum, metric) => ({
      views: sum.views + metric.views,
      likes: sum.likes + metric.likes,
      comments: sum.comments + metric.comments,
      shares: sum.shares + metric.shares,
    }),
    { views: 0, likes: 0, comments: 0, shares: 0 },
  );

  const interactions = total.likes + total.comments + total.shares;
  return {
    ...total,
    engagementRate: total.views > 0 ? Number((interactions / total.views).toFixed(4)) : 0,
  };
}

/** Är mätfönstret slut? Efter det ändras siffran inte längre nämnvärt. */
export function isMeasurementFinal(publishedAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - publishedAt.getTime() >= MEASURE_WINDOW_DAYS * 86_400_000;
}

/** Dags att fråga plattformen igen? */
export function shouldRemeasure(
  measuredAt: Date | null,
  isFinal: boolean,
  now: Date = new Date(),
): boolean {
  if (isFinal) return false;
  if (!measuredAt) return true;
  return now.getTime() - measuredAt.getTime() >= MEASURE_INTERVAL_MS;
}
