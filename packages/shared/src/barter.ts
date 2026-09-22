import type { Ore } from './money.js';

/**
 * Mat mot innehåll.
 *
 * Ett bartersamarbete är ett uppdrag där ersättningen är en måltid eller ett
 * besök i stället för pengar. Det finns för de två som marknadsplatsen annars
 * missar: kvarterskrogen som inte har 4 000 kr för en kampanj, och kreatören
 * som ännu inte kan ta betalt men behöver något att visa upp.
 *
 * Eftersom inga pengar rör sig finns här varken escrow eller avgift. Det som
 * håller ihop affären är i stället att uppdraget är skrivet, att båda parter
 * har betyg, och att den som inte fullföljer syns.
 *
 * Restaurangen betalar i stället en månadsavgift för att få ha sådana uppdrag
 * uppe. Nivån avgör hur många samarbeten som får starta per kalendermånad.
 */

export const BARTER_PLANS = ['NONE', 'BASIC', 'MEDIUM', 'ADVANCED'] as const;
export type BarterPlan = (typeof BARTER_PLANS)[number];

export interface BarterPlanSpec {
  /** Namnet företaget ser. */
  label: string;
  /** Månadsavgift i öre. Noll för NONE. */
  monthlyPrice: Ore;
  /** Hur många samarbeten som får starta per kalendermånad. */
  monthlyCollabs: number;
  /** En mening som säger vem nivån passar. */
  lead: string;
}

/**
 * Priser och tak.
 *
 * Talen står här och ingen annanstans, så att en prisändring är en rad. Att
 * de är hårdkodade i stället för att ligga i databasen är ett medvetet val så
 * länge alla betalar samma: en pristabell som ingen ändrar är en tabell att
 * hålla i synk i onödan.
 */
export const BARTER_PLAN_SPECS: Record<BarterPlan, BarterPlanSpec> = {
  NONE: {
    label: 'Inget abonnemang',
    monthlyPrice: 0,
    monthlyCollabs: 0,
    lead: 'Mat mot innehåll kräver ett abonnemang.',
  },
  BASIC: {
    label: 'Basic',
    monthlyPrice: 49_500,
    monthlyCollabs: 2,
    lead: 'För er som vill prova. Två samarbeten i månaden.',
  },
  MEDIUM: {
    label: 'Medium',
    monthlyPrice: 89_500,
    monthlyCollabs: 5,
    lead: 'Ett samarbete i veckan, ungefär.',
  },
  ADVANCED: {
    label: 'Advanced',
    monthlyPrice: 149_500,
    monthlyCollabs: 12,
    lead: 'För er som vill ha nytt innehåll flera gånger i veckan.',
  },
};

/** Nivåerna i den ordning de ska visas. NONE är ett tillstånd, inte ett val. */
export const SELLABLE_BARTER_PLANS: Exclude<BarterPlan, 'NONE'>[] = [
  'BASIC',
  'MEDIUM',
  'ADVANCED',
];

export interface BarterUsage {
  plan: BarterPlan;
  /** Samarbeten som startat den här kalendermånaden. */
  used: number;
}

export interface BarterAllowance extends BarterUsage {
  /** Taket för nivån. */
  limit: number;
  /** Hur många som är kvar. Aldrig negativt. */
  remaining: number;
  /** Sant när ett nytt samarbete får startas. */
  canStart: boolean;
}

export function barterAllowance({ plan, used }: BarterUsage): BarterAllowance {
  const limit = BARTER_PLAN_SPECS[plan].monthlyCollabs;
  const remaining = Math.max(0, limit - used);
  return { plan, used, limit, remaining, canStart: remaining > 0 };
}

/**
 * Varför ett bartersamarbete inte får startas, eller null när det får det.
 *
 * Svaret är meningen användaren ska läsa. Ett nekande utan orsak lämnar den
 * som fick det med att gissa, och gissningen blir nästan alltid "appen är
 * trasig" i stället för "abonnemanget är slut den här månaden".
 */
export function barterBlocker(usage: BarterUsage): string | null {
  const allowance = barterAllowance(usage);
  if (allowance.plan === 'NONE') {
    return 'Mat mot innehåll kräver ett abonnemang. Välj en nivå under Uppdrag.';
  }
  if (!allowance.canStart) {
    return `Er nivå ${BARTER_PLAN_SPECS[allowance.plan].label} tillåter ${allowance.limit} samarbeten i månaden, och de är använda. Nästa månad öppnar det igen, eller så byter ni nivå.`;
  }
  return null;
}

/** Hur många öppna bartersamarbeten en kreatör får ha samtidigt. */
export const MAX_OPEN_BARTER_PER_CREATOR = 2;

export interface CreatorReliability {
  /** Bartersamarbeten som fullföljts. */
  completed: number;
  /** Bartersamarbeten som passerat sitt datum utan leverans. */
  abandoned: number;
}

/**
 * Raden som visas på kreatörens kort.
 *
 * Måttet räknas fram ur avtalen i stället för att någon anmäler någon. Det
 * finns inget formulär för "hen kom inte" – ett sådant hade varit ett vapen,
 * och det hade dessutom krävt att någon orkar fylla i det. Ett avtal som
 * passerat sitt datum utan leverans säger samma sak, av sig självt.
 */
export function describeReliability(stats: CreatorReliability): string | null {
  const total = stats.completed + stats.abandoned;
  if (total === 0) return null;
  if (stats.abandoned === 0) {
    return `${stats.completed} genomförda samarbeten`;
  }
  return `${stats.completed} genomförda · ${stats.abandoned} avbrutna`;
}
