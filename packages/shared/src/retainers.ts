/**
 * Löpande uppdrag: en kreatör producerar innehåll åt ett företag varje månad.
 *
 * Skillnaden mot en kampanj är inte storleken utan vem materialet är till för.
 * En kampanj går ut på kreatörens egen kanal – det är räckvidd, en gång. Ett
 * löpande uppdrag går ut på företagets kanaler, vecka efter vecka, och bygger
 * något som är deras. Kreatören kan inte posta om samma restaurang varje vecka
 * på sitt eget konto utan att bränna sin publik; på företagets konto kan hon.
 *
 * Ekonomiskt är skillnaden att pengarna rör sig i perioder i stället för i ett
 * enda avslut. Företaget betalar en månad i förskott, videorna levereras under
 * månaden, och vid periodens slut betalas kreatören för det som faktiskt
 * godkänts. Levererar hon färre än avtalat går mellanskillnaden tillbaka.
 */

import {
  DEFAULT_FEE_SPLIT,
  formatSek,
  splitFee,
  type FeeBreakdown,
  type FeeSplit,
  type Ore,
} from './money.js';

/**
 * Paketstorlekar, i videor per månad.
 *
 * Fasta steg och inte ett fritt tal: företagaren ska välja mellan tre saker,
 * inte fylla i en siffra, och kreatören ska kunna planera sin vecka utan att
 * varje kund har sitt eget antal.
 */
export const RETAINER_PACKAGES = [4, 8, 12] as const;
export type RetainerPackage = (typeof RETAINER_PACKAGES)[number];

/**
 * Vad de större paketen kostar i förhållande till grundpaketet.
 *
 * Priset per video sjunker med volymen, och det är inte en rabatt utan en
 * avspegling av arbetet: den första videon hos en ny kund kräver att kreatören
 * lär sig stället, resten gör det inte. Åtta videor kostar 1,8 gånger fyra,
 * inte två gånger.
 */
const PACKAGE_MULTIPLIER: Record<RetainerPackage, number> = {
  4: 1,
  8: 1.8,
  12: 2.5,
};

/** Antal månader i förskott som kan ge rabatt. */
export const PREPAY_MONTHS = 3;

/**
 * Rabattsatser kreatören kan välja mellan vid förskottsbetalning, i baspunkter.
 *
 * Noll står först och är förvalt. Rabatten är hennes pengar, inte plattformens
 * – att sätta den åt henne vore att förhandla bort en del av hennes arvode i
 * ett samtal hon inte var med i.
 */
export const PREPAY_DISCOUNT_CHOICES = [0, 500, 1000, 1500] as const;
export type PrepayDiscountBps = (typeof PREPAY_DISCOUNT_CHOICES)[number];

/** Vad appen kallar respektive sats. */
export const PREPAY_DISCOUNT_LABELS: Record<PrepayDiscountBps, string> = {
  0: 'Ingen rabatt',
  500: '5 %',
  1000: '10 %',
  1500: '15 %',
};

export function isPrepayDiscount(bps: number): bps is PrepayDiscountBps {
  return (PREPAY_DISCOUNT_CHOICES as readonly number[]).includes(bps);
}

/** Lägsta respektive högsta grundpris en kreatör får sätta, i öre. */
export const MIN_RETAINER_BASE_RATE = 200_000;
export const MAX_RETAINER_BASE_RATE = 5_000_000;

export function isRetainerPackage(videos: number): videos is RetainerPackage {
  return (RETAINER_PACKAGES as readonly number[]).includes(videos);
}

/**
 * Månadsarvodet för ett paket, räknat ur kreatörens grundpris.
 *
 * Kreatören sätter ett tal: vad hon vill ha för fyra videor i månaden. Resten
 * följer av paketskalan, så att hon slipper prissätta tre saker och företaget
 * slipper jämföra tre offerter. Avrundas till hela kronor – ett månadspris med
 * ören i ser ut som ett misstag.
 */
export function retainerMonthlyRate(baseRate: Ore, videosPerMonth: RetainerPackage): Ore {
  if (!Number.isInteger(baseRate) || baseRate < 0) {
    throw new Error('Grundpriset måste vara ett heltal i öre.');
  }
  return Math.round((baseRate * PACKAGE_MULTIPLIER[videosPerMonth]) / 100) * 100;
}

/** Alla tre paketen med sina priser, som de visas på kreatörens profil. */
export function retainerPackages(baseRate: Ore): { videosPerMonth: RetainerPackage; monthlyRate: Ore }[] {
  return RETAINER_PACKAGES.map((videosPerMonth) => ({
    videosPerMonth,
    monthlyRate: retainerMonthlyRate(baseRate, videosPerMonth),
  }));
}

/**
 * Rabatterat månadsarvode vid förskottsbetalning.
 *
 * Satsen är kreatörens egen. Rabatten dras på arvodet, inte på avgiften: det
 * är hon och företaget som gör upp om priset, och plattformens andel följer
 * med nedåt. Att låta rabatten bara belasta Pacta hade sett generöst ut och
 * gjort längre avtal olönsamma för oss.
 */
export function discountedMonthlyRate(
  monthlyRate: Ore,
  months: number,
  discountBps: number,
): Ore {
  if (months < PREPAY_MONTHS || discountBps <= 0) return monthlyRate;
  return Math.round((monthlyRate * (10_000 - discountBps)) / 10_000);
}

export interface RetainerPeriodMoney extends FeeBreakdown {
  videosPerMonth: RetainerPackage;
  /** Vad en enskild video är värd när perioden räknas av. */
  perVideo: Ore;
}

/** Pengarna i en enskild period: arvode, avgifter och vad företaget drar. */
export function retainerPeriodMoney(
  monthlyRate: Ore,
  videosPerMonth: RetainerPackage,
  split: FeeSplit = DEFAULT_FEE_SPLIT,
): RetainerPeriodMoney {
  const breakdown = splitFee(monthlyRate, split);
  return {
    ...breakdown,
    videosPerMonth,
    perVideo: Math.floor(monthlyRate / videosPerMonth),
  };
}

export interface PeriodSettlement {
  /** Kreatörens arvode för det som faktiskt godkänts, före avgift. */
  earned: Ore;
  /** Vad kreatören får utbetalt efter sin del av avgiften. */
  payout: Ore;
  /** Vad företaget får tillbaka för videor som aldrig kom. */
  refund: Ore;
  /** Plattformens intäkt, nedskriven i samma proportion. */
  platformFee: Ore;
}

/**
 * Avräkningen när en period stängs.
 *
 * Full leverans betalar hela arvodet – ingen proportionering, ingen avrundning
 * som kan göra att den som gjort allt får en krona för lite. Uteblivna videor
 * dras av per styck och går tillbaka till företaget tillsammans med den del av
 * avgiften de bar. Att behålla avgiften på en video som aldrig levererades vore
 * att ta betalt för ingenting.
 */
export function settlePeriod(
  money: RetainerPeriodMoney,
  videosApproved: number,
): PeriodSettlement {
  if (!Number.isInteger(videosApproved) || videosApproved < 0) {
    throw new Error('Antalet godkända videor måste vara ett heltal noll eller större.');
  }

  const delivered = Math.min(videosApproved, money.videosPerMonth);
  if (delivered === money.videosPerMonth) {
    return {
      earned: money.fee,
      payout: money.net,
      refund: 0,
      platformFee: money.platformFee,
    };
  }

  const earned = money.perVideo * delivered;
  const settled = splitFee(earned, money.split);
  return {
    earned,
    payout: settled.net,
    refund: money.charge - settled.charge,
    platformFee: settled.platformFee,
  };
}

/** Sista dagen i en period som börjar på ett visst datum. */
export function periodEnd(start: Date): Date {
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return end;
}

/**
 * Uppsägning tar effekt vid periodens slut, aldrig mitt i.
 *
 * Företaget har betalat för månaden och kreatören har planerat in den. Att
 * bryta mitt i skulle kräva en delåterbetalning och lämna henne med luckor hon
 * inte kan fylla med en dags varsel.
 */
export function cancellationTakesEffect(currentPeriodEnd: Date): Date {
  return new Date(currentPeriodEnd);
}

export interface RetainerTermsInput {
  businessName: string;
  orgNumber: string;
  creatorName: string;
  city: string;
  videosPerMonth: RetainerPackage;
  monthlyRate: Ore;
  listRate: Ore;
  prepaidMonths: number;
  /** Rabatten som faktiskt tillämpats, i baspunkter. */
  prepayDiscountBps: number;
  /** Kanalerna innehållet publiceras på, t.ex. ["Instagram @kajutan"]. */
  channels: string[];
  money: FeeBreakdown;
  startsAt: Date;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', { dateStyle: 'long' }).format(date);
}

/**
 * Avtalstexten för ett löpande uppdrag.
 *
 * Tre saker skiljer den från kampanjavtalet, och alla tre följer av att
 * materialet publiceras på företagets kanaler i stället för kreatörens.
 *
 * Godkännandet auto-godkänns aldrig. På en kampanj är det kreatörens eget
 * konto och hennes eget rykte som står på spel om företaget somnar; här är det
 * företagets konto, och ett inlägg som inte borde ha gått ut går inte att ta
 * tillbaka.
 *
 * Företaget får en varaktig rätt att använda materialet i sina egna kanaler.
 * De har betalat för produktionen, inte för hennes publik, och ett klipp de
 * inte får ha kvar på sitt eget konto vore värdelöst för dem.
 *
 * Åtkomsten till kontona ges utanför Pacta. Vi tar aldrig emot lösenord.
 */
export function renderRetainerTerms(input: RetainerTermsInput): string {
  const channels = input.channels.length > 0 ? input.channels.join(', ') : 'anges vid start';
  const prepay =
    input.prepaidMonths > 1
      ? `Uppdragsgivaren har betalat ${input.prepaidMonths} månader i förskott och fått ${(input.prepayDiscountBps / 100).toFixed(0)} % rabatt som uppdragstagaren erbjudit (ordinarie ${formatSek(input.listRate)} per månad).`
      : 'Uppdraget löper månad för månad utan bindningstid.';

  return `# Avtal om löpande innehållsproduktion

**Uppdragsgivare:** ${input.businessName}, org.nr ${input.orgNumber}
**Uppdragstagare:** ${input.creatorName}
**Ort:** ${input.city}
**Startar:** ${formatDate(input.startsAt)}

Avtalet ingås via Pacta, som förmedlar uppdraget och hanterar betalningen. Pacta är inte part i avtalet och är inte arbetsgivare åt uppdragstagaren.

## 1. Uppdraget

Uppdragstagaren producerar **${input.videosPerMonth} videor per månad** åt uppdragsgivaren och publicerar dem på uppdragsgivarens egna kanaler: ${channels}.

Uppdragstagaren bestämmer själv hur och när arbetet utförs, håller egna verktyg och utför uppdraget som självständig näringsidkare med F-skatt eller genom ett egenanställningsföretag. Uppdraget innebär inte anställning.

## 2. Ersättning

| | |
|---|---|
| Arvode per månad | **${formatSek(input.money.fee)}** |
| Förmedlingsavgift, uppdragsgivaren | ${formatSek(input.money.businessFee)} |
| **Uppdragsgivaren betalar in** | **${formatSek(input.money.charge)}** |
| Förmedlingsavgift, uppdragstagaren | −${formatSek(input.money.creatorFee)} |
| **Utbetalas till uppdragstagaren** | **${formatSek(input.money.net)}** |

${prepay}

Uppdragsgivaren betalar in hela månaden i förskott. Beloppet hålls av betaltjänsten under perioden och betalas ut när perioden avslutas. Levereras och godkänns färre videor än avtalat betalas arvodet ned i motsvarande grad, och mellanskillnaden går tillbaka till uppdragsgivaren tillsammans med den del av förmedlingsavgiften som hörde till.

## 3. Godkännande före publicering

Varje video och tillhörande bildtext lämnas i Pacta och får publiceras först när uppdragsgivaren godkänt den. Ett uteblivet svar räknas aldrig som ett godkännande.

Uppdragsgivaren kan begära ändring med en motivering. Uppdragstagaren lämnar då en ny version. En video räknas som levererad när den är godkänd.

## 4. Åtkomst till kanalerna

Uppdragsgivaren ger uppdragstagaren åtkomst till sina konton genom plattformarnas egna verktyg för delad åtkomst. Lösenord lämnas inte ut och hanteras aldrig av Pacta.

Uppdragstagaren får publicera godkänt material och inget annat. Hon ändrar inte kontots inställningar, kopplingar eller övriga innehåll, och svarar inte i uppdragsgivarens namn utan särskild överenskommelse.

Uppdragsgivaren kan när som helst dra tillbaka åtkomsten. Görs det under en pågående period fortsätter arvodet att löpa för videor som redan producerats och godkänts.

## 5. Rätten till materialet

Uppdragstagaren behåller upphovsrätten. Uppdragsgivaren får en varaktig, icke-exklusiv rätt att använda materialet i sina egna kanaler och i marknadsföring av den egna verksamheten, inklusive betald spridning av de egna inläggen. Rätten gäller även efter att uppdraget avslutats.

Uppdragstagaren får visa materialet i sin egen portfölj. Vidareförsäljning till tredje part kräver skriftligt medgivande från båda.

Syns identifierbara personer i materialet ansvarar den som filmar för att samtycke inhämtats, och uppdragsgivaren för att samtycket gäller för den användning som sker i deras kanaler.

## 6. Uppsägning

Vardera parten kan säga upp uppdraget. Uppsägningen träder i kraft när den pågående, betalda perioden löper ut – aldrig mitt i en period.

Har uppdragsgivaren betalat flera månader i förskott återbetalas outnyttjade hela perioder. Den pågående perioden avräknas enligt punkt 2.

## 7. Tvist

Svensk lag gäller. Tvist avgörs av svensk allmän domstol.`;
}
