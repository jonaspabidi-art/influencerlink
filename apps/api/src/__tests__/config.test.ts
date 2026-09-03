import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const BASE_ENV = {
  DATABASE_URL: 'postgresql://localhost:5432/test',
  JWT_SECRET: 'test-secret-som-ar-minst-32-tecken-langt',
  PERSONAL_NUMBER_HMAC_KEY: 'test-hmac-nyckel-som-ar-minst-32-tecken',
  TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
};

/** Läser om config.ts från grunden med angivna miljövariabler. */
/**
 * config.ts läser apps/api/.env via dotenv, så tomma strängar används här
 * i stället för undefined för att säkert nolla ett värde.
 */
async function loadWith(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries({ ...BASE_ENV, ...env })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  const module = await import('../config.js');
  return module.getConfig();
}

const ENV_KEYS = [
  ...Object.keys(BASE_ENV),
  'NODE_ENV',
  'BANKID_MODE',
  'STRIPE_SECRET_KEY',
  'ALLOW_MOCK_INTEGRATIONS',
  'ENABLE_DEV_LOGIN',
  'CORS_ORIGINS',
];

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
});

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('konfiguration', () => {
  it('markerar BankID och Stripe som simulerade när nycklar saknas', async () => {
    const config = await loadWith({ NODE_ENV: 'development', BANKID_MODE: 'mock', STRIPE_SECRET_KEY: '' });
    expect(config.mockIntegrations).toEqual(['BankID', 'Stripe']);
  });

  it('vägrar starta i produktion med simulerade integrationer', async () => {
    await expect(
      loadWith({
        NODE_ENV: 'production',
        BANKID_MODE: 'mock',
        STRIPE_SECRET_KEY: '',
        ALLOW_MOCK_INTEGRATIONS: 'false',
      }),
    ).rejects.toThrow(/ALLOW_MOCK_INTEGRATIONS/);
  });

  it('tillåter simulering i produktion när flaggan sätts medvetet', async () => {
    const config = await loadWith({
      NODE_ENV: 'production',
      BANKID_MODE: 'mock',
      STRIPE_SECRET_KEY: '',
      ALLOW_MOCK_INTEGRATIONS: 'true',
    });
    expect(config.mockIntegrations).toEqual(['BankID', 'Stripe']);
    expect(config.isProduction).toBe(true);
  });

  it('rapporterar inga simulerade integrationer när allt är skarpt', async () => {
    const config = await loadWith({
      NODE_ENV: 'production',
      BANKID_MODE: 'live',
      STRIPE_SECRET_KEY: 'sk_live_abc',
    });
    expect(config.mockIntegrations).toEqual([]);
  });

  it('stänger av dev-inloggning i produktion även om flaggan är satt', async () => {
    const config = await loadWith({
      NODE_ENV: 'production',
      BANKID_MODE: 'live',
      STRIPE_SECRET_KEY: 'sk_live_abc',
      ENABLE_DEV_LOGIN: 'true',
    });
    expect(config.devLoginEnabled).toBe(false);
  });

  it('avvisar för korta hemligheter', async () => {
    await expect(loadWith({ NODE_ENV: 'development', JWT_SECRET: 'kort' })).rejects.toThrow(
      /JWT_SECRET/,
    );
  });

  it('delar upp CORS_ORIGINS på komma', async () => {
    const config = await loadWith({
      NODE_ENV: 'development',
      CORS_ORIGINS: 'https://app.se, http://localhost:8081',
    });
    expect(config.corsOrigins).toEqual(['https://app.se', 'http://localhost:8081']);
  });
});
