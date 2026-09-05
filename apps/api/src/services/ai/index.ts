import Anthropic from '@anthropic-ai/sdk';
import {
  formatSek,
  CATEGORIES,
  COMPENSATION_TYPES,
  DELIVERABLE_KINDS,
  PLATFORMS,
  rankCampaigns,
  rankInfluencers,
  type CampaignCandidate,
  type InfluencerCandidate,
} from '@pacta/shared';
import { z } from 'zod';
import type { Config } from '../../config.js';
import {
  ADVISOR_SYSTEM_PROMPT,
  CAMPAIGN_DRAFT_SYSTEM_PROMPT,
  MATCHING_SYSTEM_PROMPT,
  describeCampaign,
  describeCandidateForAdvisor,
  describeInfluencer,
} from './prompts.js';
import type { CampaignDraft, RankedCampaign, RankedInfluencer } from './types.js';

export * from './types.js';

/** Så många toppkandidater skickas till Sonnet. Resten behåller grundpoängen. */
const AI_REVIEW_LIMIT = 15;
/** Sonnet får flytta grundpoängen med som mest så här mycket. */
const MAX_SCORE_ADJUSTMENT = 20;

const verdictSchema = z.object({
  id: z.string(),
  score: z.number().min(0).max(100),
  reason: z.string().min(1).max(200),
});

const verdictsSchema = z.object({ verdicts: z.array(verdictSchema) });

const draftSchema = z.object({
  title: z.string().min(4).max(120),
  brief: z.string().min(10).max(4000),
  categories: z.array(z.enum(CATEGORIES)).min(1).max(6),
  platforms: z.array(z.enum(PLATFORMS)).min(1),
  deliverables: z.array(z.enum(DELIVERABLE_KINDS)).min(1).max(10),
  compensationType: z.enum(COMPENSATION_TYPES),
  budgetPerCreator: z.number().int().min(0),
  productValue: z.number().int().min(0),
  slots: z.number().int().min(1).max(100),
  minFollowers: z.number().int().min(0),
  rationale: z.string().max(500),
});

const RANK_TOOL: Anthropic.Tool = {
  name: 'lamna_bedomning',
  description: 'Lämnar ett slutbetyg och en motivering för varje kandidat.',
  input_schema: {
    type: 'object',
    properties: {
      verdicts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Kandidatens id, exakt som det angavs.' },
            score: { type: 'number', description: 'Slutbetyg 0–100.' },
            reason: {
              type: 'string',
              description: 'En mening på svenska, max 140 tecken, som motiverar betyget.',
            },
          },
          required: ['id', 'score', 'reason'],
        },
      },
    },
    required: ['verdicts'],
  },
};

const DRAFT_TOOL: Anthropic.Tool = {
  name: 'skapa_kampanjutkast',
  description: 'Skapar ett komplett kampanjutkast utifrån restaurangägarens beskrivning.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      brief: { type: 'string' },
      categories: { type: 'array', items: { type: 'string', enum: [...CATEGORIES] } },
      platforms: { type: 'array', items: { type: 'string', enum: [...PLATFORMS] } },
      deliverables: { type: 'array', items: { type: 'string', enum: [...DELIVERABLE_KINDS] } },
      compensationType: { type: 'string', enum: [...COMPENSATION_TYPES] },
      budgetPerCreator: { type: 'number', description: 'Kontant ersättning per kreatör i öre.' },
      productValue: { type: 'number', description: 'Värde på mat eller upplevelse i öre.' },
      slots: { type: 'number', description: 'Antal influencers som söks.' },
      minFollowers: { type: 'number' },
      rationale: { type: 'string', description: 'Kort motivering av upplägget, på svenska.' },
    },
    required: [
      'title',
      'brief',
      'categories',
      'platforms',
      'deliverables',
      'compensationType',
      'budgetPerCreator',
      'productValue',
      'slots',
      'minFollowers',
      'rationale',
    ],
  },
};

export class AiService {
  private readonly client: Anthropic | undefined;

  constructor(
    private readonly config: Config,
    client?: Anthropic,
  ) {
    this.client =
      client ?? (config.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: config.ANTHROPIC_API_KEY }) : undefined);
  }

  /** True när en API-nyckel finns. Utan nyckel används enbart heuristiken. */
  get enabled(): boolean {
    return this.client !== undefined;
  }

  /**
   * Rangordnar influencers för en kampanj. Heuristiken kör alltid först och
   * avgör ordningen; Sonnet finjusterar toppen och skriver motiveringarna.
   * Vid fel från API:et faller vi tillbaka på heuristiken utan att flödet bryts.
   */
  async rankInfluencersForCampaign(
    campaign: CampaignCandidate,
    influencers: InfluencerCandidate[],
  ): Promise<RankedInfluencer[]> {
    const base = rankInfluencers(campaign, influencers).map((entry) => ({
      ...entry,
      finalScore: entry.score.total,
      reason: entry.score.reasons[0] ?? 'Grundläggande matchning på nisch och räckvidd',
      aiReviewed: false,
    }));

    if (!this.client || base.length === 0) return base;

    const reviewed = base.slice(0, AI_REVIEW_LIMIT);
    const candidateLines = reviewed
      .map((entry) => describeInfluencer(entry.influencer, entry.score))
      .join('\n');

    const verdicts = await this.callRankTool(
      `Kampanj:\n${describeCampaign(campaign)}\n\nKandidater:\n${candidateLines}\n\nBedöm alla ${reviewed.length} kandidater.`,
    );
    if (!verdicts) return base;

    for (const entry of base) {
      const verdict = verdicts.get(entry.influencer.id);
      if (!verdict) continue;
      entry.finalScore = clampAdjustment(entry.score.total, verdict.score);
      entry.reason = verdict.reason;
      entry.aiReviewed = true;
    }
    return sortByFinalScore(base, (entry) => entry.influencer.id);
  }

  /** Samma sak från influencerns håll: vilka kampanjer ska ligga överst i decken? */
  async rankCampaignsForInfluencer(
    influencer: InfluencerCandidate,
    campaigns: CampaignCandidate[],
  ): Promise<RankedCampaign[]> {
    const base = rankCampaigns(influencer, campaigns).map((entry) => ({
      ...entry,
      finalScore: entry.score.total,
      reason: entry.score.reasons[0] ?? 'Passar din nisch och räckvidd',
      aiReviewed: false,
    }));

    if (!this.client || base.length === 0) return base;

    const reviewed = base.slice(0, AI_REVIEW_LIMIT);
    const lines = reviewed
      .map((entry) => `id: ${entry.campaign.id} | ${describeCampaign(entry.campaign)} | grundpoäng: ${entry.score.total}`)
      .join('\n');

    const verdicts = await this.callRankTool(
      `Influencer:\n${describeInfluencer(influencer, reviewed[0]!.score)}\n\nKampanjer:\n${lines}\n\nBedöm hur väl varje kampanj passar influencern. Motiveringen riktar sig till influencern.`,
    );
    if (!verdicts) return base;

    for (const entry of base) {
      const verdict = verdicts.get(entry.campaign.id);
      if (!verdict) continue;
      entry.finalScore = clampAdjustment(entry.score.total, verdict.score);
      entry.reason = verdict.reason;
      entry.aiReviewed = true;
    }
    return sortByFinalScore(base, (entry) => entry.campaign.id);
  }

  private async callRankTool(
    userPrompt: string,
  ): Promise<Map<string, { score: number; reason: string }> | undefined> {
    const input = await this.callTool(MATCHING_SYSTEM_PROMPT, RANK_TOOL, userPrompt, 2048);
    if (!input) return undefined;
    const parsed = verdictsSchema.safeParse(input);
    if (!parsed.success) return undefined;
    return new Map(
      parsed.data.verdicts.map((verdict) => [
        verdict.id,
        { score: verdict.score, reason: verdict.reason },
      ]),
    );
  }

  /**
   * Gör om restaurangägarens fritext till ett kampanjutkast. Returnerar
   * undefined när AI saknas eller svarar oanvändbart – appen visar då ett
   * tomt formulär istället.
   */
  async draftCampaign(prompt: string, city: string | undefined): Promise<CampaignDraft | undefined> {
    const input = await this.callTool(
      CAMPAIGN_DRAFT_SYSTEM_PROMPT,
      DRAFT_TOOL,
      `Restaurangägaren skriver: "${prompt}"\n${city ? `Företaget ligger i ${city}.` : ''}`,
      1500,
    );
    if (!input) return undefined;
    const parsed = draftSchema.safeParse(input);
    return parsed.success ? parsed.data : undefined;
  }

  /**
   * Svarar på en fråga från företaget om vem det ska välja och hur det går till.
   *
   * Kandidaterna skickas med i frågan i stället för att modellen får leta själv:
   * den ska bara kunna tala om profiler som faktiskt finns, med de siffror vi
   * faktiskt har. Ett påhittat namn eller en påhittad räckvidd vore värre än
   * inget svar alls, eftersom företaget betalar utifrån det.
   */
  async advise(input: {
    question: string;
    business: { companyName: string; city: string; categories: string[]; description: string };
    campaign?: { title: string; brief: string; budgetPerCreator: number; slots: number } | null;
    candidates: Parameters<typeof describeCandidateForAdvisor>[0][];
  }): Promise<string | null> {
    if (!this.client) return null;

    const parts = [
      `Företaget: ${input.business.companyName} i ${input.business.city}.`,
      input.business.description ? `Om verksamheten: ${input.business.description}` : '',
      `Nischer: ${input.business.categories.join(', ') || 'inga angivna'}.`,
      input.campaign
        ? `\nAktuell kampanj: ${input.campaign.title}\n${input.campaign.brief}\nBudget per kreatör: ${formatSek(input.campaign.budgetPerCreator)}, ${input.campaign.slots} platser.`
        : '\nFöretaget har ingen kampanj vald just nu.',
      input.candidates.length > 0
        ? `\nKreatörer att välja bland:\n${input.candidates.map(describeCandidateForAdvisor).join('\n')}`
        : '\nDet finns inga kreatörer att välja bland just nu.',
      `\nFrågan: ${input.question}`,
    ];

    try {
      const response = await this.client.messages.create({
        model: this.config.ANTHROPIC_MODEL,
        max_tokens: 700,
        system: ADVISOR_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: parts.filter(Boolean).join('\n') }],
      });
      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim();
      return text.length > 0 ? text : null;
    } catch {
      // Ett uteblivet råd är ett tomt svar, inte ett fel som fäller skärmen.
      return null;
    }
  }

  private async callTool(
    system: string,
    tool: Anthropic.Tool,
    userPrompt: string,
    maxTokens: number,
  ): Promise<unknown> {
    if (!this.client) return undefined;
    try {
      const response = await this.client.messages.create({
        model: this.config.ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        system,
        tools: [tool],
        tool_choice: { type: 'tool', name: tool.name },
        messages: [{ role: 'user', content: userPrompt }],
      });
      const block = response.content.find((item) => item.type === 'tool_use');
      return block?.type === 'tool_use' ? block.input : undefined;
    } catch {
      // Matchning får aldrig blockera flödet – anroparen faller tillbaka på heuristiken.
      return undefined;
    }
  }
}

/** Hindrar modellen från att kasta om listan helt: max ±20 poäng från grunden. */
function clampAdjustment(baseScore: number, aiScore: number): number {
  const lower = Math.max(0, baseScore - MAX_SCORE_ADJUSTMENT);
  const upper = Math.min(100, baseScore + MAX_SCORE_ADJUSTMENT);
  return Math.round(Math.min(upper, Math.max(lower, aiScore)));
}

function sortByFinalScore<T extends { finalScore: number }>(
  entries: T[],
  idOf: (entry: T) => string,
): T[] {
  return [...entries].sort(
    (a, b) => b.finalScore - a.finalScore || idOf(a).localeCompare(idOf(b)),
  );
}

export { clampAdjustment };
