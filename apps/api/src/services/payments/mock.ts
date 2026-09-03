import { randomUUID } from 'node:crypto';
import type {
  ConnectOnboarding,
  CreateEscrowInput,
  EscrowIntent,
  PaymentProvider,
  PayoutResult,
} from './types.js';

/**
 * Betalningssimulator för utveckling utan Stripe-nycklar. Håller samma
 * kontrakt som den riktiga leverantören men rör aldrig riktiga pengar.
 */
export class MockPaymentProvider implements PaymentProvider {
  private readonly accounts = new Set<string>();
  readonly refunded: string[] = [];
  readonly transfers: PayoutResult[] = [];

  async createConnectedAccount(input: { influencerId: string }): Promise<ConnectOnboarding> {
    const accountId = `acct_mock_${input.influencerId.slice(0, 12)}`;
    this.accounts.add(accountId);
    return { accountId, onboardingUrl: await this.createOnboardingLink(accountId) };
  }

  async createOnboardingLink(accountId: string): Promise<string> {
    return `https://connect.stripe.mock/onboarding/${accountId}`;
  }

  /** Mockade konton anses alltid klara så att demoflödet går hela vägen. */
  async isPayoutsEnabled(accountId: string): Promise<boolean> {
    return accountId.startsWith('acct_mock_');
  }

  async createCustomer(input: { businessId: string }): Promise<string> {
    return `cus_mock_${input.businessId.slice(0, 12)}`;
  }

  async createEscrowIntent(input: CreateEscrowInput): Promise<EscrowIntent> {
    const paymentIntentId = `pi_mock_${input.contractId.slice(0, 12)}`;
    return {
      paymentIntentId,
      clientSecret: `${paymentIntentId}_secret_${randomUUID()}`,
      amount: input.amount,
    };
  }

  async releasePayout(input: {
    contractId: string;
    destinationAccountId: string;
    amount: number;
  }): Promise<PayoutResult> {
    const result = { transferId: `tr_mock_${input.contractId.slice(0, 12)}`, amount: input.amount };
    this.transfers.push(result);
    return result;
  }

  async refundEscrow(paymentIntentId: string): Promise<void> {
    this.refunded.push(paymentIntentId);
  }
}
