import { readFileSync } from 'node:fs';
import { Agent, request } from 'undici';
import type { Config } from '../../config.js';
import { failedDependency } from '../../lib/errors.js';
import type {
  BankIdAuthRequest,
  BankIdClient,
  BankIdCollectResult,
  BankIdOrder,
  BankIdSignRequest,
} from './types.js';

interface BankIdErrorBody {
  errorCode?: string;
  details?: string;
}

/**
 * Klient mot BankID:s REST-API v6. Kommunikationen sker över ömsesidig TLS:
 * vi presenterar RP-certifikatet och verifierar BankID:s CA.
 */
export class LiveBankIdClient implements BankIdClient {
  private readonly agent: Agent;

  constructor(private readonly config: Config) {
    const { BANKID_CLIENT_CERT_PATH, BANKID_CLIENT_KEY_PATH, BANKID_CA_PATH } = config;
    if (!BANKID_CLIENT_CERT_PATH || !BANKID_CLIENT_KEY_PATH || !BANKID_CA_PATH) {
      throw new Error(
        'BANKID_MODE=live kräver BANKID_CLIENT_CERT_PATH, BANKID_CLIENT_KEY_PATH och BANKID_CA_PATH',
      );
    }
    this.agent = new Agent({
      connect: {
        cert: readFileSync(BANKID_CLIENT_CERT_PATH),
        key: readFileSync(BANKID_CLIENT_KEY_PATH),
        ca: readFileSync(BANKID_CA_PATH),
        rejectUnauthorized: true,
      },
    });
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await request(`${this.config.BANKID_API_URL}${path}`, {
      method: 'POST',
      dispatcher: this.agent,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    const text = await response.body.text();
    if (response.statusCode >= 400) {
      const parsed = safeJson<BankIdErrorBody>(text);
      throw failedDependency(
        translateBankIdError(parsed?.errorCode),
        { errorCode: parsed?.errorCode, statusCode: response.statusCode },
      );
    }
    // cancel svarar med en tom kropp.
    return (text ? JSON.parse(text) : {}) as T;
  }

  async auth(request: BankIdAuthRequest): Promise<BankIdOrder> {
    return this.post<BankIdOrder>('/auth', {
      endUserIp: request.endUserIp,
      ...(request.personalNumber
        ? { requirement: { personalNumber: request.personalNumber } }
        : {}),
    });
  }

  async sign(request: BankIdSignRequest): Promise<BankIdOrder> {
    return this.post<BankIdOrder>('/sign', {
      endUserIp: request.endUserIp,
      userVisibleData: Buffer.from(request.userVisibleData, 'utf8').toString('base64'),
      userVisibleDataFormat: 'simpleMarkdownV1',
      ...(request.userNonVisibleData
        ? {
            userNonVisibleData: Buffer.from(request.userNonVisibleData, 'utf8').toString('base64'),
          }
        : {}),
      ...(request.personalNumber
        ? { requirement: { personalNumber: request.personalNumber } }
        : {}),
    });
  }

  async collect(orderRef: string): Promise<BankIdCollectResult> {
    return this.post<BankIdCollectResult>('/collect', { orderRef });
  }

  async cancel(orderRef: string): Promise<void> {
    await this.post('/cancel', { orderRef });
  }
}

function safeJson<T>(text: string): T | undefined {
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

/** BankID:s felkoder översatta till text som kan visas direkt för användaren. */
export function translateBankIdError(errorCode: string | undefined): string {
  switch (errorCode) {
    case 'invalidParameters':
      return 'BankID kunde inte starta med de uppgifter som angavs.';
    case 'alreadyInProgress':
      return 'Det finns redan en pågående BankID-order. Avbryt den och försök igen.';
    case 'requestTimeout':
    case 'maintenance':
      return 'BankID svarar inte just nu. Försök igen om en liten stund.';
    case 'unauthorized':
    case 'notFound':
      return 'BankID nekade anropet. Kontakta support.';
    default:
      return 'Kunde inte nå BankID. Försök igen.';
  }
}

/** Hintkoder från collect översatta till text som visas medan man väntar. */
export function translateBankIdHint(hintCode: string | undefined): string {
  switch (hintCode) {
    case 'outstandingTransaction':
    case 'noClient':
      return 'Starta BankID-appen på din enhet.';
    case 'started':
      return 'Söker efter BankID … skriv in din säkerhetskod i appen.';
    case 'userSign':
      return 'Skriv in din säkerhetskod i BankID-appen och välj Legitimera.';
    case 'userCancel':
      return 'Du avbröt legitimeringen.';
    case 'cancelled':
      return 'Legitimeringen avbröts.';
    case 'expiredTransaction':
      return 'BankID hann inte svara i tid. Försök igen.';
    case 'certificateErr':
      return 'Ditt BankID är spärrat eller för gammalt.';
    case 'startFailed':
      return 'Kunde inte läsa av QR-koden. Försök igen.';
    default:
      return 'Väntar på BankID …';
  }
}
