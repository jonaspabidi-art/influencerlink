import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { getConfig } from '../config.js';

/**
 * Personnummer får aldrig lagras i klartext. Vi sparar en nyckelhållen HMAC för
 * uppslag och en maskerad variant för visning.
 */
export function hashPersonalNumber(personalNumber: string): string {
  const { PERSONAL_NUMBER_HMAC_KEY } = getConfig();
  return createHmac('sha256', PERSONAL_NUMBER_HMAC_KEY).update(personalNumber).digest('hex');
}

/** "199001011234" → "19900101-****" */
export function maskPersonalNumber(personalNumber: string): string {
  return `${personalNumber.slice(0, 8)}-****`;
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function constantTimeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

function encryptionKey(): Buffer {
  const key = Buffer.from(getConfig().TOKEN_ENCRYPTION_KEY, 'base64');
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY måste vara 32 byte kodade i base64');
  }
  return key;
}

/**
 * AES-256-GCM för OAuth-tokens från TikTok/Instagram/YouTube.
 * Format: base64(iv | authTag | ciphertext).
 */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
}

export function decryptToken(payload: string): string {
  const raw = Buffer.from(payload, 'base64');
  if (raw.length < 29) {
    throw new Error('Krypterad token är för kort för att vara giltig');
  }
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
