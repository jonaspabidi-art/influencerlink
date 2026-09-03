import type { Config } from '../../config.js';
import { MockPaymentProvider } from './mock.js';
import { StripePaymentProvider } from './stripe.js';
import type { PaymentProvider } from './types.js';

export * from './types.js';
export { MockPaymentProvider } from './mock.js';
export { StripePaymentProvider } from './stripe.js';

/**
 * Utan STRIPE_SECRET_KEY kör vi simulatorn så att hela flödet kan demas lokalt.
 * I produktion är nyckeln obligatorisk.
 */
export function createPaymentProvider(config: Config): PaymentProvider {
  if (config.STRIPE_SECRET_KEY) {
    return new StripePaymentProvider(config);
  }
  if (config.isProduction) {
    throw new Error('STRIPE_SECRET_KEY krävs i produktion');
  }
  return new MockPaymentProvider();
}
