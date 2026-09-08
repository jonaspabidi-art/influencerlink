/**
 * Vad är kreatören värd i ett löpande uppdrag?
 *
 * Det här är den fråga kreatörer är sämst rustade att svara på. Ett enstaka
 * samarbete går att jämföra med andra samarbeten kreatören gjort; ett månadspris för
 * återkommande produktion har kreatören oftast aldrig satt. Sätter hen för lågt
 * låser kreatören in sig i det i ett år, sätter hen för högt får hen inga frågor och
 * vet inte varför.
 *
 * Förslaget räknas fram ur tre saker vi faktiskt vet: kreatörens eget riktpris för
 * ett enstaka samarbete, vad andra kreatörer i kreatörens stad tar, och vad
 * företagen där budgeterar. Ingen av dem är en gissning. Saknas två av dem
 * säger uträkningen det i stället för att låtsas.
 */

import type { Ore } from './money.js';
import { formatSek } from './money.js';
import { MIN_RETAINER_BASE_RATE } from './retainers.js';

/**
 * Vad en video i ett löpande uppdrag är värd i förhållande till ett enstaka
 * samarbete.
 *
 * Lägre, och det är inte en rabatt kreatören ger bort. Ett enstaka samarbete betalar
 * för kreatörens publik; ett löpande uppdrag betalar för produktionen, och
 * materialet går ut på företagets kanaler. Kreatören säljer inte sin räckvidd, och
 * kreatören slipper förhandla om varje uppdrag.
 */
const RETAINER_FACTOR_LOW = 0.5;
const RETAINER_FACTOR_MID = 0.6;
const RETAINER_FACTOR_HIGH = 0.7;

/** Så många jämförbara kreatörer krävs innan deras priser säger något. */
const MIN_PEERS = 3;
/** Och så många innan de säger något med säkerhet. */
const CONFIDENT_PEERS = 5;

/** Priser avrundas till närmaste femhundralapp. Ett månadspris ska se ut som ett pris. */
const ROUNDING = 50_000;

export interface RateInputs {
  /** Kreatörens riktpris för ett enstaka samarbete, i öre. */
  priceTarget: Ore;
  /** Vad andra kreatörer i samma stad tar för grundpaketet, i öre. */
  peerRates: Ore[];
  /** Vad företagen i staden budgeterar per kreatör och kampanj, i öre. */
  cityBudgets: Ore[];
  /** True när räckvidden hämtats från plattformen i stället för uppgetts. */
  statsVerified: boolean;
}

export type RateConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RetainerRateSuggestion {
  /** Föreslaget spann för grundpaketet, fyra videor i månaden. */
  low: Ore;
  mid: Ore;
  high: Ore;
  peerCount: number;
  peerMedian: Ore | null;
  peerLow: Ore | null;
  peerHigh: Ore | null;
  cityBudgetMedian: Ore | null;
  confidence: RateConfidence;
  /** Vad förslaget vilar på, formulerat så att kreatören kan kontrollera det. */
  basis: string[];
}

function median(values: Ore[]): Ore | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
}

function roundPrice(ore: Ore): Ore {
  return Math.max(MIN_RETAINER_BASE_RATE, Math.round(ore / ROUNDING) * ROUNDING);
}

/**
 * Föreslaget månadspris för grundpaketet.
 *
 * Kreatörens eget riktpris väger alltid tyngst – det är det enda talet som säkert
 * hör till just kreatören. Finns tillräckligt många jämförbara kreatörer vägs
 * deras median in till hälften; färre än så säger ingenting och lämnas
 * därhän, hellre än att låta två grannar bestämma kreatörens pris.
 */
export function suggestRetainerRate(input: RateInputs): RetainerRateSuggestion {
  const ownMid = input.priceTarget * 4 * RETAINER_FACTOR_MID;
  const peers = input.peerRates.filter((rate) => rate > 0);
  const peerMedian = peers.length >= MIN_PEERS ? median(peers) : null;
  const sortedPeers = [...peers].sort((a, b) => a - b);

  const mid = peerMedian === null ? ownMid : (ownMid + peerMedian) / 2;
  const cityBudgets = input.cityBudgets.filter((budget) => budget > 0);
  const cityBudgetMedian = cityBudgets.length >= MIN_PEERS ? median(cityBudgets) : null;

  const basis: string[] = [
    `Ditt riktpris för ett enstaka samarbete är ${formatSek(input.priceTarget)}.`,
  ];
  if (peerMedian !== null) {
    basis.push(
      `${peers.length} kreatörer i din stad tar mellan ${formatSek(sortedPeers[0]!)} och ${formatSek(sortedPeers[sortedPeers.length - 1]!)} för fyra videor i månaden.`,
    );
  } else if (peers.length > 0) {
    basis.push(
      `Bara ${peers.length} andra i din stad har satt ett månadspris – för få för att jämföra med.`,
    );
  } else {
    basis.push('Ingen annan i din stad har satt ett månadspris än.');
  }
  if (cityBudgetMedian !== null) {
    basis.push(
      `Företagen i din stad budgeterar ${formatSek(cityBudgetMedian)} per kreatör och kampanj.`,
    );
  }
  basis.push(
    input.statsVerified
      ? 'Dina siffror är hämtade från plattformen.'
      : 'Dina siffror är uppgivna av dig själv, vilket väger lättare hos företaget.',
  );

  const confidence: RateConfidence =
    input.statsVerified && peers.length >= CONFIDENT_PEERS
      ? 'HIGH'
      : input.statsVerified || peerMedian !== null
        ? 'MEDIUM'
        : 'LOW';

  return {
    low: roundPrice(Math.min(mid * 0.8, input.priceTarget * 4 * RETAINER_FACTOR_LOW)),
    mid: roundPrice(mid),
    high: roundPrice(Math.max(mid * 1.25, input.priceTarget * 4 * RETAINER_FACTOR_HIGH)),
    peerCount: peers.length,
    peerMedian,
    peerLow: sortedPeers[0] ?? null,
    peerHigh: sortedPeers[sortedPeers.length - 1] ?? null,
    cityBudgetMedian,
    confidence,
    basis,
  };
}

export const RATE_CONFIDENCE_LABELS: Record<RateConfidence, string> = {
  LOW: 'Grovt förslag',
  MEDIUM: 'Rimligt underlag',
  HIGH: 'Bra underlag',
};
