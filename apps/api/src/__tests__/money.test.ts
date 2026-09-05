import { describe, expect, it } from 'vitest';
import { PLATFORM_FEE_BPS, formatSek, kronorToOre, oreToKronor, splitFee } from '@pacta/shared';

describe('splitFee', () => {
  it('delar upp beloppet så att avgift och utbetalning summerar till bruttot', () => {
    const breakdown = splitFee(500_000);
    expect(breakdown.platformFee + breakdown.net).toBe(breakdown.gross);
  });

  it('använder 12 % som standardavgift', () => {
    expect(splitFee(100_000)).toMatchObject({ platformFee: 12_000, net: 88_000 });
  });

  it('avrundar avgiften nedåt så att influencern aldrig får en öre för lite', () => {
    // 12 % av 1 001 öre är 120,12 öre.
    const breakdown = splitFee(1_001);
    expect(breakdown.platformFee).toBe(120);
    expect(breakdown.net).toBe(881);
  });

  it('klarar nollbelopp, t.ex. rena produktsamarbeten', () => {
    expect(splitFee(0)).toMatchObject({ gross: 0, platformFee: 0, net: 0 });
  });

  it('avvisar decimaltal – belopp ska anges i hela ören', () => {
    expect(() => splitFee(100.5)).toThrow(/heltal/);
  });

  it('avvisar negativa belopp', () => {
    expect(() => splitFee(-1)).toThrow();
  });

  it('avvisar avgifter utanför 0–100 %', () => {
    expect(() => splitFee(1000, 10_001)).toThrow();
  });

  it('summerar korrekt för alla belopp i ett brett intervall', () => {
    for (let gross = 0; gross <= 10_000; gross += 137) {
      const breakdown = splitFee(gross, PLATFORM_FEE_BPS);
      expect(breakdown.platformFee + breakdown.net).toBe(gross);
      expect(breakdown.platformFee).toBeGreaterThanOrEqual(0);
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
