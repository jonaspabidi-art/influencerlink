import Stripe from 'stripe';
import { BARTER_PLAN_SPECS, CURRENCY, SELLABLE_BARTER_PLANS } from '@pacta/shared';
import { failedDependency } from '../../lib/errors.js';
import type {
  BillingProvider,
  SellablePlan,
  StartCheckoutInput,
  SubscriptionSnapshot,
} from './types.js';

/**
 * Priserna hittas på en nyckel i stället för på id:n i miljövariabler.
 *
 * Då behövs ingen uppsättning i Stripes gränssnitt: första gången en nivå
 * säljs skapas priset, och därefter återanvänds det. Beloppet kommer från
 * BARTER_PLAN_SPECS, som är den enda platsen där priserna står. Ändras ett
 * belopp där skapas ett nytt pris som tar över nyckeln – befintliga
 * prenumeranter ligger kvar på sitt gamla pris tills någon flyttar dem.
 */
const lookupKey = (plan: SellablePlan) => `pacta_barter_${plan.toLowerCase()}`;

/** Märker det vi skapat själva, så att vi känner igen det nästa gång. */
const TAX_RATE_TAG = 'pacta_moms_25';
const PORTAL_TAG = 'pacta_portal_v1';

export class StripeBillingProvider implements BillingProvider {
  readonly testMode: boolean;
  private readonly stripe: Stripe;
  private readonly prices = new Map<SellablePlan, string>();
  private taxRateId: string | null = null;
  private portalConfigId: string | null = null;

  constructor(secretKey: string, stripe?: Stripe) {
    this.stripe = stripe ?? new Stripe(secretKey, { apiVersion: '2025-08-27.basil' });
    this.testMode = secretKey.startsWith('sk_test_') || secretKey.startsWith('rk_test_');
  }

  async startCheckout(input: StartCheckoutInput): Promise<{ url: string; customerId: string }> {
    const customerId =
      input.customerId ??
      (
        await this.stripe.customers.create({
          name: input.companyName,
          metadata: {
            businessId: input.businessId,
            orgNumber: input.orgNumber ?? '',
          },
        })
      ).id;

    const [price, taxRate] = await Promise.all([this.priceFor(input.plan), this.mervardesskatt()]);

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: input.businessId,
      line_items: [{ price, quantity: 1 }],
      subscription_data: {
        metadata: { businessId: input.businessId },
        default_tax_rates: [taxRate],
      },
      metadata: { businessId: input.businessId, plan: input.plan },
      success_url: `${input.returnUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${input.returnUrl}?checkout=cancelled`,
      locale: 'sv',
      // Kvittot ska gå att bokföra: adress och momsnummer på restaurangen.
      billing_address_collection: 'required',
      customer_update: { name: 'auto', address: 'auto' },
      tax_id_collection: { enabled: true },
      // För pilotkunder: en rabattkod för första månaden kräver ingen ny kod.
      allow_promotion_codes: true,
    });

    if (!session.url) throw failedDependency('Stripe returnerade ingen betalsida.');
    return { url: session.url, customerId };
  }

  async subscriptionForCheckout(
    sessionId: string,
  ): Promise<{ businessId: string; subscriptionId: string } | null> {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId);
    if (session.mode !== 'subscription' || session.status !== 'complete') return null;
    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    const businessId = session.client_reference_id;
    if (!subscriptionId || !businessId) return null;
    return { businessId, subscriptionId };
  }

  async changePlan(subscriptionId: string, plan: SellablePlan): Promise<void> {
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    const item = subscription.items.data[0];
    if (!item) throw failedDependency('Prenumerationen saknar en rad att byta.');
    await this.stripe.subscriptions.update(subscriptionId, {
      items: [{ id: item.id, price: await this.priceFor(plan) }],
      // Mellanskillnaden hamnar på nästa faktura i stället för att dras nu.
      proration_behavior: 'create_prorations',
      // Byter man nivå har man ångrat en eventuell uppsägning.
      cancel_at_period_end: false,
    });
  }

  async portalUrl(customerId: string, returnUrl: string): Promise<string> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
      configuration: await this.portalConfiguration(),
      locale: 'sv',
    });
    return session.url;
  }

  async fetchSubscription(subscriptionId: string): Promise<SubscriptionSnapshot | null> {
    let subscription: Stripe.Subscription;
    try {
      subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    } catch (caught) {
      if (caught instanceof Stripe.errors.StripeInvalidRequestError && caught.statusCode === 404) {
        return null;
      }
      throw caught;
    }

    const item = subscription.items.data[0];
    const periodEnd = item ? new Date(item.current_period_end * 1000) : null;
    const cancelsAt = subscription.cancel_at_period_end
      ? periodEnd
      : subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000)
        : null;

    return {
      id: subscription.id,
      customerId:
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id,
      businessId: subscription.metadata.businessId ?? null,
      plan: item ? planForPrice(item.price) : null,
      status: subscription.status,
      renewsAt: cancelsAt ? null : periodEnd,
      cancelsAt,
    };
  }

  private async priceFor(plan: SellablePlan): Promise<string> {
    const cached = this.prices.get(plan);
    if (cached) return cached;

    const spec = BARTER_PLAN_SPECS[plan];
    const key = lookupKey(plan);
    const existing = await this.stripe.prices.list({
      lookup_keys: [key],
      active: true,
      limit: 1,
    });
    const match = existing.data.find(
      (price) => price.unit_amount === spec.monthlyPrice && price.currency === CURRENCY,
    );
    if (match) {
      this.prices.set(plan, match.id);
      return match.id;
    }

    const created = await this.stripe.prices.create({
      currency: CURRENCY,
      unit_amount: spec.monthlyPrice,
      recurring: { interval: 'month' },
      lookup_key: key,
      // Ett ändrat belopp tar över nyckeln från det gamla priset.
      transfer_lookup_key: true,
      // Priserna i appen anges utan moms – det är en tjänst till företag.
      tax_behavior: 'exclusive',
      metadata: { plan },
      product_data: {
        name: `Mat mot innehåll – ${spec.label}`,
        metadata: { plan },
      },
    });
    this.prices.set(plan, created.id);
    return created.id;
  }

  /** 25 % moms, skapad en gång och sedan återanvänd. */
  private async mervardesskatt(): Promise<string> {
    if (this.taxRateId) return this.taxRateId;
    for await (const rate of this.stripe.taxRates.list({
      active: true,
      limit: 100,
    })) {
      if (rate.metadata?.tag === TAX_RATE_TAG) {
        this.taxRateId = rate.id;
        return rate.id;
      }
    }
    const created = await this.stripe.taxRates.create({
      display_name: 'Moms',
      percentage: 25,
      inclusive: false,
      country: 'SE',
      jurisdiction: 'SE',
      metadata: { tag: TAX_RATE_TAG },
    });
    this.taxRateId = created.id;
    return created.id;
  }

  /**
   * Kundportalen, inställd från koden.
   *
   * Stripes förvalda portal måste annars sparas för hand i gränssnittet innan
   * den fungerar, och det är ett steg som glöms bort när man byter från test
   * till skarpt läge. Nivåbyten sker i appen, så portalen behöver bara kort,
   * kvitton och uppsägning.
   */
  private async portalConfiguration(): Promise<string> {
    if (this.portalConfigId) return this.portalConfigId;
    for await (const configuration of this.stripe.billingPortal.configurations.list({
      active: true,
      limit: 100,
    })) {
      if (configuration.metadata?.tag === PORTAL_TAG) {
        this.portalConfigId = configuration.id;
        return configuration.id;
      }
    }
    const created = await this.stripe.billingPortal.configurations.create({
      business_profile: { headline: 'Pacta – mat mot innehåll' },
      features: {
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        customer_update: {
          enabled: true,
          allowed_updates: ['name', 'address', 'tax_id', 'email'],
        },
        // Uppsagt abonnemang gäller perioden ut – de har redan betalat för den.
        subscription_cancel: { enabled: true, mode: 'at_period_end' },
      },
      metadata: { tag: PORTAL_TAG },
    });
    this.portalConfigId = created.id;
    return created.id;
  }
}

/** Nivån ett pris står för: först vår egen märkning, annars nyckeln. */
function planForPrice(price: Stripe.Price): SellablePlan | null {
  const tagged = price.metadata?.plan;
  const fromKey = price.lookup_key?.replace(/^pacta_barter_/, '').toUpperCase();
  for (const candidate of [tagged, fromKey]) {
    if (candidate && (SELLABLE_BARTER_PLANS as string[]).includes(candidate)) {
      return candidate as SellablePlan;
    }
  }
  return null;
}
