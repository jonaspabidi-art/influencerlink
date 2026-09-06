import { PLATFORMS, type DeliverableKind, type Platform } from './domain.js';
import { formatSek, splitFee, type FeeSplit, type Ore } from './money.js';

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
  /** Avgiftsfördelningen som gällde när avtalet tecknades. */
  feeSplit: FeeSplit;
  dueDate: Date;
  reviewDays: number;
  extraTerms: string;
  /**
   * Uppdragsgivarens egna konton. Kreatören måste veta vilket konto hon ska
   * tagga, och den uppgiften hör hemma i avtalet – inte i ett chattmeddelande
   * som försvinner uppåt i tråden.
   */
  businessAccounts?: { platform: Platform; handle: string }[];
}

/** Konton i fast ordning. Avtalstexten hashas – den får inte variera. */
function renderAccounts(accounts: { platform: Platform; handle: string }[]): string {
  const labels: Record<Platform, string> = {
    TIKTOK: 'TikTok',
    INSTAGRAM: 'Instagram',
    YOUTUBE: 'YouTube',
  };
  return accounts
    .slice()
    .sort((a, b) => PLATFORMS.indexOf(a.platform) - PLATFORMS.indexOf(b.platform))
    .map((account) => `${labels[account.platform]} @${account.handle}`)
    .join(', ');
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
  const money = splitFee(input.fee, input.feeSplit);
  const accounts = renderAccounts(input.businessAccounts ?? []);
  const deliverableList = input.deliverables
    .map((kind, index) => `${index + 1}. ${describeDeliverable(kind)}`)
    .join('\n');

  return `# Samarbetsavtal

**Avtalsnummer:** ${input.contractId}

## 1. Parter

**Uppdragsgivare:** ${input.businessName}, org.nr ${formatOrgNumber(input.businessOrgNumber)}
**Uppdragstagare:** ${input.influencerName}, personnr ${input.influencerPersonalNumberMask}

Avtalet ingås via Pacta, som förmedlar uppdraget och hanterar betalningen.

## 2. Uppdraget

Kampanj: **${input.campaignTitle}**

${input.campaignBrief}

Uppdragstagaren ska leverera:

${deliverableList}

Innan publicering lämnar uppdragstagaren materialet för godkännande i Pacta. Uppdragsgivaren har ${input.reviewDays} dagar på sig att godkänna eller begära ändring; svarar uppdragsgivaren inte inom den tiden räknas materialet som godkänt och får publiceras.

Materialet ska vara publicerat senast **${dateFormatter.format(input.dueDate)}**.

## 3. Ersättning

| Post | Belopp |
| --- | --- |
| Arvode | ${formatSek(input.fee)} |
| Förmedlingsavgift, uppdragsgivaren (${percent(input.feeSplit.businessFeeBps)} %) | +${formatSek(money.businessFee)} |
| **Uppdragsgivaren betalar in** | **${formatSek(money.charge)}** |
| Förmedlingsavgift, uppdragstagaren (${percent(input.feeSplit.creatorFeeBps)} %) | −${formatSek(money.creatorFee)} |
| **Utbetalas till uppdragstagaren** | **${formatSek(money.net)}** |

Uppdragsgivaren betalar in arvodet och sin del av förmedlingsavgiften till Pacta när avtalet blir bindande. Beloppet hålls kvar och betalas ut till uppdragstagaren när leveransen godkänts. Uppdragsgivaren har ${input.reviewDays} dagar på sig att granska leveransen; därefter godkänns den automatiskt och utbetalning sker.

Angivna belopp är exklusive mervärdesskatt. Uppdragstagaren ansvarar själv för skatt och eventuella sociala avgifter på ersättningen.

## 4. Marknadsföringsrättslig märkning

Uppdragstagaren ska tydligt märka allt material som reklam i enlighet med marknadsföringslagen (2008:486) och Konsumentverkets vägledning, till exempel med "Reklam för ${input.businessName}" eller "Samarbete". Märkningen ska synas utan att mottagaren behöver klicka vidare.
${
    accounts
      ? `\nUppdragstagaren ska tagga uppdragsgivarens konto i inlägget: ${accounts}.\n`
      : ''
  }
## 5. Rättigheter till materialet

Uppdragstagaren behåller upphovsrätten till materialet. Uppdragsgivaren får en icke-exklusiv rätt att återpublicera materialet i sina egna kanaler i sex (6) månader från publiceringen, med angivande av uppdragstagarens användarnamn. All annan användning, inklusive betald annonsering, kräver skriftligt medgivande.

Rätten omfattar även den filmfil uppdragstagaren lämnat för godkännande, i samma omfattning och under samma tid. Uppdragsgivaren får inte vidarelicensiera materialet, sälja det, eller ändra det på ett sätt som förvanskar innehållet eller uppdragstagarens medverkan.

Medverkar någon annan person i materialet ansvarar uppdragstagaren för att ha deras samtycke till den användning som anges här.

## 6. Ändring och avbokning

Avbokas uppdraget av uppdragsgivaren senare än 48 timmar före avtalad publicering utgår halva arvodet. Levererar uppdragstagaren inte i tid återbetalas hela beloppet till uppdragsgivaren, om parterna inte kommer överens om ett nytt datum.

## 7. Personuppgifter

Parterna behandlar personuppgifter enligt dataskyddsförordningen (EU) 2016/679. Pacta är personuppgiftsansvarig för uppgifterna i plattformen.

## 8. Tvist

Svensk rätt tillämpas. Tvist avgörs av svensk allmän domstol med Stockholms tingsrätt som första instans.
${input.extraTerms.trim() ? `\n## 9. Särskilda villkor\n\n${input.extraTerms.trim()}\n` : ''}
---

Avtalet undertecknas av båda parter med svenskt BankID. Signaturerna loggas med tidsstämpel och avtalstextens kontrollsumma.`;
}

/** 1000 baspunkter → "10,0". Kommatecken, eftersom avtalet är på svenska. */
function percent(bps: number): string {
  return (bps / 100).toFixed(1).replace('.', ',');
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
