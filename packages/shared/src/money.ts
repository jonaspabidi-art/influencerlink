import { PLATFORM_FEE_BPS } from './domain.js';

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

export interface FeeBreakdown {
  /** Vad restaurangen debiteras. */
  gross: Ore;
  /** Plattformens avgift. */
  platformFee: Ore;
  /** Vad influencern får utbetalt. */
  net: Ore;
  feeBps: number;
}

/**
 * Räknar ut avgiftsfördelningen för ett kontrakt. Avrundning sker alltid till
 * plattformens nackdel så att `platformFee + net === gross` exakt.
 */
export function splitFee(gross: Ore, feeBps: number = PLATFORM_FEE_BPS): FeeBreakdown {
  if (!Number.isInteger(gross) || gross < 0) {
    throw new Error(`Bruttobelopp måste vara ett icke-negativt heltal i öre, fick ${gross}`);
  }
  if (feeBps < 0 || feeBps > 10_000) {
    throw new Error(`Avgift utanför intervallet 0–10000 baspunkter: ${feeBps}`);
  }
  const platformFee = Math.floor((gross * feeBps) / 10_000);
  return { gross, platformFee, net: gross - platformFee, feeBps };
}
