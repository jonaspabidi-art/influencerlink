import { BUSINESS_FEE_BPS, CREATOR_FEE_BPS } from './domain.js';

/** Belopp uttrycks alltid i öre (heltal). 1 kr = 100 öre. */
export type Ore = number;

export function kronorToOre(kronor: number): Ore {
  return Math.round(kronor * 100);
}

export function oreToKronor(ore: Ore): number {
  return ore / 100;
}

export function formatSek(ore: Ore): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    maximumFractionDigits: 0,
  }).format(oreToKronor(ore));
}

export interface FeeSplit {
  /** Läggs ovanpå arvodet och betalas av företaget. */
  businessFeeBps: number;
  /** Dras från arvodet vid utbetalning till kreatören. */
  creatorFeeBps: number;
}

export const DEFAULT_FEE_SPLIT: FeeSplit = {
  businessFeeBps: BUSINESS_FEE_BPS,
  creatorFeeBps: CREATOR_FEE_BPS,
};

export interface FeeBreakdown {
  /** Det avtalade arvodet – utgångspunkten för båda avgifterna. */
  fee: Ore;
  /** Företagets del av förmedlingsavgiften. */
  businessFee: Ore;
  /** Vad företaget faktiskt betalar in: arvode plus deras avgift. */
  charge: Ore;
  /** Kreatörens del av förmedlingsavgiften. */
  creatorFee: Ore;
  /** Vad kreatören får utbetalt. */
  net: Ore;
  /** Plattformens hela intäkt på avtalet. */
  platformFee: Ore;
  split: FeeSplit;
}

/**
 * Räknar ut avgiftsfördelningen för ett kontrakt.
 *
 * Avgiften är delad. Företaget betalar sin del ovanpå arvodet, kreatören får
 * sin dragen från det. Avrundning sker alltid till plattformens nackdel, så
 * att `charge` och `net` stämmer på öret åt båda parter.
 *
 * Avtal från tiden med en odelad avgift skickar in `businessFeeBps: 0` och
 * hela satsen som `creatorFeeBps`, vilket ger exakt samma belopp som då.
 */
export function splitFee(fee: Ore, split: FeeSplit = DEFAULT_FEE_SPLIT): FeeBreakdown {
  if (!Number.isInteger(fee) || fee < 0) {
    throw new Error(`Arvodet måste vara ett icke-negativt heltal i öre, fick ${fee}`);
  }
  for (const bps of [split.businessFeeBps, split.creatorFeeBps]) {
    if (!Number.isFinite(bps) || bps < 0 || bps > 10_000) {
      throw new Error(`Avgift utanför intervallet 0–10000 baspunkter: ${bps}`);
    }
  }

  const businessFee = Math.floor((fee * split.businessFeeBps) / 10_000);
  const creatorFee = Math.floor((fee * split.creatorFeeBps) / 10_000);
  return {
    fee,
    businessFee,
    charge: fee + businessFee,
    creatorFee,
    net: fee - creatorFee,
    platformFee: businessFee + creatorFee,
    split,
  };
}
