/** Gemensamt gränssnitt för både den riktiga BankID-klienten och mocken. */
export interface BankIdOrder {
  orderRef: string;
  autoStartToken: string;
  qrStartToken: string;
  qrStartSecret: string;
}

export interface BankIdCompletionData {
  personalNumber: string;
  name: string;
  givenName: string;
  surname: string;
  /** Base64-kodad XML-signatur. */
  signature: string;
  /** Base64-kodat OCSP-svar som tidsstämplar signaturen. */
  ocspResponse: string;
  ipAddress?: string;
}

export interface BankIdCollectResult {
  orderRef: string;
  status: 'pending' | 'failed' | 'complete';
  /** T.ex. "outstandingTransaction", "userSign", "userCancel", "expiredTransaction". */
  hintCode?: string;
  completionData?: BankIdCompletionData;
}

export interface BankIdAuthRequest {
  endUserIp: string;
  personalNumber?: string;
}

export interface BankIdSignRequest extends BankIdAuthRequest {
  /** Texten användaren ser i BankID-appen. Max 40 000 tecken före base64. */
  userVisibleData: string;
  /** Data som signeras men inte visas, t.ex. hash av avtalet. */
  userNonVisibleData?: string;
}

export interface BankIdClient {
  auth(request: BankIdAuthRequest): Promise<BankIdOrder>;
  sign(request: BankIdSignRequest): Promise<BankIdOrder>;
  collect(orderRef: string): Promise<BankIdCollectResult>;
  cancel(orderRef: string): Promise<void>;
}
