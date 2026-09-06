import { describe, expect, it } from 'vitest';
import {
  canOfferUsageRights,
  renderUsageRightsTerms,
  usageRightsPrice,
  USAGE_RIGHTS_MONTHS,
} from '@pacta/shared';

describe('usageRightsPrice', () => {
  it('lägger 40 % på arvodet och ger kreatören merparten', () => {
    expect(usageRightsPrice(450_000)).toEqual({
      amount: 180_000,
      creatorShare: 126_000,
      platformShare: 54_000,
    });
  });

  it('låter delarna summera till tillägget för alla belopp', () => {
    for (let fee = 0; fee <= 2_000_000; fee += 7_777) {
      const price = usageRightsPrice(fee);
      expect(price.creatorShare + price.platformShare).toBe(price.amount);
      expect(price.platformShare).toBeGreaterThanOrEqual(0);
    }
  });

  it('avrundar till kreatörens fördel', () => {
    // 40 % av 1 001 är 400,4 → 400. 70 % av det är 280 jämnt.
    const price = usageRightsPrice(1_003);
    expect(price.creatorShare).toBeGreaterThanOrEqual(Math.floor(price.amount * 0.7));
    expect(price.creatorShare + price.platformShare).toBe(price.amount);
  });

  it('ger noll på ett rent produktsamarbete', () => {
    expect(usageRightsPrice(0)).toEqual({ amount: 0, creatorShare: 0, platformShare: 0 });
  });

  it('avvisar arvoden som inte är hela ören', () => {
    expect(() => usageRightsPrice(100.5)).toThrow(/heltal/);
  });
});

describe('canOfferUsageRights', () => {
  const levererat = new Date('2026-09-01');

  it('erbjuds när materialet är levererat och har visningar', () => {
    expect(canOfferUsageRights({ deliveredAt: levererat, views: 4200, existing: false })).toBe(true);
  });

  it('erbjuds inte innan det finns visningar att bedöma det mot', () => {
    expect(canOfferUsageRights({ deliveredAt: levererat, views: 0, existing: false })).toBe(false);
  });

  it('erbjuds inte innan materialet är levererat', () => {
    expect(canOfferUsageRights({ deliveredAt: null, views: 4200, existing: false })).toBe(false);
  });

  it('erbjuds inte två gånger', () => {
    expect(canOfferUsageRights({ deliveredAt: levererat, views: 4200, existing: true })).toBe(false);
  });
});

describe('renderUsageRightsTerms', () => {
  const input = {
    contractId: 'ctr_1',
    businessName: 'Restaurang Kajutan',
    influencerName: 'Anna Karlsson',
    campaignTitle: 'Ny lunchmeny',
    fee: 450_000,
    months: USAGE_RIGHTS_MONTHS,
  };

  it('namnger parterna, tiden och beloppen', () => {
    const terms = renderUsageRightsTerms(input).replace(/\s/g, ' ');
    expect(terms).toContain('Restaurang Kajutan');
    expect(terms).toContain('Anna Karlsson');
    expect(terms).toContain('12 månader');
    expect(terms).toContain('1 800 kr');
    expect(terms).toContain('1 260 kr');
  });

  it('säger uttryckligen att kreatören behåller upphovsrätten', () => {
    expect(renderUsageRightsTerms(input)).toContain('behåller upphovsrätten');
  });

  it('upprepar märkningsplikten – den gäller även annonserna', () => {
    expect(renderUsageRightsTerms(input)).toContain('marknadsföringslagen');
  });

  it('är deterministisk, så texten går att hasha', () => {
    expect(renderUsageRightsTerms(input)).toBe(renderUsageRightsTerms(input));
  });
});
