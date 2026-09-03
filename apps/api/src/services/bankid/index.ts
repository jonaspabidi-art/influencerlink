import type { Config } from '../../config.js';
import { LiveBankIdClient } from './live.js';
import { MockBankIdClient } from './mock.js';
import type { BankIdClient } from './types.js';

export * from './types.js';
export { buildAutoStartUrl, buildQrData } from './qr.js';
export { translateBankIdError, translateBankIdHint } from './live.js';
export { MOCK_CANCEL_PERSONAL_NUMBER, MockBankIdClient } from './mock.js';

export function createBankIdClient(config: Config): BankIdClient {
  return config.BANKID_MODE === 'live' ? new LiveBankIdClient(config) : new MockBankIdClient();
}
