import { formatSek, splitFee, type DeliverableKind, type Ore } from '@influencerlink/shared';
import { sha256Hex } from '../lib/crypto.js';

/** Leverabler skrivna som de ska stå i avtalet. */
const DELIVERABLE_LABELS: Record<DeliverableKind, string> = {
  TIKTOK_VIDEO: 'en TikTok-video (minst 20 sekunder)',
  INSTAGRAM_REEL: 'en Instagram Reel (minst 15 sekunder)',
  INSTAGRAM_POST: 'ett Instagram-inlägg i flödet',
  INSTAGRAM_STORY: 'en Instagram-story med länkklistermärke',
  YOUTUBE_SHORT: 'en YouTube Short',
  YOUTUBE_VIDEO: 'ett omnämnande i en YouTube-video',
};

export function describeDeliverable(kind: DeliverableKind): string {
  return DELIVERABLE_LABELS[kind];
}

export interface ContractTermsInput {
  contractId: string;
  businessName: string;
  businessOrgNumber: string;
  influencerName: string;
  influencerPersonalNumberMask: string;
  campaignTitle: string;
  campaignBrief: string;
  deliverables: DeliverableKind[];
  fee: Ore;
  platformFeeBps: number;
  dueDate: Date;
  reviewDays: number;
  extraTerms: string;
}

const dateFormatter = new Intl.DateTimeFormat('sv-SE', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

/**
 * Genererar avtalstexten. Texten fryses när kontraktet skickas och det är
 * exakt denna sträng som hashas och signeras med BankID – därför får den
 * aldrig innehålla något som varierar mellan två anrop (som dagens datum).
 */
export function renderContractTerms(input: ContractTermsInput): string {
  const { platformFee, net } = splitFee(input.fee, input.platformFeeBps);
  const deliverableList = input.deliverables
    .map((kind, index) => `${index + 1}. ${describeDeliverable(kind)}`)
    .join('\n');

  return `# Samarbetsavtal

**Avtalsnummer:** ${input.contractId}

## 1. Parter

**Uppdragsgivare:** ${input.businessName}, org.nr ${formatOrgNumber(input.businessOrgNumber)}
**Uppdragstagare:** ${input.influencerName}, personnr ${input.influencerPersonalNumberMask}

Avtalet ingås via InfluencerLink, som förmedlar uppdraget och hanterar betalningen.

## 2. Uppdraget

Kampanj: **${input.campaignTitle}**

${input.campaignBrief}

Uppdragstagaren ska leverera:

${deliverableList}

Materialet ska vara publicerat senast **${dateFormatter.format(input.dueDate)}**.

## 3. Ersättning

| Post | Belopp |
| --- | --- |
| Arvode | ${formatSek(input.fee)} |
| Plattformsavgift (${(input.platformFeeBps / 100).toFixed(1)} %) | −${formatSek(platformFee)} |
| **Utbetalas till uppdragstagaren** | **${formatSek(net)}** |

Uppdragsgivaren betalar in hela arvodet till InfluencerLink när avtalet blir bindande. Beloppet hålls kvar och betalas ut till uppdragstagaren när leveransen godkänts. Uppdragsgivaren har ${input.reviewDays} dagar på sig att granska leveransen; därefter godkänns den automatiskt och utbetalning sker.

Angivna belopp är exklusive mervärdesskatt. Uppdragstagaren ansvarar själv för skatt och eventuella sociala avgifter på ersättningen.

## 4. Marknadsföringsrättslig märkning

Uppdragstagaren ska tydligt märka allt material som reklam i enlighet med marknadsföringslagen (2008:486) och Konsumentverkets vägledning, till exempel med "Reklam för ${input.businessName}" eller "Samarbete". Märkningen ska synas utan att mottagaren behöver klicka vidare.

## 5. Rättigheter till materialet

Uppdragstagaren behåller upphovsrätten till materialet. Uppdragsgivaren får en icke-exklusiv rätt att återpublicera materialet i sina egna kanaler i sex (6) månader från publiceringen, med angivande av uppdragstagarens användarnamn. All annan användning, inklusive betald annonsering, kräver skriftligt medgivande.

## 6. Ändring och avbokning

Avbokas uppdraget av uppdragsgivaren senare än 48 timmar före avtalad publicering utgår halva arvodet. Levererar uppdragstagaren inte i tid återbetalas hela beloppet till uppdragsgivaren, om parterna inte kommer överens om ett nytt datum.

## 7. Personuppgifter

Parterna behandlar personuppgifter enligt dataskyddsförordningen (EU) 2016/679. InfluencerLink är personuppgiftsansvarig för uppgifterna i plattformen.

## 8. Tvist

Svensk rätt tillämpas. Tvist avgörs av svensk allmän domstol med Stockholms tingsrätt som första instans.
${input.extraTerms.trim() ? `\n## 9. Särskilda villkor\n\n${input.extraTerms.trim()}\n` : ''}
---

Avtalet undertecknas av båda parter med svenskt BankID. Signaturerna loggas med tidsstämpel och avtalstextens kontrollsumma.`;
}

/** Kontrollsumman som signeras med BankID och sparas tillsammans med signaturen. */
export function hashTerms(terms: string): string {
  return sha256Hex(terms);
}

/** "5560000000" → "556000-0000" */
function formatOrgNumber(orgNumber: string): string {
  return `${orgNumber.slice(0, 6)}-${orgNumber.slice(6)}`;
}

/**
 * Texten användaren ser i BankID-appen. Håll den kort – appen visar bara ett
 * fåtal rader – men tillräckligt specifik för att signeringen ska vara giltig.
 */
export function buildSigningText(input: {
  campaignTitle: string;
  counterpartName: string;
  fee: Ore;
  contractId: string;
}): string {
  return [
    `Signera samarbetsavtal med ${input.counterpartName}`,
    `Kampanj: ${input.campaignTitle}`,
    `Arvode: ${formatSek(input.fee)}`,
    `Avtalsnummer: ${input.contractId}`,
  ].join('\n');
}
