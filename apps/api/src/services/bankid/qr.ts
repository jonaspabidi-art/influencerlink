import { createHmac } from 'node:crypto';

/**
 * BankID:s animerade QR-kod. Koden byts varje sekund så att en skärmdump inte
 * kan återanvändas – därför beräknas den om vid varje statusanrop.
 *
 * Se BankID Relying Party Guidelines, avsnittet "Animated QR code".
 */
export function buildQrData(
  qrStartToken: string,
  qrStartSecret: string,
  startedAt: Date,
  now: Date = new Date(),
): string {
  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000));
  const qrAuthCode = createHmac('sha256', qrStartSecret)
    .update(String(elapsedSeconds))
    .digest('hex');
  return `bankid.${qrStartToken}.${elapsedSeconds}.${qrAuthCode}`;
}

/** Djuplänk som startar BankID-appen på samma enhet som vår app körs på. */
export function buildAutoStartUrl(autoStartToken: string, returnUrl: string): string {
  return `https://app.bankid.com/?autostarttoken=${autoStartToken}&redirect=${encodeURIComponent(returnUrl)}`;
}
