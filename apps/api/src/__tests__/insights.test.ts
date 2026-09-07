import { describe, expect, it } from 'vitest';
import type { InfluencerCandidate, InsightCampaign, ProfileSignals } from '@pacta/shared';
import { creatorInsights, profileGaps } from '@pacta/shared';

function influencer(overrides: Partial<InfluencerCandidate> = {}): InfluencerCandidate {
  return {
    id: 'influencer-1',
    displayName: 'Testprofil',
    city: 'Göteborg',
    categories: ['RESTAURANG', 'MAT_OCH_DRYCK'],
    platforms: ['TIKTOK'],
    followers: 20_000,
    avgViews: 15_000,
    engagementRate: 0.05,
    priceMin: 400_000,
    priceTarget: 600_000,
    ...overrides,
  };
}

function campaign(overrides: Partial<InsightCampaign> = {}): InsightCampaign {
  return {
    id: 'kampanj-1',
    title: 'Lunchmeny',
    city: 'Göteborg',
    categories: ['RESTAURANG'],
    platforms: ['TIKTOK'],
    deliverables: ['TIKTOK_VIDEO'],
    minFollowers: 5_000,
    budgetPerCreator: 400_000,
    reviewed: false,
    ...overrides,
  };
}

const signals: ProfileSignals = {
  hasAvatar: true,
  bioLength: 200,
  showcaseCount: 4,
  statsVerified: true,
};

function insights(campaigns: InsightCampaign[], person = influencer()) {
  return creatorInsights({ influencer: person, campaigns, signals, matches: 0 });
}

describe('creatorInsights', () => {
  it('skiljer behöriga kampanjer från de som faller på ett hinder', () => {
    const result = insights([
      campaign({ id: 'a' }),
      campaign({ id: 'b', minFollowers: 100_000 }),
      campaign({ id: 'c', platforms: ['YOUTUBE'] }),
    ]);

    expect(result.openCampaigns).toBe(3);
    expect(result.eligible).toBe(1);
    expect(result.blockers.followers).toBe(1);
    expect(result.blockers.platforms).toBe(1);
  });

  it('räknar behöriga kampanjer i kreatörens egen stad', () => {
    const result = insights([campaign({ id: 'a' }), campaign({ id: 'b', city: 'Stockholm' })]);
    expect(result.eligible).toBe(2);
    expect(result.eligibleInCity).toBe(1);
  });

  it('skiljer bedömda kampanjer från dem som ligger kvar i kortleken', () => {
    const result = insights([campaign({ id: 'a', reviewed: true }), campaign({ id: 'b' })]);
    expect(result.reviewed).toBe(1);
    expect(result.waiting).toBe(1);
  });

  it('föreslår ett lägre lägstapris och säger hur många kampanjer det öppnar', () => {
    // Lägstapriset är 4 000 kr. Budgeten 2 000 kr tål 3 000 kr, budgeten
    // 1 000 kr bara 1 500 kr – två olika steg med olika utfall.
    const result = insights([
      campaign({ id: 'a', budgetPerCreator: 200_000 }),
      campaign({ id: 'b', budgetPerCreator: 100_000 }),
    ]);

    const price = result.actions.filter((action) => action.kind === 'BUDGET');
    expect(price).toHaveLength(2);
    expect(price[0]).toMatchObject({ suggestedPriceMin: 150_000, unlocks: 2 });
    expect(price[1]).toMatchObject({ suggestedPriceMin: 300_000, unlocks: 1 });
  });

  it('föreslår aldrig noll kronor för en kampanj som ersätter i mat', () => {
    const result = insights([campaign({ id: 'a', budgetPerCreator: 0 })]);
    expect(result.blockers.budget).toBe(1);
    expect(result.actions).toHaveLength(0);
  });

  it('lovar bara kampanjer där priset är det enda hindret', () => {
    const result = insights([
      campaign({ id: 'a', budgetPerCreator: 100_000, minFollowers: 500_000 }),
    ]);
    expect(result.actions).toHaveLength(0);
  });

  it('pekar ut plattformen som öppnar flest kampanjer', () => {
    const result = insights([
      campaign({ id: 'a', platforms: ['INSTAGRAM'] }),
      campaign({ id: 'b', platforms: ['INSTAGRAM'] }),
      campaign({ id: 'c', platforms: ['YOUTUBE'] }),
    ]);

    expect(result.actions[0]).toMatchObject({
      kind: 'PLATFORMS',
      platform: 'INSTAGRAM',
      unlocks: 2,
    });
  });

  it('anger det närmaste följarkravet, inte det högsta', () => {
    const person = influencer({ followers: 4_000 });
    const result = insights(
      [campaign({ id: 'a', minFollowers: 5_000 }), campaign({ id: 'b', minFollowers: 50_000 })],
      person,
    );

    const followers = result.actions.find((action) => action.kind === 'FOLLOWERS');
    expect(followers).toMatchObject({ unlocks: 1 });
    expect(followers?.message).toContain((5_000).toLocaleString('sv-SE'));
  });

  it('sorterar åtgärderna efter hur många kampanjer de öppnar', () => {
    const result = insights([
      campaign({ id: 'a', platforms: ['INSTAGRAM'] }),
      campaign({ id: 'b', platforms: ['INSTAGRAM'] }),
      campaign({ id: 'c', budgetPerCreator: 100_000 }),
    ]);

    expect(result.actions[0]?.kind).toBe('PLATFORMS');
  });
});

describe('profileGaps', () => {
  it('är tom när profilen är komplett', () => {
    expect(profileGaps(influencer(), signals)).toEqual([]);
  });

  it('påpekar saknad bild, kort text, för få klipp och ogranskad statistik', () => {
    const gaps = profileGaps(influencer(), {
      hasAvatar: false,
      bioLength: 10,
      showcaseCount: 1,
      statsVerified: false,
    });

    expect(gaps.map((gap) => gap.field)).toEqual(['AVATAR', 'BIO', 'SHOWCASE', 'STATS']);
  });

  it('säger till när inget konto är kopplat', () => {
    const gaps = profileGaps(influencer({ platforms: [] }), signals);
    expect(gaps[0]?.field).toBe('PLATFORMS');
  });
});
