import {
  REVIEW_CRITERIA,
  REVIEW_CRITERION_LABELS,
  REVIEW_WINDOW_DAYS,
  areScoresValid,
  checkReviewEligibility,
  daysLeftToReview,
  emptyRatingSummary,
  formatRating,
  isReviewPublished,
  overallRating,
  reviewDeadline,
  summarizeRatings,
} from '@influencerlink/shared';
import { describe, expect, it } from 'vitest';

const DAY = 86_400_000;
const scores = (communication: number, asDescribed: number, again: number) => ({
  communication,
  asDescribed,
  again,
});

describe('overallRating', () => {
  it('är medelvärdet av delbetygen', () => {
    expect(overallRating(scores(5, 4, 3))).toBe(4);
  });

  it('avrundar till en decimal', () => {
    // 5 + 5 + 4 = 14 / 3 = 4,666…
    expect(overallRating(scores(5, 5, 4))).toBe(4.7);
  });

  it('går inte att ge fem i helhet efter tre tvåor', () => {
    expect(overallRating(scores(2, 2, 2))).toBe(2);
  });
});

describe('areScoresValid', () => {
  it('godkänner heltal 1–5', () => {
    expect(areScoresValid(scores(1, 3, 5))).toBe(true);
  });

  it('avvisar noll, sex och decimaler', () => {
    expect(areScoresValid(scores(0, 3, 5))).toBe(false);
    expect(areScoresValid(scores(1, 6, 5))).toBe(false);
    expect(areScoresValid(scores(1, 3, 4.5))).toBe(false);
  });
});

describe('summarizeRatings', () => {
  it('ger noll och tom fördelning utan omdömen', () => {
    expect(summarizeRatings([])).toEqual(emptyRatingSummary());
  });

  it('räknar snitt och antal', () => {
    const summary = summarizeRatings([5, 4, 3]);
    expect(summary.average).toBe(4);
    expect(summary.count).toBe(3);
  });

  it('lägger varje betyg i närmaste stjärnfack', () => {
    // 4,7 hör hemma på fem stjärnor, 4,3 på fyra.
    const summary = summarizeRatings([4.7, 4.3, 1]);
    expect(summary.distribution).toEqual([1, 0, 0, 1, 1]);
  });

  it('summerar fördelningen till antalet omdömen', () => {
    const summary = summarizeRatings([5, 5, 4, 3, 2, 1, 4.7]);
    const total = summary.distribution.reduce((sum, value) => sum + value, 0);
    expect(total).toBe(summary.count);
  });
});

describe('formatRating', () => {
  it('skriver betyg med decimalkomma', () => {
    expect(formatRating(4.7)).toBe('4,7');
    expect(formatRating(5)).toBe('5,0');
  });
});

describe('fönstret', () => {
  const completedAt = new Date('2026-01-01T12:00:00Z');

  it('sista dagen ligger fjorton dagar efter avslut', () => {
    expect(reviewDeadline(completedAt).getTime() - completedAt.getTime()).toBe(
      REVIEW_WINDOW_DAYS * DAY,
    );
  });

  it('räknar ned dagar som återstår', () => {
    const now = new Date(completedAt.getTime() + 4 * DAY);
    expect(daysLeftToReview(completedAt, now)).toBe(REVIEW_WINDOW_DAYS - 4);
  });

  it('går aldrig under noll', () => {
    const now = new Date(completedAt.getTime() + 100 * DAY);
    expect(daysLeftToReview(completedAt, now)).toBe(0);
  });
});

describe('checkReviewEligibility', () => {
  const completedAt = new Date('2026-01-01T12:00:00Z');
  const inWindow = new Date(completedAt.getTime() + DAY);

  it('släpper igenom en part i ett avslutat avtal', () => {
    expect(
      checkReviewEligibility({
        status: 'COMPLETED',
        completedAt,
        alreadyReviewed: false,
        now: inWindow,
      }).allowed,
    ).toBe(true);
  });

  it('stoppar avtal som inte är klara och utbetalda', () => {
    const result = checkReviewEligibility({
      status: 'DELIVERED',
      completedAt: null,
      alreadyReviewed: false,
      now: inWindow,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/klart och utbetalt/);
  });

  it('stoppar ett andra omdöme från samma part', () => {
    const result = checkReviewEligibility({
      status: 'COMPLETED',
      completedAt,
      alreadyReviewed: true,
      now: inWindow,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/redan lämnat/);
  });

  it('stänger när fönstret gått ut, så att ingen kan svara på ett läst omdöme', () => {
    const result = checkReviewEligibility({
      status: 'COMPLETED',
      completedAt,
      alreadyReviewed: false,
      now: new Date(completedAt.getTime() + (REVIEW_WINDOW_DAYS + 1) * DAY),
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/gick ut/);
  });
});

describe('isReviewPublished', () => {
  const now = new Date('2026-01-10T00:00:00Z');
  const later = new Date('2026-01-20T00:00:00Z');

  it('är blint innan fönstret gått ut och motparten skrivit', () => {
    expect(isReviewPublished({ publishedAt: null, visibleAt: later }, now)).toBe(false);
  });

  it('publiceras när båda skrivit', () => {
    expect(isReviewPublished({ publishedAt: now, visibleAt: later }, now)).toBe(true);
  });

  it('släpps fram av sig självt när fönstret gått ut', () => {
    const passed = new Date('2026-01-05T00:00:00Z');
    expect(isReviewPublished({ publishedAt: null, visibleAt: passed }, now)).toBe(true);
  });
});

describe('etiketter', () => {
  it('finns för varje kriterium och båda parter', () => {
    for (const subject of ['INFLUENCER', 'BUSINESS'] as const) {
      for (const criterion of REVIEW_CRITERIA) {
        expect(REVIEW_CRITERION_LABELS[subject][criterion].length).toBeGreaterThan(0);
      }
    }
  });

  it('beskriver leveransen olika beroende på vem som bedöms', () => {
    expect(REVIEW_CRITERION_LABELS.INFLUENCER.asDescribed).not.toBe(
      REVIEW_CRITERION_LABELS.BUSINESS.asDescribed,
    );
  });
});
