import { describe, expect, it } from 'vitest';
import {
  activeCities,
  availableIn,
  describeTravel,
  geoScore,
  isTravelOver,
  isTravelPlanned,
  isTravelling,
  type CampaignCandidate,
  type InfluencerCandidate,
} from '@pacta/shared';

const now = new Date('2026-09-23T12:00:00Z');
const trip = {
  city: 'Stockholm',
  from: new Date('2026-09-26'),
  to: new Date('2026-09-28'),
};

describe('reseläge', () => {
  it('vet om resan är planerad, pågår eller passerat', () => {
    expect(isTravelPlanned(trip, now)).toBe(true);
    expect(isTravelling(trip, now)).toBe(false);

    const during = new Date('2026-09-27T09:00:00Z');
    expect(isTravelling(trip, during)).toBe(true);
    expect(isTravelPlanned(trip, during)).toBe(false);

    const after = new Date('2026-10-01T09:00:00Z');
    expect(isTravelOver(trip, after)).toBe(true);
  });

  /*
   * Sista dagen ska räknas hela dagen ut. Ett datum utan klockslag blir
   * midnatt, och utan den här regeln vore kreatören "hemrest" redan när hen
   * vaknar på avresedagen.
   */
  it('räknar sista dagen hela dagen ut', () => {
    expect(isTravelling(trip, new Date('2026-09-28T22:00:00Z'))).toBe(true);
    expect(isTravelling(trip, new Date('2026-09-29T00:30:00Z'))).toBe(false);
  });

  it('lägger till resorten som arbetsort medan resan pågår', () => {
    expect(activeCities('Göteborg', trip, now)).toEqual(['Göteborg']);
    expect(activeCities('Göteborg', trip, new Date('2026-09-27'))).toEqual([
      'Göteborg',
      'Stockholm',
    ]);
  });

  it('dubblerar inte orten när resan går till hemstaden', () => {
    const home = { ...trip, city: 'göteborg' };
    expect(activeCities('Göteborg', home, new Date('2026-09-27'))).toEqual(['Göteborg']);
  });

  /*
   * Företag som söker i dag vill boka någon som kommer på fredag. Att gömma
   * kreatören tills hen landat vore att gömma hen när hen är mest användbar.
   */
  it('är sökbar på resorten redan innan resan börjat', () => {
    expect(availableIn('Göteborg', trip, 'Stockholm', now)).toBe(true);
    expect(availableIn('Göteborg', trip, 'Stockholm', new Date('2026-10-05'))).toBe(false);
    expect(availableIn('Göteborg', trip, 'Malmö', now)).toBe(false);
    expect(availableIn('Göteborg', null, 'Göteborg', now)).toBe(true);
  });

  it('beskriver resan olika före och under', () => {
    expect(describeTravel(trip, now)).toMatch(/^I Stockholm/);
    expect(describeTravel(trip, new Date('2026-09-27'))).toMatch(/^På plats i Stockholm/);
    expect(describeTravel(trip, new Date('2026-10-05'))).toBeNull();
    expect(describeTravel(null)).toBeNull();
  });

  describe('rangordningen', () => {
    const campaign = {
      id: 'c',
      title: 'Uppdrag',
      city: 'Stockholm',
      categories: ['RESTAURANG'],
      platforms: ['TIKTOK'],
      deliverables: ['TIKTOK_VIDEO'],
      minFollowers: 0,
      budgetPerCreator: 400_000,
    } satisfies CampaignCandidate;

    const base = {
      id: 'i',
      displayName: 'test',
      city: 'Göteborg',
      categories: ['RESTAURANG'],
      platforms: ['TIKTOK'],
      followers: 10_000,
      avgViews: 5_000,
      engagementRate: 0.05,
      priceMin: 100_000,
      priceTarget: 300_000,
    } satisfies InfluencerCandidate;

    it('ger den som är på plats full ortspoäng', () => {
      expect(geoScore(campaign, base)).toBe(0.5);
      expect(geoScore(campaign, { ...base, travelCity: 'Stockholm' })).toBe(1);
      expect(geoScore(campaign, { ...base, travelCity: 'stockholm ' })).toBe(1);
      expect(geoScore(campaign, { ...base, travelCity: 'Malmö' })).toBe(0.5);
    });
  });
});
