import type { Config } from '../../config.js';
import { MockBillingProvider } from './mock.js';
import { StripeBillingProvider } from './stripe.js';
import type { BillingProvider } from './types.js';

export * from './types.js';
export { MockBillingProvider } from './mock.js';
export { StripeBillingProvider } from './stripe.js';
export * from './sync.js';

/** Samma nyckel som kampanjbetalningarna. Utan den simuleras abonnemangen. */
export function createBillingProvider(config: Config): BillingProvider {
  if (config.STRIPE_SECRET_KEY) return new StripeBillingProvider(config.STRIPE_SECRET_KEY);
  return new MockBillingProvider();
}
