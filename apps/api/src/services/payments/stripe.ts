import Stripe from 'stripe';
import { CURRENCY } from '@influencerlink/shared';
import type { Config } from '../../config.js';
import { failedDependency } from '../../lib/errors.js';
import type {
  ConnectOnboarding,
  CreateEscrowInput,
  PaymentProvider,
  PayoutResult,
  EscrowIntent,
} from './types.js';

/** Transfer group knyter escrow-betalningen och utbetalningen till samma kontrakt. */
const transferGroup = (contractId: string) => `contract_${contractId}`;

export class StripePaymentProvider implements PaymentProvider {
  private readonly stripe: Stripe;

  constructor(
    private readonly config: Config,
    stripe?: Stripe,
  ) {
    if (!config.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY saknas');
    }
    this.stripe = stripe ?? new Stripe(config.STRIPE_SECRET_KEY, { apiVersion: '2025-08-27.basil' });
  }

  async createConnectedAccount(input: {
    influencerId: string;
    email?: string;
    city: string;
  }): Promise<ConnectOnboarding> {
    const account = await this.stripe.accounts.create({
      type: 'express',
      country: 'SE',
      email: input.email,
      business_type: 'individual',
      capabilities: {
        transfers: { requested: true },
      },
      metadata: { influencerId: input.influencerId, city: input.city },
      settings: {
        // Utbetalningar sker manuellt när leveransen godkänts, inte på schema.
        payouts: { schedule: { interval: 'manual' } },
      },
    });
    return {
      accountId: account.id,
      onboardingUrl: await this.createOnboardingLink(account.id),
    };
  }

  async createOnboardingLink(accountId: string): Promise<string> {
    const link = await this.stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      refresh_url: this.config.STRIPE_CONNECT_REFRESH_URL,
      return_url: this.config.STRIPE_CONNECT_RETURN_URL,
    });
    return link.url;
  }

  async isPayoutsEnabled(accountId: string): Promise<boolean> {
    const account = await this.stripe.accounts.retrieve(accountId);
    return account.payouts_enabled === true;
  }

  async createCustomer(input: {
    businessId: string;
    companyName: string;
    orgNumber: string;
  }): Promise<string> {
    const customer = await this.stripe.customers.create({
      name: input.companyName,
      metadata: { businessId: input.businessId, orgNumber: input.orgNumber },
    });
    return customer.id;
  }

  async createEscrowIntent(input: CreateEscrowInput): Promise<EscrowIntent> {
    const intent = await this.stripe.paymentIntents.create(
      {
        amount: input.amount,
        currency: CURRENCY,
        customer: input.customerId,
        description: input.description,
        transfer_group: transferGroup(input.contractId),
        metadata: { contractId: input.contractId },
        automatic_payment_methods: { enabled: true },
      },
      // Samma kontrakt får aldrig ge upphov till två betalningar.
      { idempotencyKey: `escrow_${input.contractId}` },
    );
    if (!intent.client_secret) {
      throw failedDependency('Stripe returnerade ingen client secret för betalningen.');
    }
    return { paymentIntentId: intent.id, clientSecret: intent.client_secret, amount: input.amount };
  }

  async releasePayout(input: {
    contractId: string;
    destinationAccountId: string;
    amount: number;
  }): Promise<PayoutResult> {
    const transfer = await this.stripe.transfers.create(
      {
        amount: input.amount,
        currency: CURRENCY,
        destination: input.destinationAccountId,
        transfer_group: transferGroup(input.contractId),
        metadata: { contractId: input.contractId },
      },
      { idempotencyKey: `payout_${input.contractId}` },
    );
    return { transferId: transfer.id, amount: input.amount };
  }

  async refundEscrow(paymentIntentId: string): Promise<void> {
    await this.stripe.refunds.create(
      { payment_intent: paymentIntentId },
      { idempotencyKey: `refund_${paymentIntentId}` },
    );
  }

  /** Verifierar webhook-signaturen och returnerar den avkodade händelsen. */
  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    if (!this.config.STRIPE_WEBHOOK_SECRET) {
      throw new Error('STRIPE_WEBHOOK_SECRET saknas');
    }
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      this.config.STRIPE_WEBHOOK_SECRET,
    );
  }
}
