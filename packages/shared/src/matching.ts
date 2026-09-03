import type { Category, DeliverableKind, Platform } from './domain.js';
import type { Ore } from './money.js';

export interface InfluencerCandidate {
  id: string;
  displayName: string;
  city: string;
  categories: Category[];
  platforms: Platform[];
  /** Summerade följare över alla kopplade konton. */
  followers: number;
  /** Snittvisningar på de senaste inläggen. */
  avgViews: number;
  /** Engagemang som andel, t.ex. 0.045 för 4,5 %. */
  engagementRate: number;
  /** Lägsta arvode influencern accepterar, i öre. */
  priceMin: Ore;
  /** Riktpris för ett standarduppdrag, i öre. */
  priceTarget: Ore;
}

export interface CampaignCandidate {
  id: string;
  title: string;
  city: string;
  categories: Category[];
  platforms: Platform[];
  deliverables: DeliverableKind[];
  minFollowers: number;
  /** Budget per kreatör, i öre. */
  budgetPerCreator: Ore;
}

export interface ScoreBreakdown {
  /** 0–100. Högre är bättre. */
  total: number;
  niche: number;
  reach: number;
  engagement: number;
  geo: number;
  budget: number;
  /** Kortfattade förklaringar på svenska, visas i appen. */
  reasons: string[];
}

/**
 * Viktning per delpoäng. Nisch och engagemang väger tyngst eftersom en
 * matchande, aktiv publik ger restaurangen mer än ren räckvidd gör.
 */
const WEIGHTS = {
  niche: 30,
  engagement: 25,
  reach: 20,
  geo: 15,
  budget: 10,
} as const;

/** Engagemang över detta räknas som toppklass och ger full delpoäng. */
const EXCELLENT_ENGAGEMENT = 0.08;

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function normalizeCity(city: string): string {
  return city.trim().toLowerCase();
}

/**
 * Andel av kampanjens nischer som influencern faktiskt täcker. En kampanj utan
 * angivna nischer är öppen för alla och får full poäng.
 */
export function nicheOverlap(campaign: CampaignCandidate, influencer: InfluencerCandidate): number {
  if (campaign.categories.length === 0) return 1;
  const owned = new Set(influencer.categories);
  const hits = campaign.categories.filter((category) => owned.has(category)).length;
  return hits / campaign.categories.length;
}

/**
 * Räckvidd mäts mot kampanjens följarkrav, inte i absoluta tal: en lokal
 * restaurang som vill ha 5 000 följare ska inte tvingas välja en makroprofil.
 * En profil precis på gränsen får 0,6 och dubbelt kravet ger full poäng.
 */
export function reachScore(campaign: CampaignCandidate, influencer: InfluencerCandidate): number {
  const target = Math.max(campaign.minFollowers, 1_000);
  const ratio = influencer.followers / target;
  if (ratio <= 0) return 0;
  if (ratio >= 2) return 1;
  return clamp01(0.6 * Math.min(ratio, 1) + 0.4 * Math.max(0, ratio - 1));
}

export function engagementScore(influencer: InfluencerCandidate): number {
  return clamp01(influencer.engagementRate / EXCELLENT_ENGAGEMENT);
}

/** Samma stad ger full poäng, allt annat halv – uppdragen kräver fysiskt besök. */
export function geoScore(campaign: CampaignCandidate, influencer: InfluencerCandidate): number {
  return normalizeCity(campaign.city) === normalizeCity(influencer.city) ? 1 : 0.5;
}

/**
 * Full poäng när budgeten når influencerns riktpris. Under lägstapriset blir
 * det noll – då är matchningen ekonomiskt omöjlig oavsett hur bra den ser ut.
 */
export function budgetScore(campaign: CampaignCandidate, influencer: InfluencerCandidate): number {
  if (campaign.budgetPerCreator < influencer.priceMin) return 0;
  if (influencer.priceTarget <= influencer.priceMin) return 1;
  const span = influencer.priceTarget - influencer.priceMin;
  return clamp01((campaign.budgetPerCreator - influencer.priceMin) / span);
}

/** Plattformar kampanjen efterfrågar och som influencern faktiskt publicerar på. */
export function sharedPlatforms(
  campaign: CampaignCandidate,
  influencer: InfluencerCandidate,
): Platform[] {
  const owned = new Set(influencer.platforms);
  return campaign.platforms.filter((platform) => owned.has(platform));
}

export interface Eligibility {
  eligible: boolean;
  /** Hårda hinder, formulerade så att de kan visas direkt för användaren. */
  blockers: string[];
}

/**
 * Hårda krav som avgör om paret ens får visas i flödet. Håll dessa få – allt
 * annat hör hemma i poängsättningen så att gränsfall fortfarande syns.
 */
export function checkEligibility(
  campaign: CampaignCandidate,
  influencer: InfluencerCandidate,
): Eligibility {
  const blockers: string[] = [];
  if (influencer.followers < campaign.minFollowers) {
    blockers.push(
      `Kampanjen kräver minst ${campaign.minFollowers.toLocaleString('sv-SE')} följare.`,
    );
  }
  if (campaign.platforms.length > 0 && sharedPlatforms(campaign, influencer).length === 0) {
    blockers.push('Influencern publicerar inte på någon av kampanjens plattformar.');
  }
  if (campaign.budgetPerCreator < influencer.priceMin) {
    blockers.push('Budgeten ligger under influencerns lägsta arvode.');
  }
  return { eligible: blockers.length === 0, blockers };
}

/**
 * Deterministisk grundpoäng. Den körs på alla kandidater innan Sonnet får
 * bedöma toppen av listan, så att flödet fungerar även utan AI-nyckel.
 */
export function scoreMatch(
  campaign: CampaignCandidate,
  influencer: InfluencerCandidate,
): ScoreBreakdown {
  const niche = nicheOverlap(campaign, influencer);
  const reach = reachScore(campaign, influencer);
  const engagement = engagementScore(influencer);
  const geo = geoScore(campaign, influencer);
  const budget = budgetScore(campaign, influencer);

  const total = Math.round(
    niche * WEIGHTS.niche +
      engagement * WEIGHTS.engagement +
      reach * WEIGHTS.reach +
      geo * WEIGHTS.geo +
      budget * WEIGHTS.budget,
  );

  const reasons: string[] = [];
  if (niche >= 0.99) {
    reasons.push('Täcker alla nischer kampanjen efterfrågar');
  } else if (niche > 0) {
    reasons.push(`Matchar ${Math.round(niche * 100)} % av kampanjens nischer`);
  }
  if (geo === 1) reasons.push(`Finns på plats i ${campaign.city}`);
  if (engagement >= 0.75) {
    reasons.push(`Starkt engagemang (${(influencer.engagementRate * 100).toFixed(1)} %)`);
  }
  if (reach >= 0.9) reasons.push('Räckvidd med god marginal över kravet');
  if (budget === 0) reasons.push('Budgeten understiger influencerns lägsta arvode');

  return { total, niche, reach, engagement, geo, budget, reasons };
}

/** Sorterar kandidater fallande på poäng, med id som stabilt sistahandsval. */
export function rankInfluencers(
  campaign: CampaignCandidate,
  influencers: InfluencerCandidate[],
): Array<{ influencer: InfluencerCandidate; score: ScoreBreakdown }> {
  return influencers
    .map((influencer) => ({ influencer, score: scoreMatch(campaign, influencer) }))
    .sort((a, b) => b.score.total - a.score.total || a.influencer.id.localeCompare(b.influencer.id));
}

/** Samma poäng sett från influencerns håll: vilka kampanjer passar bäst? */
export function rankCampaigns(
  influencer: InfluencerCandidate,
  campaigns: CampaignCandidate[],
): Array<{ campaign: CampaignCandidate; score: ScoreBreakdown }> {
  return campaigns
    .map((campaign) => ({ campaign, score: scoreMatch(campaign, influencer) }))
    .sort((a, b) => b.score.total - a.score.total || a.campaign.id.localeCompare(b.campaign.id));
}
