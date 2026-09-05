import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Signerat state för OAuth-omdirigeringar.
 *
 * Egen signering i stället för sessionstokenen: ett state som går att verifiera
 * som en session vore en inloggning på vift. Det här går bara att verifiera
 * här, och lever i tio minuter.
 *
 * Innehållet är inte hemligt, men det är låst: PKCE-verifieraren behöver
 * överleva från att inloggningen startar till att koden växlas in, och genom
 * att bära den i state slipper vi lagra påbörjade inloggningar som ingen
 * någonsin slutför.
 */

const TTL_MS = 10 * 60 * 1000;

export interface OauthState {
  purpose: string;
  userId: string;
  influencerId: string;
  codeVerifier: string;
}

export function signState(state: OauthState, secret: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ ...state, exp: now + TTL_MS })).toString(
    'base64url',
  );
  return `${payload}.${sign(payload, secret)}`;
}

/** Returnerar null när signaturen inte stämmer eller tiden gått ut. */
export function verifyState(token: string, secret: string, now = Date.now()): OauthState | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = sign(payload, secret);
  const given = Buffer.from(signature);
  // Längdskillnad får inte gå till timingSafeEqual, som kastar då.
  if (given.length !== expected.length) return null;
  if (!timingSafeEqual(given, Buffer.from(expected))) return null;

  let decoded: Record<string, unknown>;
  try {
    decoded = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (typeof decoded.exp !== 'number' || decoded.exp < now) return null;
  if (
    typeof decoded.purpose !== 'string' ||
    typeof decoded.userId !== 'string' ||
    typeof decoded.influencerId !== 'string' ||
    typeof decoded.codeVerifier !== 'string'
  ) {
    return null;
  }

  return {
    purpose: decoded.purpose,
    userId: decoded.userId,
    influencerId: decoded.influencerId,
    codeVerifier: decoded.codeVerifier,
  };
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}
