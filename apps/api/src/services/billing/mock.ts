import { randomUUID } from 'node:crypto';
import type {
  BillingProvider,
  SellablePlan,
  StartCheckoutInput,
  SubscriptionSnapshot,
} from './types.js';

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Abonnemang utan Stripe, för utveckling och tester.
 *
 * Betalsidan hoppas över: adressen pekar direkt tillbaka till appen som om
 * betalningen gått igenom. Resten av flödet – bekräftelsen, synkningen,
 * nivåbyten och uppsägning – går samma väg som mot Stripe.
 */
export class MockBillingProvider implements BillingProvider {
  readonly testMode = true;
  private readonly sessions = new Map<
    string,
    { businessId: string; plan: SellablePlan; customerId: string }
  >();
  readonly subscriptions = new Map<string, SubscriptionSnapshot>();

  async startCheckout(input: StartCheckoutInput): Promise<{ url: string; customerId: string }> {
    const customerId = input.customerId ?? `cus_mock_${input.businessId.slice(0, 12)}`;
    const sessionId = `cs_mock_${randomUUID()}`;
    this.sessions.set(sessionId, {
      businessId: input.businessId,
      plan: input.plan,
      customerId,
    });
    return {
      url: `${input.returnUrl}?checkout=success&session_id=${sessionId}`,
      customerId,
    };
  }

  async subscriptionForCheckout(
    sessionId: string,
  ): Promise<{ businessId: string; subscriptionId: string } | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    const subscriptionId = `sub_mock_${sessionId.slice(8, 20)}`;
    if (!this.subscriptions.has(subscriptionId)) {
      this.subscriptions.set(subscriptionId, {
        id: subscriptionId,
        customerId: session.customerId,
        businessId: session.businessId,
        plan: session.plan,
        status: 'active',
        renewsAt: new Date(Date.now() + MONTH_MS),
        cancelsAt: null,
      });
    }
    return { businessId: session.businessId, subscriptionId };
  }

  async changePlan(subscriptionId: string, plan: SellablePlan): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) throw new Error(`okänd prenumeration ${subscriptionId}`);
    this.subscriptions.set(subscriptionId, {
      ...subscription,
      plan,
      cancelsAt: null,
      renewsAt: subscription.renewsAt ?? subscription.cancelsAt,
    });
  }

  async portalUrl(_customerId: string, returnUrl: string): Promise<string> {
    return `${returnUrl}?portal=mock`;
  }

  async fetchSubscription(subscriptionId: string): Promise<SubscriptionSnapshot | null> {
    return this.subscriptions.get(subscriptionId) ?? null;
  }

  /** För tester: det som händer när Stripe ger upp eller kunden säger upp. */
  setStatus(subscriptionId: string, status: string, cancelsAt: Date | null = null): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) throw new Error(`okänd prenumeration ${subscriptionId}`);
    this.subscriptions.set(subscriptionId, {
      ...subscription,
      status,
      cancelsAt,
      renewsAt: cancelsAt ? null : subscription.renewsAt,
    });
  }
}
