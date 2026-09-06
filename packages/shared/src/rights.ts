import { formatSek, type Ore } from './money.js';

/**
 * Rätten att köra materialet som annons.
 *
 * Grundavtalets §5 ger företaget rätt att återpublicera i egna kanaler, men
 * undantar betald annonsering. Det är just den användningen som är värd mest
 * för företaget – och den kreatören ska få betalt för.
 *
 * Tillägget erbjuds först när filmen har mätbara visningar. En företagare som
 * gör sitt första samarbete ska inte behöva ta ställning till nyttjanderätt
 * innan de vet om materialet ens blev bra.
 */

/** Så länge företaget får annonsera med materialet. */
export const USAGE_RIGHTS_MONTHS = 12;

/** Priset är ett påslag på arvodet: 40 % av det som avtalades. */
export const USAGE_RIGHTS_MARKUP = 0.4;

/** Kreatörens andel av tillägget. Det är deras material. */
export const USAGE_RIGHTS_CREATOR_BPS = 7000;

export interface UsageRightsPrice {
  /** Vad företaget betalar för tillägget. */
  amount: Ore;
  /** Kreatörens del. */
  creatorShare: Ore;
  /** Plattformens del. */
  platformShare: Ore;
}

/**
 * Vad tillägget kostar och hur det delas. Avrundningen går till kreatören,
 * precis som i splitFee: plattformen tar mellanskillnaden, aldrig kreatören.
 */
export function usageRightsPrice(fee: Ore): UsageRightsPrice {
  if (!Number.isInteger(fee) || fee < 0) {
    throw new Error(`Arvodet måste vara ett icke-negativt heltal i öre, fick ${fee}`);
  }
  const amount = Math.round(fee * USAGE_RIGHTS_MARKUP);
  const creatorShare = Math.ceil((amount * USAGE_RIGHTS_CREATOR_BPS) / 10_000);
  return { amount, creatorShare, platformShare: amount - creatorShare };
}

/**
 * Om tillägget går att erbjuda ännu.
 *
 * Kräver att materialet är levererat och att det finns visningar att visa upp.
 * Utan siffror är erbjudandet en abstrakt juridisk fråga, och då tackar folk
 * nej av osäkerhet snarare än för att de inte vill.
 */
export function canOfferUsageRights(input: {
  deliveredAt: Date | string | null;
  views: number;
  existing: boolean;
}): boolean {
  return Boolean(input.deliveredAt) && input.views > 0 && !input.existing;
}

export interface UsageRightsTermsInput {
  contractId: string;
  businessName: string;
  influencerName: string;
  campaignTitle: string;
  fee: Ore;
  months: number;
}

/**
 * Tilläggets text. Fryses när förfrågan skickas, precis som avtalstexten, så
 * att båda parter kan visa exakt vad de sa ja till.
 */
export function renderUsageRightsTerms(input: UsageRightsTermsInput): string {
  const price = usageRightsPrice(input.fee);

  return `# Tillägg om annonsering

**Till avtal:** ${input.contractId}
**Kampanj:** ${input.campaignTitle}

## Vad tillägget ger

${input.businessName} får rätt att använda materialet från samarbetet i betald annonsering i ${input.months} månader från det att detta tillägg godkänts. Rätten omfattar annonsering från uppdragsgivarens egna konton, inklusive material som ${input.influencerName} publicerat på sina kanaler.

Rätten är icke-exklusiv. ${input.influencerName} behåller upphovsrätten och får fortsätta använda materialet fritt.

## Vad tillägget inte ger

Materialet får inte klippas om på ett sätt som förvanskar innehållet eller ${input.influencerName}s medverkan, och inte vidarelicensieras eller säljas vidare. Nya inspelningar eller ytterligare leveranser ingår inte.

Uppdragsgivaren ansvarar för att annonserna märks som reklam enligt marknadsföringslagen (2008:486), på samma sätt som grundavtalet kräver.

## Ersättning

| Post | Belopp |
| --- | --- |
| Tillägg för annonsrätt | ${formatSek(price.amount)} |
| **Till ${input.influencerName}** | **${formatSek(price.creatorShare)}** |
| Förmedlingsavgift | ${formatSek(price.platformShare)} |

Beloppet betalas in av uppdragsgivaren när tillägget godkänts och betalas ut till uppdragstagaren när betalningen kommit in.

## Övrigt

I övrigt gäller grundavtalets villkor oförändrade. Tillägget upphör automatiskt efter ${input.months} månader utan att någon part behöver säga upp det.`;
}
