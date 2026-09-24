import type Stripe from 'stripe';
import { describe, expect, it, vi } from 'vitest';
import { BARTER_PLAN_SPECS } from '@pacta/shared';
import type { Config } from '../config.js';
import { barterReturnUrl } from '../routes/billing.js';
import { StripeBillingProvider } from '../services/billing/index.js';

const config = {
  corsOrigins: ['http://localhost:8081', 'https://pacta.netlify.app'],
  APP_WEB_URL: undefined,
} as unknown as Config;

describe('vart betalsidan skickar tillbaka', () => {
  it('använder anropets adress när den är betrodd', () => {
    expect(barterReturnUrl(config, 'https://pacta.netlify.app')).toBe(
      'https://pacta.netlify.app/barter/plans',
    );
  });

  /*
   * Annars kunde vem som helst skicka en betalande kund vidare till en
   * sida som ser ut som Pacta.
   */
  it('ignorerar en adress som inte är betrodd', () => {
    expect(barterReturnUrl(config, 'https://pacta-login.example')).toBe(
      'http://localhost:8081/barter/plans',
    );
    expect(barterReturnUrl(config, undefined)).toBe('http://localhost:8081/barter/plans');
  });

  it('föredrar APP_WEB_URL framför första CORS-adressen', () => {
    const withWeb = { ...config, APP_WEB_URL: 'https://pacta.se/' } as Config;
    expect(barterReturnUrl(withWeb, undefined)).toBe('https://pacta.se/barter/plans');
  });
});

/** En Stripe-klient med bara det som abonnemangen använder. */
function fakeStripe(overrides: {
  prices?: Partial<Stripe.Price>[];
  subscription?: Partial<Stripe.Subscription>;
}) {
  const created: Stripe.PriceCreateParams[] = [];
  const stripe = {
    prices: {
      list: vi.fn(async () => ({ data: overrides.prices ?? [] })),
      create: vi.fn(async (params: Stripe.PriceCreateParams) => {
        created.push(params);
        return { id: `price_new_${created.length}` };
      }),
    },
    subscriptions: {
      retrieve: vi.fn(async () => overrides.subscription),
    },
  };
  return { stripe: stripe as unknown as Stripe, created, raw: stripe };
}

describe('abonnemang hos Stripe', () => {
  it('känner igen testnycklar', () => {
    expect(new StripeBillingProvider('sk_test_abc', {} as Stripe).testMode).toBe(true);
    expect(new StripeBillingProvider('sk_live_abc', {} as Stripe).testMode).toBe(false);
  });

  it('återanvänder ett pris med rätt belopp och skapar inget nytt', async () => {
    const { stripe, created } = fakeStripe({
      prices: [
        {
          id: 'price_basic',
          unit_amount: BARTER_PLAN_SPECS.BASIC.monthlyPrice,
          currency: 'sek',
        },
      ],
    });
    const provider = new StripeBillingProvider('sk_test_x', stripe) as unknown as {
      priceFor(plan: string): Promise<string>;
    };
    expect(await provider.priceFor('BASIC')).toBe('price_basic');
    expect(created).toHaveLength(0);
  });

  /*
   * Priserna står på ett ställe i koden. Ändras beloppet där ska Stripe få
   * ett nytt pris – inte fortsätta dra det gamla i tysthet.
   */
  it('skapar ett nytt pris när beloppet i koden ändrats', async () => {
    const { stripe, created } = fakeStripe({
      prices: [{ id: 'price_old', unit_amount: 39_500, currency: 'sek' }],
    });
    const provider = new StripeBillingProvider('sk_test_x', stripe) as unknown as {
      priceFor(plan: string): Promise<string>;
    };
    expect(await provider.priceFor('MEDIUM')).toBe('price_new_1');
    expect(created[0]).toMatchObject({
      unit_amount: BARTER_PLAN_SPECS.MEDIUM.monthlyPrice,
      lookup_key: 'pacta_barter_medium',
      transfer_lookup_key: true,
      recurring: { interval: 'month' },
      tax_behavior: 'exclusive',
    });
  });

  it('läser nivå, förnyelse och uppsägning ur prenumerationen', async () => {
    const periodEnd = Date.UTC(2026, 9, 24) / 1000;
    const { stripe } = fakeStripe({
      subscription: {
        id: 'sub_1',
        customer: 'cus_1',
        status: 'active',
        metadata: { businessId: 'biz_1' },
        cancel_at_period_end: false,
        cancel_at: null,
        items: {
          data: [
            {
              current_period_end: periodEnd,
              price: { lookup_key: 'pacta_barter_advanced', metadata: {} },
            },
          ],
        } as unknown as Stripe.ApiList<Stripe.SubscriptionItem>,
      },
    });
    const snapshot = await new StripeBillingProvider('sk_test_x', stripe).fetchSubscription(
      'sub_1',
    );
    expect(snapshot).toMatchObject({
      id: 'sub_1',
      customerId: 'cus_1',
      businessId: 'biz_1',
      plan: 'ADVANCED',
      status: 'active',
      cancelsAt: null,
    });
    expect(snapshot?.renewsAt?.toISOString()).toBe('2026-10-24T00:00:00.000Z');
  });

  it('en uppsagd prenumeration gäller perioden ut men förnyas inte', async () => {
    const periodEnd = Date.UTC(2026, 9, 24) / 1000;
    const { stripe } = fakeStripe({
      subscription: {
        id: 'sub_1',
        customer: 'cus_1',
        status: 'active',
        metadata: {},
        cancel_at_period_end: true,
        cancel_at: null,
        items: {
          data: [
            {
              current_period_end: periodEnd,
              price: { lookup_key: null, metadata: { plan: 'BASIC' } },
            },
          ],
        } as unknown as Stripe.ApiList<Stripe.SubscriptionItem>,
      },
    });
    const snapshot = await new StripeBillingProvider('sk_test_x', stripe).fetchSubscription(
      'sub_1',
    );
    expect(snapshot).toMatchObject({
      plan: 'BASIC',
      renewsAt: null,
      businessId: null,
    });
    expect(snapshot?.cancelsAt?.toISOString()).toBe('2026-10-24T00:00:00.000Z');
  });

  it('ett okänt pris ger ingen nivå', async () => {
    const { stripe } = fakeStripe({
      subscription: {
        id: 'sub_1',
        customer: 'cus_1',
        status: 'active',
        metadata: {},
        cancel_at_period_end: false,
        cancel_at: null,
        items: {
          data: [
            {
              current_period_end: 0,
              price: { lookup_key: 'annat_pris', metadata: {} },
            },
          ],
        } as unknown as Stripe.ApiList<Stripe.SubscriptionItem>,
      },
    });
    const snapshot = await new StripeBillingProvider('sk_test_x', stripe).fetchSubscription(
      'sub_1',
    );
    expect(snapshot?.plan).toBeNull();
  });
});
