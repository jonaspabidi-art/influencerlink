/**
 * Varför en kreatör får få matchningar.
 *
 * Kortleken visar redan alla kampanjer hon är behörig till, rangordnade. Det
 * den aldrig visar är kampanjerna som sorterats bort, och varför. Den som får
 * ett tomt däck ser bara tystnad och kan inte veta om det beror på att det inte
 * finns några kampanjer, på att hon prissatt sig utanför dem, eller på att hon
 * bara har ett konto kopplat.
 *
 * Allt här är räknat, inget gissat. Varje rad går att kontrollera mot
 * kampanjerna som faktiskt ligger ute – det är hela poängen med att göra det
 * här före ett modellanrop i stället för efter.
 */

import type { Platform } from './domain.js';
import {
  BUDGET_TOLERANCE,
  eligibilityBlockers,
  type BlockerKind,
  type CampaignCandidate,
  type InfluencerCandidate,
} from './matching.js';
import { formatSek, type Ore } from './money.js';

/** Klipp som gör profilen bedömbar. Under det här är den svår att lita på. */
export const HEALTHY_SHOWCASE_COUNT = 3;
/** En presentation kortare än så säger inget om vad kreatören gör. */
export const HEALTHY_BIO_LENGTH = 60;
/** Nischer under det här gör att kampanjer inte hittar henne på ämne. */
export const HEALTHY_CATEGORY_COUNT = 2;

export interface BlockerTally {
  followers: number;
  platforms: number;
  budget: number;
}

export interface CreatorAction {
  kind: BlockerKind;
  /** Vad hon kan göra, skrivet direkt till henne. */
  message: string;
  /** Hur många fler kampanjer hon blir behörig till. Alltid räknat, aldrig antaget. */
  unlocks: number;
  /** Föreslaget nytt lägstapris i öre, när åtgärden gäller priset. */
  suggestedPriceMin?: Ore;
  /** Plattformen som skulle öppna flest kampanjer, när åtgärden gäller konton. */
  platform?: Platform;
}

export interface ProfileGap {
  field: 'AVATAR' | 'BIO' | 'SHOWCASE' | 'STATS' | 'CATEGORIES' | 'PLATFORMS';
  message: string;
}

/** Det om profilen som inte går att läsa ur kampanjerna. */
export interface ProfileSignals {
  hasAvatar: boolean;
  bioLength: number;
  showcaseCount: number;
  /** True när siffrorna hämtats från plattformen, inte uppgivits av kreatören. */
  statsVerified: boolean;
}

export interface CreatorInsights {
  /** Kampanjer som är öppna just nu, oavsett om hon är behörig. */
  openCampaigns: number;
  /** Av dem: hur många hon klarar de hårda kraven för. */
  eligible: number;
  /** Av de behöriga: hur många som ligger i hennes stad. */
  eligibleInCity: number;
  /** Behöriga kampanjer hon redan sagt ja eller nej till. */
  reviewed: number;
  /** Behöriga kampanjer som ligger kvar i kortleken. */
  waiting: number;
  matches: number;
  /** Hur många kampanjer som faller på respektive hinder. */
  blockers: BlockerTally;
  /** Konkreta steg, sorterade efter hur många kampanjer de öppnar. */
  actions: CreatorAction[];
  gaps: ProfileGap[];
}

/** En kampanj sedd från insiktsvyn: kandidaten plus om hon redan bedömt den. */
export interface InsightCampaign extends CampaignCandidate {
  /** True när hon redan svepat på kampanjen. */
  reviewed: boolean;
}

function normalizeCity(city: string): string {
  return city.trim().toLowerCase();
}

/** Priset som krävs för att budgethindret ska släppa, i öre. */
function priceThreshold(campaign: CampaignCandidate): Ore {
  return Math.floor(campaign.budgetPerCreator * (1 + BUDGET_TOLERANCE));
}

/** Avrundar nedåt till hela hundralappar – ett prisförslag ska se ut som ett pris. */
function roundPrice(ore: Ore): Ore {
  const rounded = Math.floor(ore / 10_000) * 10_000;
  return rounded > 0 ? rounded : ore;
}

function plural(count: number): string {
  return count === 1 ? 'kampanj' : 'kampanjer';
}

/**
 * Vad som skulle hända om ett enskilt hinder försvann.
 *
 * Bara kampanjer där hindret är det *enda* räknas. Att lova tre nya kampanjer
 * för en prissänkning och sedan visa noll, för att de ändå föll på följarkravet,
 * är värre än att inte föreslå något alls.
 */
function onlyBlockedBy(
  kind: BlockerKind,
  campaigns: InsightCampaign[],
  influencer: InfluencerCandidate,
): InsightCampaign[] {
  return campaigns.filter((campaign) => {
    const blockers = eligibilityBlockers(campaign, influencer);
    return blockers.length === 1 && blockers[0]!.kind === kind;
  });
}

function priceActions(
  campaigns: InsightCampaign[],
  influencer: InfluencerCandidate,
): CreatorAction[] {
  /*
   * Kampanjer utan kontant budget hör inte hemma här.
   *
   * De ersätter i mat eller upplevelse, och tröskeln för dem blir noll. Att
   * föreslå "sänk ditt lägsta arvode till 0 kr" är inget råd – det är att be
   * henne jobba gratis, formulerat som en uträkning.
   */
  const blocked = onlyBlockedBy('BUDGET', campaigns, influencer).filter(
    (campaign) => campaign.budgetPerCreator > 0,
  );
  if (blocked.length === 0) return [];

  // Högsta tröskeln är det minsta steget, lägsta tröskeln öppnar allihop.
  const thresholds = blocked.map(priceThreshold).sort((a, b) => b - a);
  const steps = new Set<Ore>([thresholds[0]!, thresholds[thresholds.length - 1]!]);

  return [...steps]
    .sort((a, b) => b - a)
    .map((threshold) => {
      const price = roundPrice(threshold);
      const unlocks = blocked.filter((campaign) => priceThreshold(campaign) >= price).length;
      return {
        kind: 'BUDGET' as const,
        message: `Sänker du ditt lägsta arvode till ${formatSek(price)} blir du behörig till ${unlocks} ${plural(unlocks)} till.`,
        unlocks,
        suggestedPriceMin: price,
      };
    })
    .filter((action, index, all) => all.findIndex((other) => other.unlocks === action.unlocks) === index);
}

function platformAction(
  campaigns: InsightCampaign[],
  influencer: InfluencerCandidate,
): CreatorAction | null {
  const blocked = onlyBlockedBy('PLATFORMS', campaigns, influencer);
  if (blocked.length === 0) return null;

  const owned = new Set(influencer.platforms);
  const tally = new Map<Platform, number>();
  for (const campaign of blocked) {
    for (const platform of campaign.platforms) {
      if (owned.has(platform)) continue;
      tally.set(platform, (tally.get(platform) ?? 0) + 1);
    }
  }

  const best = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  if (!best) return null;
  const [platform, unlocks] = best;
  return {
    kind: 'PLATFORMS',
    message: `${unlocks} ${plural(unlocks)} efterfrågar ${PLATFORM_NAMES[platform]}. Kopplar du kontot blir du behörig till ${unlocks === 1 ? 'den' : 'dem'}.`,
    unlocks,
    platform,
  };
}

const PLATFORM_NAMES: Record<Platform, string> = {
  TIKTOK: 'TikTok',
  INSTAGRAM: 'Instagram',
  YOUTUBE: 'YouTube',
};

function followerAction(
  campaigns: InsightCampaign[],
  influencer: InfluencerCandidate,
): CreatorAction | null {
  const blocked = onlyBlockedBy('FOLLOWERS', campaigns, influencer);
  if (blocked.length === 0) return null;

  // Närmaste kravet, inte det högsta: det är det hon är närmast att nå.
  const nearest = Math.min(...blocked.map((campaign) => campaign.minFollowers));
  const unlocks = blocked.filter((campaign) => campaign.minFollowers <= nearest).length;
  return {
    kind: 'FOLLOWERS',
    message: `${unlocks} ${plural(unlocks)} kräver minst ${nearest.toLocaleString('sv-SE')} följare. Du har ${influencer.followers.toLocaleString('sv-SE')}.`,
    unlocks,
  };
}

export function profileGaps(
  influencer: InfluencerCandidate,
  signals: ProfileSignals,
): ProfileGap[] {
  const gaps: ProfileGap[] = [];
  if (influencer.platforms.length === 0) {
    gaps.push({
      field: 'PLATFORMS',
      message: 'Du har inget socialt konto kopplat. Utan det syns inga kampanjer alls.',
    });
  }
  if (!signals.hasAvatar) {
    gaps.push({ field: 'AVATAR', message: 'Du saknar profilbild. Företaget ser ditt namn först.' });
  }
  if (signals.bioLength < HEALTHY_BIO_LENGTH) {
    gaps.push({
      field: 'BIO',
      message: 'Din presentation är kort. Skriv två meningar om vad du gör och för vem.',
    });
  }
  if (signals.showcaseCount < HEALTHY_SHOWCASE_COUNT) {
    gaps.push({
      field: 'SHOWCASE',
      message: `Du visar ${signals.showcaseCount} ${signals.showcaseCount === 1 ? 'klipp' : 'klipp'} på profilen. Tre gör det lättare att bedöma dig.`,
    });
  }
  if (!signals.statsVerified) {
    gaps.push({
      field: 'STATS',
      message:
        'Dina siffror är uppgivna av dig själv. Kopplar du kontot hämtas de från plattformen och väger tyngre.',
    });
  }
  if (influencer.categories.length < HEALTHY_CATEGORY_COUNT) {
    gaps.push({
      field: 'CATEGORIES',
      message: 'Du har få nischer valda. Fler nischer gör att fler kampanjer hittar dig.',
    });
  }
  return gaps;
}

/**
 * Hela underlaget. Kampanjerna som skickas in ska vara alla öppna kampanjer,
 * inte bara de hon är behörig till – det är skillnaden mellan dem som är svaret.
 */
export function creatorInsights(input: {
  influencer: InfluencerCandidate;
  campaigns: InsightCampaign[];
  signals: ProfileSignals;
  matches: number;
}): CreatorInsights {
  const { influencer, campaigns, signals } = input;

  const blockers: BlockerTally = { followers: 0, platforms: 0, budget: 0 };
  const eligible: InsightCampaign[] = [];

  for (const campaign of campaigns) {
    const found = eligibilityBlockers(campaign, influencer);
    if (found.length === 0) {
      eligible.push(campaign);
      continue;
    }
    for (const blocker of found) {
      if (blocker.kind === 'FOLLOWERS') blockers.followers += 1;
      if (blocker.kind === 'PLATFORMS') blockers.platforms += 1;
      if (blocker.kind === 'BUDGET') blockers.budget += 1;
    }
  }

  const actions = [
    ...priceActions(campaigns, influencer),
    platformAction(campaigns, influencer),
    followerAction(campaigns, influencer),
  ]
    .filter((action): action is CreatorAction => action !== null)
    .sort((a, b) => b.unlocks - a.unlocks);

  const city = normalizeCity(influencer.city);
  const reviewed = eligible.filter((campaign) => campaign.reviewed).length;

  return {
    openCampaigns: campaigns.length,
    eligible: eligible.length,
    eligibleInCity: eligible.filter((campaign) => normalizeCity(campaign.city) === city).length,
    reviewed,
    waiting: eligible.length - reviewed,
    matches: input.matches,
    blockers,
    actions,
    gaps: profileGaps(influencer, signals),
  };
}
