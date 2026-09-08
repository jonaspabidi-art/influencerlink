import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FEE_SPLIT,
  PREPAY_MONTHS,
  RETAINER_PACKAGES,
  discountedMonthlyRate,
  isRetainerPackage,
  periodEnd,
  retainerMonthlyRate,
  retainerPackages,
  retainerPeriodMoney,
  settlePeriod,
} from '@pacta/shared';

describe('retainerMonthlyRate', () => {
  it('ger grundpriset för det minsta paketet', () => {
    expect(retainerMonthlyRate(600_000, 4)).toBe(600_000);
  });

  it('låter priset per video sjunka med volymen', () => {
    const four = retainerMonthlyRate(600_000, 4) / 4;
    const eight = retainerMonthlyRate(600_000, 8) / 8;
    const twelve = retainerMonthlyRate(600_000, 12) / 12;

    expect(eight).toBeLessThan(four);
    expect(twelve).toBeLessThan(eight);
  });

  it('avrundar till hela kronor', () => {
    for (const size of RETAINER_PACKAGES) {
      expect(retainerMonthlyRate(533_300, size) % 100).toBe(0);
    }
  });

  it('avvisar ett grundpris som inte är heltal öre', () => {
    expect(() => retainerMonthlyRate(600_000.5, 4)).toThrow();
  });
});

describe('retainerPackages', () => {
  it('räknar fram alla tre paketen ur ett enda pris', () => {
    expect(retainerPackages(500_000)).toEqual([
      { videosPerMonth: 4, monthlyRate: 500_000 },
      { videosPerMonth: 8, monthlyRate: 900_000 },
      { videosPerMonth: 12, monthlyRate: 1_250_000 },
    ]);
  });
});

describe('discountedMonthlyRate', () => {
  it('lämnar månadspriset orört under gränsen för förskott', () => {
    expect(discountedMonthlyRate(900_000, 1, 1000)).toBe(900_000);
    expect(discountedMonthlyRate(900_000, PREPAY_MONTHS - 1, 1000)).toBe(900_000);
  });

  it('drar kreatörens egen sats vid förskott', () => {
    expect(discountedMonthlyRate(900_000, PREPAY_MONTHS, 1000)).toBe(810_000);
    expect(discountedMonthlyRate(900_000, PREPAY_MONTHS, 500)).toBe(855_000);
  });

  it('lämnar priset orört när hon valt att inte ge rabatt', () => {
    expect(discountedMonthlyRate(900_000, PREPAY_MONTHS, 0)).toBe(900_000);
  });
});

describe('retainerPeriodMoney', () => {
  it('lägger företagets avgift ovanpå och drar kreatörens från', () => {
    const money = retainerPeriodMoney(900_000, 8, DEFAULT_FEE_SPLIT);

    expect(money.fee).toBe(900_000);
    expect(money.charge).toBe(990_000);
    expect(money.net).toBe(810_000);
    expect(money.platformFee).toBe(180_000);
    expect(money.perVideo).toBe(112_500);
  });
});

describe('settlePeriod', () => {
  const money = retainerPeriodMoney(900_000, 8);

  it('betalar hela arvodet vid full leverans', () => {
    const settled = settlePeriod(money, 8);

    expect(settled.earned).toBe(money.fee);
    expect(settled.payout).toBe(money.net);
    expect(settled.refund).toBe(0);
  });

  it('räknar aldrig fler videor än som avtalats', () => {
    expect(settlePeriod(money, 12)).toEqual(settlePeriod(money, 8));
  });

  it('drar av per utebliven video och betalar tillbaka till företaget', () => {
    const settled = settlePeriod(money, 6);

    expect(settled.earned).toBe(112_500 * 6);
    expect(settled.refund).toBeGreaterThan(0);
  });

  it('lämnar ingen krona kvar hos plattformen vid noll leverans', () => {
    const settled = settlePeriod(money, 0);

    expect(settled.earned).toBe(0);
    expect(settled.payout).toBe(0);
    expect(settled.platformFee).toBe(0);
    expect(settled.refund).toBe(money.charge);
  });

  it('låter utbetalning, återbetalning och avgift summera till det inbetalda', () => {
    for (let approved = 0; approved <= 8; approved += 1) {
      const settled = settlePeriod(money, approved);
      expect(settled.payout + settled.platformFee + settled.refund).toBe(money.charge);
    }
  });

  it('avvisar ett ogiltigt antal', () => {
    expect(() => settlePeriod(money, -1)).toThrow();
    expect(() => settlePeriod(money, 1.5)).toThrow();
  });
});

describe('periodEnd', () => {
  it('lägger en månad på startdatumet', () => {
    expect(periodEnd(new Date('2026-01-15T00:00:00Z')).toISOString()).toBe(
      '2026-02-15T00:00:00.000Z',
    );
  });
});

describe('isRetainerPackage', () => {
  it('släpper bara igenom de tre storlekarna', () => {
    expect(isRetainerPackage(8)).toBe(true);
    expect(isRetainerPackage(5)).toBe(false);
  });
});
