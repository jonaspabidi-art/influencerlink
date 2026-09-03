import 'dotenv/config';
import { z } from 'zod';

const booleanish = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  CORS_ORIGINS: z.string().default('http://localhost:8081'),

  DATABASE_URL: z.string().min(1),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET måste vara minst 32 tecken'),
  PERSONAL_NUMBER_HMAC_KEY: z
    .string()
    .min(32, 'PERSONAL_NUMBER_HMAC_KEY måste vara minst 32 tecken'),
  TOKEN_ENCRYPTION_KEY: z.string().min(1, 'TOKEN_ENCRYPTION_KEY saknas'),

  BANKID_MODE: z.enum(['mock', 'live']).default('mock'),
  BANKID_API_URL: z.string().url().default('https://appapi2.test.bankid.com/rp/v6.0'),
  BANKID_CLIENT_CERT_PATH: z.string().optional(),
  BANKID_CLIENT_KEY_PATH: z.string().optional(),
  BANKID_CA_PATH: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_CONNECT_RETURN_URL: z.string().default('influencerlink://stripe/return'),
  STRIPE_CONNECT_REFRESH_URL: z.string().default('influencerlink://stripe/refresh'),

  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-5'),

  /** Slår på /auth/dev-login. Tvingas av till false i produktion. */
  ENABLE_DEV_LOGIN: booleanish.default('false'),
});

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Felaktig miljökonfiguration:\n${issues}`);
  }
  const env = parsed.data;
  const isProduction = env.NODE_ENV === 'production';

  if (isProduction && env.BANKID_MODE === 'mock') {
    throw new Error('BANKID_MODE=mock är inte tillåtet i produktion');
  }

  return {
    ...env,
    isProduction,
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    /** Dev-inloggning kan aldrig aktiveras i produktion, oavsett env-värde. */
    devLoginEnabled: env.ENABLE_DEV_LOGIN && !isProduction,
  };
}

export type Config = ReturnType<typeof loadConfig>;

let cached: Config | undefined;

export function getConfig(): Config {
  cached ??= loadConfig();
  return cached;
}
