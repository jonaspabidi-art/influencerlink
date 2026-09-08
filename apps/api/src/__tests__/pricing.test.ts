import { describe, expect, it } from 'vitest';
import type { RateInputs } from '@pacta/shared';
import { MIN_RETAINER_BASE_RATE, suggestRetainerRate } from '@pacta/shared';

function inputs(overrides: Partial<RateInputs> = {}): RateInputs {
  return {
    priceTarget: 300_000,
    peerRates: [],
    cityBudgets: [],
    statsVerified: false,
    ...overrides,
  };
}

describe('suggestRetainerRate', () => {
  it('utgår från kreatörens eget riktpris när inget annat finns', () => {
    const suggestion = suggestRetainerRate(inputs());

    // 3 000 kr × 4 videor × 0,6 = 7 200 kr, avrundat till närmaste 500.
    expect(suggestion.mid).toBe(700_000);
    expect(suggestion.low).toBeLessThan(suggestion.mid);
    expect(suggestion.high).toBeGreaterThan(suggestion.mid);
  });

  it('lägger ett månadspris under fyra enstaka samarbeten', () => {
    const suggestion = suggestRetainerRate(inputs());
    expect(suggestion.high).toBeLessThan(300_000 * 4);
  });

  it('ignorerar för få jämförbara kreatörer', () => {
    const alone = suggestRetainerRate(inputs());
    const withTwo = suggestRetainerRate(inputs({ peerRates: [2_000_000, 2_000_000] }));

    expect(withTwo.mid).toBe(alone.mid);
    expect(withTwo.peerMedian).toBeNull();
  });

  it('väger in medianen när det finns nog många', () => {
    const suggestion = suggestRetainerRate(
      inputs({ peerRates: [1_000_000, 1_200_000, 1_400_000] }),
    );

    expect(suggestion.peerMedian).toBe(1_200_000);
    // Mitt emellan kreatörens egen uträkning (7 200) och grannarnas median (12 000).
    expect(suggestion.mid).toBe(950_000);
  });

  it('säger vad förslaget vilar på', () => {
    const suggestion = suggestRetainerRate(
      inputs({ peerRates: [900_000, 1_000_000, 1_100_000], cityBudgets: [400_000, 500_000, 600_000] }),
    );

    expect(suggestion.basis[0]).toContain('riktpris');
    expect(suggestion.basis.some((line) => line.includes('3 kreatörer'))).toBe(true);
    expect(suggestion.basis.some((line) => line.includes('budgeterar'))).toBe(true);
  });

  it('säger rakt ut när ingen annan satt ett pris', () => {
    const suggestion = suggestRetainerRate(inputs());
    expect(suggestion.basis.some((line) => line.includes('Ingen annan'))).toBe(true);
  });

  it('säger att ogranskade siffror väger lättare', () => {
    const uncheck = suggestRetainerRate(inputs());
    const checked = suggestRetainerRate(inputs({ statsVerified: true }));

    expect(uncheck.basis.some((line) => line.includes('uppgivna av dig själv'))).toBe(true);
    expect(checked.basis.some((line) => line.includes('hämtade från plattformen'))).toBe(true);
  });

  it('graderar säkerheten efter underlaget', () => {
    expect(suggestRetainerRate(inputs()).confidence).toBe('LOW');
    expect(suggestRetainerRate(inputs({ statsVerified: true })).confidence).toBe('MEDIUM');
    expect(
      suggestRetainerRate(inputs({ peerRates: [1, 2, 3].map((n) => n * 500_000) })).confidence,
    ).toBe('MEDIUM');
    expect(
      suggestRetainerRate(
        inputs({
          statsVerified: true,
          peerRates: [1, 2, 3, 4, 5].map((n) => n * 300_000),
        }),
      ).confidence,
    ).toBe('HIGH');
  });

  it('går aldrig under plattformens lägstapris', () => {
    const suggestion = suggestRetainerRate(inputs({ priceTarget: 10_000 }));
    expect(suggestion.low).toBeGreaterThanOrEqual(MIN_RETAINER_BASE_RATE);
  });

  it('avrundar alltid till hela femhundralappar', () => {
    const suggestion = suggestRetainerRate(inputs({ priceTarget: 273_700 }));
    for (const value of [suggestion.low, suggestion.mid, suggestion.high]) {
      expect(value % 50_000).toBe(0);
    }
  });
});
