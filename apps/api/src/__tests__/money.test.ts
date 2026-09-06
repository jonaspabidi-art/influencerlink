import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FEE_SPLIT,
  formatSek,
  kronorToOre,
  oreToKronor,
  splitFee,
} from '@pacta/shared';

/** Så såg avgiften ut innan den delades – avtal från då räknas fortfarande så. */
const GAMMAL_AVGIFT = { businessFeeBps: 0, creatorFeeBps: 1200 };

describe('splitFee', () => {
  it('lägger företagets del ovanpå arvodet och drar kreatörens från det', () => {
    const breakdown = splitFee(450_000);
    expect(breakdown).toMatchObject({
      fee: 450_000,
      businessFee: 45_000,
      charge: 495_000,
      creatorFee: 45_000,
      net: 405_000,
      platformFee: 90_000,
    });
  });

  it('låter beloppen gå ihop åt båda parter', () => {
    const breakdown = splitFee(500_000);
    expect(breakdown.charge).toBe(breakdown.fee + breakdown.businessFee);
    expect(breakdown.net).toBe(breakdown.fee - breakdown.creatorFee);
    expect(breakdown.platformFee).toBe(breakdown.charge - breakdown.net);
  });

  it('använder 10 + 10 % som standard', () => {
    expect(splitFee(100_000, DEFAULT_FEE_SPLIT)).toMatchObject({
      businessFee: 10_000,
      creatorFee: 10_000,
    });
  });

  it('ger kreatören mer i handen än den gamla odelade avgiften', () => {
    expect(splitFee(450_000).net).toBeGreaterThan(splitFee(450_000, GAMMAL_AVGIFT).net);
  });

  it('räknar avtal från tiden före delningen precis som då', () => {
    expect(splitFee(450_000, GAMMAL_AVGIFT)).toMatchObject({
      charge: 450_000,
      net: 396_000,
      platformFee: 54_000,
    });
  });

  it('avrundar båda avgifterna nedåt så att ingen part blir en öre kort', () => {
    // 10 % av 1 001 öre är 100,1 öre.
    const breakdown = splitFee(1_001);
    expect(breakdown.businessFee).toBe(100);
    expect(breakdown.creatorFee).toBe(100);
    expect(breakdown.charge).toBe(1_101);
    expect(breakdown.net).toBe(901);
  });

  it('klarar nollbelopp, t.ex. rena produktsamarbeten', () => {
    expect(splitFee(0)).toMatchObject({ fee: 0, charge: 0, platformFee: 0, net: 0 });
  });

  it('avvisar decimaltal – belopp ska anges i hela ören', () => {
    expect(() => splitFee(100.5)).toThrow(/heltal/);
  });

  it('avvisar negativa belopp', () => {
    expect(() => splitFee(-1)).toThrow();
  });

  it('avvisar avgifter utanför 0–100 %', () => {
    expect(() => splitFee(1000, { businessFeeBps: 0, creatorFeeBps: 10_001 })).toThrow();
    expect(() => splitFee(1000, { businessFeeBps: -1, creatorFeeBps: 0 })).toThrow();
  });

  it('summerar korrekt för alla belopp i ett brett intervall', () => {
    for (let fee = 0; fee <= 10_000; fee += 137) {
      const breakdown = splitFee(fee);
      expect(breakdown.charge - breakdown.net).toBe(breakdown.platformFee);
      expect(breakdown.net).toBeLessThanOrEqual(fee);
      expect(breakdown.charge).toBeGreaterThanOrEqual(fee);
    }
  });
});

describe('valutakonvertering', () => {
  it('konverterar mellan kronor och ören utan avrundningsfel', () => {
    expect(kronorToOre(1234.56)).toBe(123_456);
    expect(oreToKronor(123_456)).toBeCloseTo(1234.56, 2);
  });

  it('formaterar belopp i svensk valuta', () => {
    // Non-breaking space används av Intl, så vi normaliserar mellanslag.
    expect(formatSek(350_000).replace(/\s/g, ' ')).toBe('3 500 kr');
  });
});
