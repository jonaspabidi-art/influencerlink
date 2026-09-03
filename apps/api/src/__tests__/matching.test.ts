import { describe, expect, it } from 'vitest';
import type { CampaignCandidate, InfluencerCandidate } from '@influencerlink/shared';
import {
  budgetScore,
  checkEligibility,
  engagementScore,
  geoScore,
  nicheOverlap,
  rankInfluencers,
  scoreMatch,
} from '@influencerlink/shared';

const campaign: CampaignCandidate = {
  id: 'kampanj-1',
  title: 'Lansering av ny lunchmeny',
  city: 'Göteborg',
  categories: ['RESTAURANG', 'MAT_OCH_DRYCK'],
  platforms: ['TIKTOK', 'INSTAGRAM'],
  deliverables: ['TIKTOK_VIDEO'],
  minFollowers: 10_000,
  budgetPerCreator: 400_000,
};

function influencer(overrides: Partial<InfluencerCandidate> = {}): InfluencerCandidate {
  return {
    id: 'influencer-1',
    displayName: 'Testprofil',
    city: 'Göteborg',
    categories: ['RESTAURANG', 'MAT_OCH_DRYCK'],
    platforms: ['TIKTOK', 'INSTAGRAM'],
    followers: 20_000,
    avgViews: 15_000,
    engagementRate: 0.05,
    priceMin: 200_000,
    priceTarget: 400_000,
    ...overrides,
  };
}

describe('nicheOverlap', () => {
  it('ger full poäng när alla nischer täcks', () => {
    expect(nicheOverlap(campaign, influencer())).toBe(1);
  });

  it('ger andelen täckta nischer vid delvis överlapp', () => {
    expect(nicheOverlap(campaign, influencer({ categories: ['RESTAURANG'] }))).toBe(0.5);
  });

  it('behandlar en kampanj utan nischer som öppen för alla', () => {
    expect(nicheOverlap({ ...campaign, categories: [] }, influencer({ categories: ['NOJE'] }))).toBe(1);
  });
});

describe('geoScore', () => {
  it('ignorerar skillnader i versaler och blanksteg', () => {
    expect(geoScore(campaign, influencer({ city: ' göteborg ' }))).toBe(1);
  });

  it('halverar poängen för influencers i en annan stad', () => {
    expect(geoScore(campaign, influencer({ city: 'Malmö' }))).toBe(0.5);
  });
});

describe('budgetScore', () => {
  it('ger noll när budgeten understiger lägsta arvodet', () => {
    expect(budgetScore(campaign, influencer({ priceMin: 500_000 }))).toBe(0);
  });

  it('ger full poäng när budgeten når riktpriset', () => {
    expect(budgetScore(campaign, influencer({ priceTarget: 400_000 }))).toBe(1);
  });

  it('ger full poäng när influencern har ett fast pris', () => {
    expect(budgetScore(campaign, influencer({ priceMin: 400_000, priceTarget: 400_000 }))).toBe(1);
  });
});

describe('engagementScore', () => {
  it('toppar vid 8 % engagemang', () => {
    expect(engagementScore(influencer({ engagementRate: 0.08 }))).toBe(1);
  });

  it('överstiger aldrig ett även vid extremvärden', () => {
    expect(engagementScore(influencer({ engagementRate: 0.9 }))).toBe(1);
  });
});

describe('checkEligibility', () => {
  it('släpper igenom en kandidat som klarar alla krav', () => {
    expect(checkEligibility(campaign, influencer()).eligible).toBe(true);
  });

  it('stoppar kandidater under följarkravet', () => {
    const result = checkEligibility(campaign, influencer({ followers: 500 }));
    expect(result.eligible).toBe(false);
    expect(result.blockers[0]).toMatch(/följare/);
  });

  it('stoppar kandidater utan någon av kampanjens plattformar', () => {
    const result = checkEligibility(campaign, influencer({ platforms: ['YOUTUBE'] }));
    expect(result.eligible).toBe(false);
    expect(result.blockers[0]).toMatch(/plattformar/);
  });

  it('stoppar kandidater vars lägsta arvode överstiger budgeten', () => {
    const result = checkEligibility(campaign, influencer({ priceMin: 900_000 }));
    expect(result.eligible).toBe(false);
  });

  it('listar alla hinder på en gång istället för att stanna vid det första', () => {
    const result = checkEligibility(
      campaign,
      influencer({ followers: 10, platforms: ['YOUTUBE'], priceMin: 900_000 }),
    );
    expect(result.blockers).toHaveLength(3);
  });
});

describe('scoreMatch', () => {
  it('ger nära maxpoäng åt en perfekt kandidat', () => {
    const score = scoreMatch(
      campaign,
      influencer({ followers: 40_000, engagementRate: 0.09, priceTarget: 300_000 }),
    );
    expect(score.total).toBeGreaterThanOrEqual(95);
  });

  it('rankar en lokal nischprofil högre än en större profil i fel stad och nisch', () => {
    const lokal = scoreMatch(campaign, influencer({ followers: 12_000 }));
    const stor = scoreMatch(
      campaign,
      influencer({ followers: 300_000, city: 'Stockholm', categories: ['NOJE'] }),
    );
    expect(lokal.total).toBeGreaterThan(stor.total);
  });

  it('håller sig alltid inom 0–100', () => {
    const extremes = [
      influencer({ followers: 0, engagementRate: 0, priceMin: 10_000_000 }),
      influencer({ followers: 5_000_000, engagementRate: 1 }),
    ];
    for (const candidate of extremes) {
      const score = scoreMatch(campaign, candidate);
      expect(score.total).toBeGreaterThanOrEqual(0);
      expect(score.total).toBeLessThanOrEqual(100);
    }
  });

  it('förklarar poängen på svenska', () => {
    const score = scoreMatch(campaign, influencer());
    expect(score.reasons.length).toBeGreaterThan(0);
    expect(score.reasons.join(' ')).toContain('Göteborg');
  });
});

describe('rankInfluencers', () => {
  it('sorterar fallande på poäng', () => {
    const ranked = rankInfluencers(campaign, [
      influencer({ id: 'b', city: 'Malmö', categories: ['NOJE'] }),
      influencer({ id: 'a', followers: 45_000, engagementRate: 0.08 }),
    ]);
    expect(ranked.map((entry) => entry.influencer.id)).toEqual(['a', 'b']);
  });

  it('är stabil: lika poäng sorteras på id', () => {
    const ranked = rankInfluencers(campaign, [influencer({ id: 'z' }), influencer({ id: 'a' })]);
    expect(ranked.map((entry) => entry.influencer.id)).toEqual(['a', 'z']);
  });
});
