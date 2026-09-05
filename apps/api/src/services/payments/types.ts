import type { Ore } from '@pacta/shared';

export interface ConnectOnboarding {
  accountId: string;
  /** URL som appen öppnar i en webbläsarvy för Stripes onboardingflöde. */
  onboardingUrl: string;
}

export interface EscrowIntent {
  paymentIntentId: string;
  /** Skickas till Stripes SDK i mobilappen för att bekräfta betalningen. */
  clientSecret: string;
  amount: Ore;
}

export interface PayoutResult {
  transferId: string;
  amount: Ore;
}

export interface CreateEscrowInput {
  contractId: string;
  amount: Ore;
  /** Stripe-kund för restaurangen, skapas vid behov. */
  customerId?: string;
  description: string;
}

/**
 * Betalflödet i två steg: restaurangen betalar in till plattformen när
 * kontraktet blir aktivt (escrow), och pengarna förs över till influencern
 * först när leveransen är godkänd.
 */
export interface PaymentProvider {
  createConnectedAccount(input: {
    influencerId: string;
    email?: string;
    city: string;
  }): Promise<ConnectOnboarding>;
  createOnboardingLink(accountId: string): Promise<string>;
  isPayoutsEnabled(accountId: string): Promise<boolean>;
  createCustomer(input: { businessId: string; companyName: string; orgNumber: string }): Promise<string>;
  createEscrowIntent(input: CreateEscrowInput): Promise<EscrowIntent>;
  releasePayout(input: {
    contractId: string;
    destinationAccountId: string;
    amount: Ore;
  }): Promise<PayoutResult>;
  refundEscrow(paymentIntentId: string): Promise<void>;
}
