import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

/** Kostnadsparametrar. N=16384 tar ungefär 50 ms, vilket är rimligt för en inloggning. */
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/**
 * Lösenord hashas med scrypt ur nodes egen kryptomodul. Ingen extra
 * beroendekedja, och till skillnad från en ren hashfunktion är den
 * avsiktligt långsam nog att göra listor av gissningar dyra.
 *
 * Formatet är "scrypt$<salt i hex>$<nyckel i hex>" så att parametrar kan
 * bytas senare utan att gamla hashar blir oläsbara.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

/** Jämförelsen är tidskonstant så att svarstiden inte avslöjar hur mycket som stämde. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, keyHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;

  const expected = Buffer.from(keyHex, 'hex');
  const actual = (await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
