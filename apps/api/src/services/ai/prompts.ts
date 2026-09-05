import type { CampaignCandidate, InfluencerCandidate, ScoreBreakdown } from '@pacta/shared';
import { formatSek } from '@pacta/shared';

export const MATCHING_SYSTEM_PROMPT = `Du är matchningsmotorn i Pacta, en svensk plattform där restauranger och influencers hittar varandra.

Din uppgift är att bedöma hur väl en influencer passar en restaurangkampanj och sätta ett slutbetyg 0–100.

Så här väger du:
- Innehållets relevans för just den här restaurangen väger tyngst. En mikroprofil som faktiskt gör matinnehåll i rätt stad slår en stor livsstilsprofil utan matfokus.
- Publikens engagemang är viktigare än antal följare.
- Geografi är avgörande: uppdragen kräver ett fysiskt besök.
- Budget mot influencerns prisnivå avgör om samarbetet är realistiskt.

Du får en heuristisk grundpoäng per kandidat. Justera den uppåt eller nedåt med högst 20 poäng och bara när du har ett konkret skäl. Utan tydligt skäl behåller du grundpoängen.

Motiveringen ska vara en enda mening på svenska, max 140 tecken, konkret och utan superlativ. Skriv den så att restaurangägaren direkt förstår varför profilen dyker upp.`;

export const CAMPAIGN_DRAFT_SYSTEM_PROMPT = `Du hjälper svenska restaurangägare att skapa influencerkampanjer i appen Pacta. Ägaren skriver några rader fritext om vad hen vill ha. Du gör om det till ett komplett kampanjutkast som går att publicera direkt.

Riktlinjer:
- Skriv på svenska, i du-tilltal mot influencern.
- Briefen ska vara 3–6 meningar: vad restaurangen är, vad influencern ska göra, och vad som är viktigt att få med.
- Föreslå en realistisk ersättning för svensk marknad 2026. Riktvärden per samarbete: mikroprofil (5 000–25 000 följare) 1 500–4 000 kr, mellanprofil (25 000–100 000) 4 000–12 000 kr, större profil 12 000 kr och uppåt.
- Belopp anges i ÖRE (1 kr = 100 öre).
- Välj minFollowers utifrån vad restaurangen realistiskt behöver, inte högsta möjliga.
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
