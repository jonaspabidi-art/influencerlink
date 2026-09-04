/**
 * Omdömen efter avslutat samarbete.
 *
 * Två regler bär hela funktionen, och båda finns här så att API och app inte
 * kan tolka dem olika:
 *
 *  1. Bara den som varit part i ett avtal med status COMPLETED får skriva.
 *     Ett omdöme är alltså alltid knutet till en betalning som gått igenom.
 *  2. Omdömena är dubbelblinda. Ingen ser motpartens förrän båda lämnat sitt,
 *     eller tills fönstret på fjorton dagar gått ut. Utan den regeln blir alla
 *     betyg femmor, eftersom ingen vågar sätta trea på någon som fortfarande
 *     kan sätta trea tillbaka.
 *
 * Fönstret är också sista dag att skriva. Annars skulle någon kunna vänta ut
 * publiceringen och sedan svara på ett omdöme de redan läst.
 */

import type { ContractStatus, Role } from './domain.js';

export const REVIEW_WINDOW_DAYS = 14;

export const MIN_RATING = 1;
export const MAX_RATING = 5;

/** Delbetygen. Helhetsbetyget räknas fram ur dem – det finns inget eget fält. */
export const REVIEW_CRITERIA = ['communication', 'asDescribed', 'again'] as const;
export type ReviewCriterion = (typeof REVIEW_CRITERIA)[number];

export type ReviewSubject = Extract<Role, 'INFLUENCER' | 'BUSINESS'>;

/** Etiketterna beror på vem som blir bedömd, inte på vem som skriver. */
export const REVIEW_CRITERION_LABELS: Record<ReviewSubject, Record<ReviewCriterion, string>> = {
  INFLUENCER: {
    communication: 'Kommunikation',
    asDescribed: 'Levererade som överenskommet',
    again: 'Skulle samarbeta igen',
  },
  BUSINESS: {
    communication: 'Kommunikation',
    asDescribed: 'Uppdraget stämde med briefen',
    again: 'Skulle samarbeta igen',
  },
};

export type ReviewScores = Record<ReviewCriterion, number>;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Helhetsbetyget är medelvärdet av delbetygen, avrundat till en decimal.
 * Samma modell som Fiverr: den som skriver sätter tre betyg, inte fyra, och
 * kan därför inte ge fem i helhet efter tre tvåor.
 */
export function overallRating(scores: ReviewScores): number {
  const values = REVIEW_CRITERIA.map((criterion) => scores[criterion]);
  return roundToTenth(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/** True om varje delbetyg är ett heltal mellan 1 och 5. */
export function areScoresValid(scores: ReviewScores): boolean {
  return REVIEW_CRITERIA.every((criterion) => {
    const value = scores[criterion];
    return Number.isInteger(value) && value >= MIN_RATING && value <= MAX_RATING;
  });
}

export interface RatingSummary {
  /** Medelbetyg 1–5 med en decimal. 0 när det inte finns några omdömen. */
  average: number;
  count: number;
  /** Antal per betygssteg. Index 0 är en stjärna, index 4 är fem. */
  distribution: number[];
}

/** Profilen som ännu inte har några omdömen. Alltid en ny instans. */
export function emptyRatingSummary(): RatingSummary {
  return { average: 0, count: 0, distribution: [0, 0, 0, 0, 0] };
}

/** Sammanställer publicerade helhetsbetyg till det som visas på en profil. */
export function summarizeRatings(ratings: number[]): RatingSummary {
  const summary = emptyRatingSummary();
  if (ratings.length === 0) return summary;

  let sum = 0;
  for (const rating of ratings) {
    sum += rating;
    // Ett betyg på 4,3 räknas som fyra stjärnor i fördelningen.
    const bucket = Math.min(4, Math.max(0, Math.round(rating) - 1));
    summary.distribution[bucket] = (summary.distribution[bucket] ?? 0) + 1;
  }

  summary.average = roundToTenth(sum / ratings.length);
  summary.count = ratings.length;
  return summary;
}

/** "4.7" → "4,7". Betyg skrivs med decimalkomma i appen. */
export function formatRating(average: number): string {
  return average.toFixed(1).replace('.', ',');
}

/** Sista dagen att lämna omdöme, och den dag ett ensamt omdöme publiceras. */
export function reviewDeadline(completedAt: Date): Date {
  return new Date(completedAt.getTime() + REVIEW_WINDOW_DAYS * DAY_MS);
}

export function daysLeftToReview(completedAt: Date, now: Date = new Date()): number {
  const left = reviewDeadline(completedAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(left / DAY_MS));
}

export interface ReviewEligibility {
  allowed: boolean;
  /** Svensk förklaring att visa när det inte går. */
  reason?: string;
}

/**
 * Får den inloggade parten skriva ett omdöme på det här avtalet just nu?
 * Anropas både av API:et innan skrivning och av appen för att välja vy.
 */
export function checkReviewEligibility(input: {
  status: ContractStatus;
  completedAt: Date | null;
  alreadyReviewed: boolean;
  now?: Date;
}): ReviewEligibility {
  const now = input.now ?? new Date();

  if (input.status !== 'COMPLETED' || !input.completedAt) {
    return { allowed: false, reason: 'Omdömen går att lämna när samarbetet är klart och utbetalt.' };
  }
  if (input.alreadyReviewed) {
    return { allowed: false, reason: 'Du har redan lämnat ditt omdöme för det här samarbetet.' };
  }
  if (now.getTime() > reviewDeadline(input.completedAt).getTime()) {
    return {
      allowed: false,
      reason: `Tiden för omdömen gick ut ${REVIEW_WINDOW_DAYS} dagar efter att samarbetet avslutades.`,
    };
  }
  return { allowed: true };
}

/**
 * Är omdömet synligt för andra än den som skrev det? Publicerat betyder att
 * båda lämnat sitt, eller att fönstret gått ut och det ensamma släppts fram.
 */
export function isReviewPublished(
  review: { publishedAt: Date | null; visibleAt: Date },
  now: Date = new Date(),
): boolean {
  return review.publishedAt !== null || review.visibleAt.getTime() <= now.getTime();
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}
