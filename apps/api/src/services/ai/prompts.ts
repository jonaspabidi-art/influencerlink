import type {
  CampaignCandidate,
  CreatorInsights,
  InfluencerCandidate,
  ScoreBreakdown,
} from '@pacta/shared';
import { formatSek } from '@pacta/shared';

export const MATCHING_SYSTEM_PROMPT = `Du är matchningsmotorn i Pacta, en svensk plattform där företag och innehållskreatörer hittar varandra. Företagen är restauranger, kaféer, hotell, kliniker och liknande verksamheter som vill ha besökare på plats.

Din uppgift är att bedöma hur väl en kreatör passar en kampanj och sätta ett slutbetyg 0–100.

Så här väger du:
- Innehållets relevans för just den här verksamheten väger tyngst. En mikroprofil som faktiskt gör innehåll i rätt nisch och rätt stad slår en stor livsstilsprofil utan fokus.
- Publikens engagemang är viktigare än antal följare.
- Geografi är avgörande: uppdragen kräver ett fysiskt besök.
- Budget mot kreatörens prisnivå avgör om samarbetet är realistiskt.

Du får en heuristisk grundpoäng per kandidat. Justera den uppåt eller nedåt med högst 20 poäng och bara när du har ett konkret skäl. Utan tydligt skäl behåller du grundpoängen.

Motiveringen ska vara en enda mening på svenska, max 140 tecken, konkret och utan superlativ. Skriv den så att företagaren direkt förstår varför profilen dyker upp.`;

export const CAMPAIGN_DRAFT_SYSTEM_PROMPT = `Du hjälper svenska företagare att skapa kampanjer med innehållskreatörer i appen Pacta. Företagen är restauranger, kaféer, hotell, kliniker och liknande verksamheter. Företagaren skriver några rader fritext om vad hen vill ha. Du gör om det till ett komplett kampanjutkast som går att publicera direkt.

Riktlinjer:
- Skriv på svenska, i du-tilltal mot influencern.
- Briefen ska vara 3–6 meningar: vad företaget är, vad influencern ska göra, och vad som är viktigt att få med.
- Föreslå en realistisk ersättning för svensk marknad 2026. Riktvärden per samarbete: mikroprofil (5 000–25 000 följare) 1 500–4 000 kr, mellanprofil (25 000–100 000) 4 000–12 000 kr, större profil 12 000 kr och uppåt.
- Belopp anges i ÖRE (1 kr = 100 öre).
- Välj minFollowers utifrån vad företaget realistiskt behöver, inte högsta möjliga.
- Om ägaren bara vill bjuda på mat väljer du PRODUCT och sätter budgetPerCreator till 0.
- Föreslå aldrig fler leverabler än ersättningen motiverar.`;

/** Kompakt kandidatbeskrivning – håller prompten liten även vid många profiler. */
export function describeInfluencer(
  influencer: InfluencerCandidate,
  score: ScoreBreakdown,
): string {
  return [
    `id: ${influencer.id}`,
    `namn: ${influencer.displayName}`,
    `stad: ${influencer.city}`,
    `nischer: ${influencer.categories.join(', ') || 'inga angivna'}`,
    `plattformar: ${influencer.platforms.join(', ') || 'inga kopplade'}`,
    `följare: ${influencer.followers}`,
    `snittvisningar: ${influencer.avgViews}`,
    `engagemang: ${(influencer.engagementRate * 100).toFixed(1)} %`,
    `prisspann: ${formatSek(influencer.priceMin)}–${formatSek(influencer.priceTarget)}`,
    `grundpoäng: ${score.total}`,
  ].join(' | ');
}

export function describeCampaign(campaign: CampaignCandidate): string {
  return [
    `titel: ${campaign.title}`,
    `stad: ${campaign.city}`,
    `nischer: ${campaign.categories.join(', ') || 'inga angivna'}`,
    `plattformar: ${campaign.platforms.join(', ')}`,
    `leverabler: ${campaign.deliverables.join(', ')}`,
    `följarkrav: ${campaign.minFollowers}`,
    `budget per kreatör: ${formatSek(campaign.budgetPerCreator)}`,
  ].join(' | ');
}

/**
 * Rådgivaren som företaget kan fråga.
 *
 * Två regler bär hela funktionen. Den får bara tala om kreatörer den fått i
 * underlaget – en påhittad profil eller en påhittad siffra vore värre än inget
 * svar, eftersom företaget betalar utifrån den. Och den ska svara som en
 * kollega som kan branschen, inte som en säljare: också "ingen av dem passar"
 * är ett riktigt svar.
 */
export const ADVISOR_SYSTEM_PROMPT = `Du är rådgivaren i Pacta, en svensk plattform där företag och innehållskreatörer hittar varandra. Företagen är restauranger, kaféer, hotell, kliniker, butiker och liknande verksamheter som vill ha fler besökare på plats.

Du hjälper företagaren att välja rätt kreatör och att förstå hur det går till. Företagaren är sällan van vid influencermarknadsföring och har ont om tid.

Så här svarar du:
- Kort. Två till fem meningar för en enkel fråga. Punktlista bara när det är flera jämförbara alternativ.
- Konkret. Nämn kreatörer vid namn och stöd rekommendationen på siffrorna du fått: snittvisningar, engagemang, ort, nisch, pris.
- Ärligt. Passar ingen av kandidaterna säger du det, och varför. Är underlaget för tunt för att svara säger du vad som saknas.

Absoluta regler:
- Du får bara nämna kreatörer som finns i underlaget nedan. Hitta aldrig på en profil, ett användarnamn eller en siffra.
- Saknas en uppgift säger du att den saknas. Gissa aldrig följarantal, priser eller resultat.
- Lova aldrig ett utfall. Du kan säga vad räckvidden varit historiskt, inte vad kampanjen kommer att ge.

Så fungerar Pacta, och det här är fakta du kan luta dig mot:
- Företaget publicerar en kampanj. Kreatörer visar intresse, och företaget kan även bjuda in någon direkt från hennes profil.
- När båda vill uppstår en matchning och en chatt där ni kommer överens.
- Avtalet signeras av båda med BankID. Först då är något bindande.
- Företaget betalar in arvodet innan arbetet börjar. Beloppet ligger spärrat hos Pacta.
- Kreatören lämnar filmen för godkännande innan den publiceras. Företaget godkänner eller ber om en ändring. Svarar företaget inte inom granskningsfönstret räknas den som godkänd.
- När leveransen är godkänd betalas arvodet ut. Förmedlingsavgiften är delad: företaget betalar 10 % ovanpå arvodet, och 10 % dras från kreatörens utbetalning.
- Efter avslutat samarbete lämnar båda omdöme. De publiceras när båda skrivit, eller efter fjorton dagar.
- Företaget får återpublicera materialet i sina egna kanaler i sex månader. Betald annonsering kräver skriftligt medgivande från kreatören.

Om priser: ett rimligt arvode beror på räckvidd och hur lokal publiken är. Kostnad per tusen visningar är måttet som går att jämföra med annonspriser. Uppmana gärna företagaren att börja med ett mindre samarbete och mäta resultatet innan de satsar mer.

Svara på svenska.`;

/** En kandidat som rådgivaren kan resonera om. Bara sådant vi faktiskt vet. */
export function describeCandidateForAdvisor(candidate: {
  displayName: string;
  city: string;
  categories: string[];
  followers: number;
  avgViews: number;
  engagementRate: number;
  priceMin: number;
  priceTarget: number;
  ratingAverage: number;
  ratingCount: number;
  statsVerified: boolean;
  showcaseCount: number;
}): string {
  const rating =
    candidate.ratingCount > 0
      ? `${candidate.ratingAverage.toFixed(1)} i betyg på ${candidate.ratingCount} omdömen`
      : 'inga omdömen än';
  return [
    `- ${candidate.displayName} (${candidate.city})`,
    `  nischer: ${candidate.categories.join(', ') || 'inga angivna'}`,
    `  ${candidate.followers} följare, ${candidate.avgViews} visningar i snitt, ${(candidate.engagementRate * 100).toFixed(1)} % engagemang`,
    `  siffrorna är ${candidate.statsVerified ? 'hämtade från plattformen' : 'ogranskade och uppgivna av kreatören själv'}`,
    `  pris: från ${formatSek(candidate.priceMin)}, riktpris ${formatSek(candidate.priceTarget)}`,
    `  ${rating}, ${candidate.showcaseCount} uppvisade klipp`,
  ].join('\n');
}

/**
 * Rådgivaren på kreatörens sida.
 *
 * Skillnaden mot företagets rådgivare är att den här inte får något att välja
 * mellan – den får en uträkning. Kampanjerna är redan räknade, hindren redan
 * summerade, och stegen redan kvantifierade. Modellens enda uppgift är att
 * säga vilket av dem som är värt att göra först och varför.
 *
 * Frestelsen att trösta är det som skulle förstöra funktionen. Kreatören som
 * får noll matchningar är hjälpt av att veta att hon prissatt sig utanför
 * marknaden, inte av att höra att hon snart kommer att lyckas.
 */
export const CREATOR_ADVISOR_SYSTEM_PROMPT = `Du är rådgivaren i Pacta, en svensk plattform där företag och innehållskreatörer hittar varandra. Företagen är restauranger, kaféer, hotell, kliniker och butiker som vill ha besökare på plats.

Du talar med en kreatör som undrar varför hon får få matchningar. Du får en färdig uträkning: hur många kampanjer som ligger ute, hur många hon är behörig till, vad de andra faller på, och vad varje åtgärd skulle öppna.

Så här svarar du:
- Kort. Tre till fem meningar, eller tre punkter. Inte mer.
- Börja med det som stämmer bäst med siffrorna, inte med en uppmuntran.
- Säg vad hon ska göra först och vad det ger. Använd talen du fått.
- Är läget att det helt enkelt ligger få kampanjer ute säger du det rakt ut. Det är ett riktigt svar.

Absoluta regler:
- Använd bara siffrorna i underlaget. Hitta aldrig på ett antal kampanjer, en följarsiffra eller ett belopp.
- Lova aldrig matchningar, uppdrag eller inkomst. Du kan säga vad en åtgärd gör henne behörig till, inte vad den ger.
- Föreslå aldrig att hon köper räckvidd eller uppger siffror hon inte har.
- Säg aldrig åt henne att sänka priset när priset inte är det som blockerar. Underlaget visar vad som blockerar.

Bakgrund du kan luta dig mot:
- Kampanjerna kräver ett fysiskt besök, så kampanjer i hennes egen stad är de som oftast blir av.
- Företaget ser hennes profilbild, presentation, nischer, klipp och siffror. Statistik som hämtats från plattformen väger tyngre än siffror hon uppgett själv.
- Budgeten i en kampanj är en riktpunkt, inte ett tak – arvodet förhandlas per samarbete. Hennes lägstapris är däremot en hård gräns i matchningen.

Skriv på svenska, i du-tilltal, utan rubriker och utan hälsningsfras.`;

/** Uträkningen som prosa. Bara tal som faktiskt räknats fram. */
export function describeCreatorInsights(
  influencer: InfluencerCandidate,
  insights: CreatorInsights,
): string {
  const lines = [
    `Kreatör: ${influencer.displayName} i ${influencer.city}.`,
    `Nischer: ${influencer.categories.join(', ') || 'inga angivna'}.`,
    `Plattformar: ${influencer.platforms.join(', ') || 'inga kopplade'}.`,
    `${influencer.followers} följare, ${influencer.avgViews} visningar i snitt, ${(influencer.engagementRate * 100).toFixed(1)} % engagemang.`,
    `Lägsta arvode: ${formatSek(influencer.priceMin)}. Riktpris: ${formatSek(influencer.priceTarget)}.`,
    '',
    `Öppna kampanjer just nu: ${insights.openCampaigns}.`,
    `Hon är behörig till ${insights.eligible} av dem, varav ${insights.eligibleInCity} i ${influencer.city}.`,
    `Hon har redan svarat på ${insights.reviewed} och har ${insights.waiting} kvar att svepa på.`,
    `Matchningar totalt: ${insights.matches}.`,
    '',
    'Kampanjer som faller på respektive hinder:',
    `- följarkravet: ${insights.blockers.followers}`,
    `- plattform hon inte publicerar på: ${insights.blockers.platforms}`,
    `- hennes lägstapris ligger för långt över budgeten: ${insights.blockers.budget}`,
  ];

  if (insights.actions.length > 0) {
    lines.push('', 'Uträknade steg (talen är kontrollerade, använd dem som de står):');
    for (const action of insights.actions) {
      lines.push(`- ${action.message}`);
    }
  } else {
    lines.push('', 'Ingen enskild ändring i profilen skulle öppna fler kampanjer.');
  }

  if (insights.gaps.length > 0) {
    lines.push('', 'Luckor i profilen:');
    for (const gap of insights.gaps) lines.push(`- ${gap.message}`);
  } else {
    lines.push('', 'Profilen är komplett: bild, presentation, klipp, nischer och hämtad statistik.');
  }

  return lines.join('\n');
}
