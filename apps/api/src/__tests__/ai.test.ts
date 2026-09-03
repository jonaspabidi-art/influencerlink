import type Anthropic from '@anthropic-ai/sdk';
import type { CampaignCandidate, InfluencerCandidate } from '@influencerlink/shared';
import { describe, expect, it, vi } from 'vitest';
import type { Config } from '../config.js';
import { AiService, clampAdjustment } from '../services/ai/index.js';

const config = { ANTHROPIC_MODEL: 'claude-sonnet-5' } as Config;

const campaign: CampaignCandidate = {
  id: 'kampanj-1',
  title: 'Ny lunchmeny',
  city: 'Göteborg',
  categories: ['RESTAURANG'],
  platforms: ['TIKTOK'],
  deliverables: ['TIKTOK_VIDEO'],
  minFollowers: 5_000,
  budgetPerCreator: 400_000,
};

function influencer(id: string, overrides: Partial<InfluencerCandidate> = {}): InfluencerCandidate {
  return {
    id,
    displayName: `Profil ${id}`,
    city: 'Göteborg',
    categories: ['RESTAURANG'],
    platforms: ['TIKTOK'],
    followers: 20_000,
    avgViews: 15_000,
    engagementRate: 0.05,
    priceMin: 100_000,
    priceTarget: 300_000,
    ...overrides,
  };
}

/** Minimal Anthropic-stubb som svarar med ett förbestämt tool_use-block. */
function stubClient(input: unknown, calls: unknown[] = []): Anthropic {
  return {
    messages: {
      create: vi.fn(async (request: unknown) => {
        calls.push(request);
        return { content: [{ type: 'tool_use', name: 'x', id: 'y', input }] };
      }),
    },
  } as unknown as Anthropic;
}

function failingClient(): Anthropic {
  return {
    messages: { create: vi.fn(async () => { throw new Error('502 från API:et'); }) },
  } as unknown as Anthropic;
}

describe('clampAdjustment', () => {
  it('låter modellen justera inom ±20 poäng', () => {
    expect(clampAdjustment(50, 65)).toBe(65);
    expect(clampAdjustment(50, 35)).toBe(35);
  });

  it('kapar större justeringar än så', () => {
    expect(clampAdjustment(50, 100)).toBe(70);
    expect(clampAdjustment(50, 0)).toBe(30);
  });

  it('håller sig inom 0–100 även nära ytterkanterna', () => {
    expect(clampAdjustment(5, 0)).toBe(0);
    expect(clampAdjustment(95, 100)).toBe(100);
  });
});

describe('AiService utan API-nyckel', () => {
  const service = new AiService({ ...config, ANTHROPIC_API_KEY: undefined } as Config);

  it('rapporterar sig som avstängd', () => {
    expect(service.enabled).toBe(false);
  });

  it('rangordnar ändå med heuristiken', async () => {
    const ranked = await service.rankInfluencersForCampaign(campaign, [
      influencer('svag', { city: 'Malmö', categories: ['NOJE'], engagementRate: 0.005 }),
      influencer('stark', { engagementRate: 0.08, followers: 40_000 }),
    ]);
    expect(ranked.map((entry) => entry.influencer.id)).toEqual(['stark', 'svag']);
    expect(ranked.every((entry) => entry.aiReviewed === false)).toBe(true);
    expect(ranked[0]?.reason).toBeTruthy();
  });

  it('ger tom lista tillbaka för tom lista', async () => {
    expect(await service.rankInfluencersForCampaign(campaign, [])).toEqual([]);
  });

  it('kan inte skapa kampanjutkast', async () => {
    expect(await service.draftCampaign('Vi vill ha influencers', 'Göteborg')).toBeUndefined();
  });
});

describe('AiService med Sonnet', () => {
  it('använder modellens poäng och motivering', async () => {
    const service = new AiService(
      config,
      stubClient({
        verdicts: [
          { id: 'a', score: 90, reason: 'Gör matinnehåll i Göteborg varje vecka.' },
          { id: 'b', score: 40, reason: 'Publiken ligger utanför Göteborg.' },
        ],
      }),
    );
    const ranked = await service.rankInfluencersForCampaign(campaign, [
      influencer('a'),
      influencer('b'),
    ]);
    expect(ranked[0]?.influencer.id).toBe('a');
    expect(ranked[0]?.reason).toBe('Gör matinnehåll i Göteborg varje vecka.');
    expect(ranked[0]?.aiReviewed).toBe(true);
  });

  it('kapar justeringar så att modellen inte kan kasta om listan helt', async () => {
    const service = new AiService(
      config,
      stubClient({ verdicts: [{ id: 'a', score: 100, reason: 'Bra.' }] }),
    );
    const [entry] = await service.rankInfluencersForCampaign(campaign, [influencer('a')]);
    expect(entry?.finalScore).toBeLessThanOrEqual((entry?.score.total ?? 0) + 20);
  });

  it('behåller grundpoängen för kandidater modellen hoppade över', async () => {
    const service = new AiService(
      config,
      stubClient({ verdicts: [{ id: 'a', score: 88, reason: 'Bra.' }] }),
    );
    const ranked = await service.rankInfluencersForCampaign(campaign, [
      influencer('a'),
      influencer('b'),
    ]);
    const b = ranked.find((entry) => entry.influencer.id === 'b');
    expect(b?.aiReviewed).toBe(false);
    expect(b?.finalScore).toBe(b?.score.total);
  });

  it('faller tillbaka på heuristiken när API:et svarar med skräp', async () => {
    const service = new AiService(config, stubClient({ nagot: 'annat' }));
    const ranked = await service.rankInfluencersForCampaign(campaign, [influencer('a')]);
    expect(ranked[0]?.aiReviewed).toBe(false);
  });

  it('faller tillbaka på heuristiken när API:et fallerar', async () => {
    const service = new AiService(config, failingClient());
    const ranked = await service.rankInfluencersForCampaign(campaign, [influencer('a')]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.aiReviewed).toBe(false);
  });

  it('skickar högst 15 kandidater till modellen', async () => {
    const calls: unknown[] = [];
    const service = new AiService(config, stubClient({ verdicts: [] }, calls));
    const many = Array.from({ length: 40 }, (_, index) => influencer(`i${index}`));
    await service.rankInfluencersForCampaign(campaign, many);

    const prompt = (calls[0] as { messages: Array<{ content: string }> }).messages[0]?.content ?? '';
    expect(prompt).toContain('Bedöm alla 15 kandidater.');
  });

  it('skapar ett kampanjutkast som validerar mot schemat', async () => {
    const service = new AiService(
      config,
      stubClient({
        title: 'Prova vår nya lunchmeny',
        brief: 'Du besöker oss en vardag och filmar din lunch.',
        categories: ['RESTAURANG'],
        platforms: ['TIKTOK'],
        deliverables: ['TIKTOK_VIDEO'],
        compensationType: 'HYBRID',
        budgetPerCreator: 250_000,
        productValue: 30_000,
        slots: 3,
        minFollowers: 5_000,
        rationale: 'Mikroprofiler ger bäst effekt lokalt.',
      }),
    );
    const draft = await service.draftCampaign('Vill fylla luncherna på tisdagar', 'Göteborg');
    expect(draft?.title).toBe('Prova vår nya lunchmeny');
    expect(draft?.budgetPerCreator).toBe(250_000);
  });

  it('kastar inte utkast med ogiltiga värden vidare till appen', async () => {
    const service = new AiService(
      config,
      stubClient({ title: 'Kort', brief: 'x', categories: [], platforms: [] }),
    );
    expect(await service.draftCampaign('Något', 'Göteborg')).toBeUndefined();
  });
});
