import { randomBytes, randomUUID } from 'node:crypto';
import type {
  BankIdAuthRequest,
  BankIdClient,
  BankIdCollectResult,
  BankIdOrder,
  BankIdSignRequest,
} from './types.js';

interface MockOrder extends BankIdOrder {
  personalNumber: string;
  collectCount: number;
  cancelled: boolean;
}

/** Personnummer som alltid får BankID att svara "userCancel" – för att testa felvägar. */
export const MOCK_CANCEL_PERSONAL_NUMBER = '190000000000';

/** Så många collect-anrop krävs innan mocken svarar "complete". */
const COLLECTS_BEFORE_COMPLETE = 2;

/**
 * Simulerad BankID-server för utveckling och tester. Följer samma tillstånds-
 * maskin som den riktiga v6-tjänsten: pending → pending → complete.
 * Får aldrig användas i produktion – config.ts blockerar det.
 */
export class MockBankIdClient implements BankIdClient {
  private readonly orders = new Map<string, MockOrder>();

  private createOrder(personalNumber: string | undefined): BankIdOrder {
    const order: MockOrder = {
      orderRef: randomUUID(),
      autoStartToken: randomUUID(),
      qrStartToken: randomUUID(),
      qrStartSecret: randomBytes(32).toString('hex'),
      // Utan angivet personnummer låtsas vi att en testperson skannade QR-koden.
      personalNumber: personalNumber ?? '199001011234',
      collectCount: 0,
      cancelled: false,
    };
    this.orders.set(order.orderRef, order);
    return {
      orderRef: order.orderRef,
      autoStartToken: order.autoStartToken,
      qrStartToken: order.qrStartToken,
      qrStartSecret: order.qrStartSecret,
    };
  }

  async auth(request: BankIdAuthRequest): Promise<BankIdOrder> {
    return this.createOrder(request.personalNumber);
  }

  async sign(request: BankIdSignRequest): Promise<BankIdOrder> {
    return this.createOrder(request.personalNumber);
  }

  async collect(orderRef: string): Promise<BankIdCollectResult> {
    const order = this.orders.get(orderRef);
    if (!order) {
      return { orderRef, status: 'failed', hintCode: 'expiredTransaction' };
    }
    if (order.cancelled) {
      return { orderRef, status: 'failed', hintCode: 'userCancel' };
    }
    if (order.personalNumber === MOCK_CANCEL_PERSONAL_NUMBER) {
      return { orderRef, status: 'failed', hintCode: 'userCancel' };
    }

    order.collectCount += 1;
    if (order.collectCount < COLLECTS_BEFORE_COMPLETE) {
      return { orderRef, status: 'pending', hintCode: 'outstandingTransaction' };
    }
    if (order.collectCount === COLLECTS_BEFORE_COMPLETE) {
      return {
        orderRef,
        status: 'complete',
        completionData: {
          personalNumber: order.personalNumber,
          name: mockNameFor(order.personalNumber),
          givenName: mockNameFor(order.personalNumber).split(' ')[0] ?? 'Test',
          surname: mockNameFor(order.personalNumber).split(' ')[1] ?? 'Testsson',
          signature: Buffer.from(`mock-signature:${orderRef}`).toString('base64'),
          ocspResponse: Buffer.from(`mock-ocsp:${orderRef}`).toString('base64'),
        },
      };
    }
    // Den riktiga tjänsten glömmer ordern efter att den hämtats som complete.
    return { orderRef, status: 'failed', hintCode: 'expiredTransaction' };
  }

  async cancel(orderRef: string): Promise<void> {
    const order = this.orders.get(orderRef);
    if (order) order.cancelled = true;
  }
}

/** Ger samma personnummer samma påhittade namn genom hela sessionen. */
function mockNameFor(personalNumber: string): string {
  const names = [
    'Anna Karlsson',
    'Erik Lindberg',
    'Sara Nyström',
    'Johan Bergqvist',
    'Maja Öberg',
    'Oskar Holm',
  ];
  const index = Number(personalNumber.slice(-4)) % names.length;
  return names[index] ?? 'Test Testsson';
}
