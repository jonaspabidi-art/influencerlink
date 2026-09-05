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
  /** Direktanslutning för migrationer, förbi eventuell pooler. */
  DIRECT_URL: z.string().min(1).optional(),

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
  STRIPE_CONNECT_RETURN_URL: z.string().default('pacta://stripe/return'),
  STRIPE_CONNECT_REFRESH_URL: z.string().default('pacta://stripe/refresh'),

  /**
   * Supabase Storage för videoutkast. Utan dem är uppladdningen avstängd och
   * slutpunkten förklarar varför i stället för att fela.
   */
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_VIDEO_BUCKET: z.string().default('drafts'),

  /**
   * TikTok Login Kit. Finns bara när appen är godkänd i utvecklarportalen.
   * Utan dem kopplas TikTok som förut, med siffror märkta som ogranskade.
   */
  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
  /** Måste stämma tecken för tecken med adressen i utvecklarportalen. */
  TIKTOK_REDIRECT_URI: z.string().url().default('https://pacta.se/auth/tiktok/callback'),

  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-5'),

  /** Slår på /auth/dev-login. Tvingas av till false i produktion. */
  ENABLE_DEV_LOGIN: booleanish.default('false'),

  /**
   * Tillåter simulerad BankID och Stripe även när NODE_ENV=production.
   * Finns för att kunna testa hela flödet i en riktig miljö innan certifikat
   * och betalkonto är på plats. Måste sättas medvetet, och API:et skriker om det.
   */
  ALLOW_MOCK_INTEGRATIONS: booleanish.default('false'),
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

  const mockIntegrations: string[] = [];
  if (env.BANKID_MODE === 'mock') mockIntegrations.push('BankID');
  if (!env.STRIPE_SECRET_KEY) mockIntegrations.push('Stripe');

  if (isProduction && mockIntegrations.length > 0 && !env.ALLOW_MOCK_INTEGRATIONS) {
    throw new Error(
      `Simulerad ${mockIntegrations.join(' och ')} i produktion kräver ALLOW_MOCK_INTEGRATIONS=true. ` +
        'Sätt den bara i test- och demomiljöer.',
    );
  }

  return {
    ...env,
    isProduction,
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    /** Dev-inloggning kan aldrig aktiveras i produktion, oavsett env-värde. */
    devLoginEnabled: env.ENABLE_DEV_LOGIN && !isProduction,
    /** Vilka integrationer som körs simulerat. Tom lista = allt är skarpt. */
    mockIntegrations,
  };
}

export type Config = ReturnType<typeof loadConfig>;

let cached: Config | undefined;

export function getConfig(): Config {
  cached ??= loadConfig();
  return cached;
}
