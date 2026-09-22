import { describe, expect, it } from 'vitest';
import {
  BARTER_PLAN_SPECS,
  SELLABLE_BARTER_PLANS,
  barterAllowance,
  barterBlocker,
  describeReliability,
  formatSek,
  renderContractTerms,
} from '@pacta/shared';

describe('bartersamarbeten', () => {
  it('räknar kvarvarande samarbeten mot nivåns tak', () => {
    expect(barterAllowance({ plan: 'BASIC', used: 0 })).toMatchObject({
      limit: 2,
      remaining: 2,
      canStart: true,
    });
    expect(barterAllowance({ plan: 'BASIC', used: 1 })).toMatchObject({
      remaining: 1,
      canStart: true,
    });
    expect(barterAllowance({ plan: 'BASIC', used: 2 })).toMatchObject({
      remaining: 0,
      canStart: false,
    });
  });

  /*
   * Ett tak som passerats ska inte ge negativa tal. Det kan hända på riktigt:
   * en nivå kan sänkas mitt i en månad där fler samarbeten redan startat.
   */
  it('går inte under noll när taket passerats', () => {
    expect(barterAllowance({ plan: 'BASIC', used: 5 })).toMatchObject({
      remaining: 0,
      canStart: false,
    });
  });

  it('utan abonnemang går ingenting att starta', () => {
    const allowance = barterAllowance({ plan: 'NONE', used: 0 });
    expect(allowance.limit).toBe(0);
    expect(allowance.canStart).toBe(false);
  });

  it('säger varför det inte går, inte bara att det inte går', () => {
    expect(barterBlocker({ plan: 'NONE', used: 0 })).toMatch(/abonnemang/i);
    expect(barterBlocker({ plan: 'MEDIUM', used: 5 })).toMatch(/Medium/);
    expect(barterBlocker({ plan: 'MEDIUM', used: 5 })).toMatch(/5 samarbeten/);
    expect(barterBlocker({ plan: 'MEDIUM', used: 4 })).toBeNull();
  });

  it('har stigande pris och tak', () => {
    const specs = SELLABLE_BARTER_PLANS.map((plan) => BARTER_PLAN_SPECS[plan]);
    for (let i = 1; i < specs.length; i += 1) {
      expect(specs[i]!.monthlyPrice).toBeGreaterThan(specs[i - 1]!.monthlyPrice);
      expect(specs[i]!.monthlyCollabs).toBeGreaterThan(specs[i - 1]!.monthlyCollabs);
    }
  });

  /* Ju större paket, desto lägre styckpris – annars är det inget paket. */
  it('ger lägre pris per samarbete på högre nivåer', () => {
    const perCollab = SELLABLE_BARTER_PLANS.map(
      (plan) => BARTER_PLAN_SPECS[plan].monthlyPrice / BARTER_PLAN_SPECS[plan].monthlyCollabs,
    );
    for (let i = 1; i < perCollab.length; i += 1) {
      expect(perCollab[i]!).toBeLessThan(perCollab[i - 1]!);
    }
  });

  describe('pålitlighet', () => {
    it('tiger när kreatören inte hunnit göra något', () => {
      expect(describeReliability({ completed: 0, abandoned: 0 })).toBeNull();
    });

    it('nämner bara genomförda när inget avbrutits', () => {
      expect(describeReliability({ completed: 7, abandoned: 0 })).toBe('7 genomförda samarbeten');
    });

    it('visar avbrutna när de finns', () => {
      expect(describeReliability({ completed: 7, abandoned: 2 })).toBe('7 genomförda · 2 avbrutna');
    });
  });
});

describe('avtalstext för bartersamarbete', () => {
  const base = {
    contractId: 'ctr_1',
    businessName: 'Testkrogen',
    businessOrgNumber: '5560123456',
    influencerName: 'alextestar',
    influencerPersonalNumberMask: '19920315-****',
    campaignTitle: 'Nya lunchmenyn',
    campaignBrief: 'Kom och ät.',
    deliverables: ['TIKTOK_VIDEO'] as const,
    feeSplit: { businessFeeBps: 1000, creatorFeeBps: 1000 },
    dueDate: new Date('2026-10-01T12:00:00Z'),
    reviewDays: 7,
    extraTerms: '',
  };

  const barter = renderContractTerms({
    ...base,
    deliverables: [...base.deliverables],
    fee: 0,
    productValue: 60_000,
  });
  const paid = renderContractTerms({
    ...base,
    deliverables: [...base.deliverables],
    fee: 400_000,
  });

  it('nämner matens värde i stället för arvode', () => {
    expect(barter).toContain(`värde av ${formatSek(60_000)}`);
    expect(barter).not.toContain('Förmedlingsavgift');
  });

  /*
   * Det viktigaste i hela bartertexten: den får inte lova en betalningsgång
   * som inte finns. Står det att Pacta håller beloppet tror kreatören att
   * det finns pengar att hämta.
   */
  it('lovar ingen betalning som inte sker', () => {
    expect(barter).toContain('Pacta förmedlar inga pengar');
    expect(barter).not.toContain('betalas ut till uppdragstagaren när leveransen godkänts');
    expect(paid).toContain('betalas ut till uppdragstagaren när leveransen godkänts');
  });

  it('säger att kreatören svarar för skatten även vid byte', () => {
    expect(barter).toMatch(/skattepliktig på samma sätt som kontant/);
  });

  it('säger vad som händer om kreatören inte levererar', () => {
    expect(barter).toMatch(/avbrutet på uppdragstagarens profil/);
    expect(paid).toMatch(/återbetalas hela beloppet/);
  });
});

/*
 * En sparad kreatör från innan fältet fanns saknar reliability. Det tog ner
 * hela appen en gång: visningshjälparen läste .completed på undefined.
 */
describe('pålitlighet som saknas', () => {
  it('tiger i stället för att kasta när fältet saknas', () => {
    expect(describeReliability(undefined)).toBeNull();
    expect(describeReliability(null)).toBeNull();
  });
});
