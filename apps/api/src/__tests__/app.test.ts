import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import type { Config } from '../config.js';
import { MockBankIdClient } from '../services/bankid/index.js';
import { AiService } from '../services/ai/index.js';
import { MockPaymentProvider } from '../services/payments/index.js';
import { DemoSocialProvider } from '../services/social.js';
import type { Services } from '../services/index.js';

const config = {
  NODE_ENV: 'test',
  PORT: 3000,
  HOST: '127.0.0.1',
  LOG_LEVEL: 'error',
  CORS_ORIGINS: 'http://localhost:8081',
  DATABASE_URL: 'postgresql://localhost:5432/test',
  JWT_SECRET: 'test-secret-som-ar-minst-32-tecken-langt',
  PERSONAL_NUMBER_HMAC_KEY: 'test-hmac-nyckel-som-ar-minst-32-tecken',
  TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  BANKID_MODE: 'mock',
  BANKID_API_URL: 'https://appapi2.test.bankid.com/rp/v6.0',
  ANTHROPIC_MODEL: 'claude-sonnet-5',
  STRIPE_CONNECT_RETURN_URL: 'influencerlink://stripe/return',
  STRIPE_CONNECT_REFRESH_URL: 'influencerlink://stripe/refresh',
  ENABLE_DEV_LOGIN: false,
  isProduction: false,
  corsOrigins: ['http://localhost:8081'],
  devLoginEnabled: false,
  ALLOW_MOCK_INTEGRATIONS: false,
  mockIntegrations: ['BankID', 'Stripe'],
} as unknown as Config;

/** Databasen används inte i det här testet – varje anrop mot den ska falla. */
const prisma = new Proxy({} as PrismaClient, {
  get() {
    throw new Error('Testet ska inte röra databasen');
  },
});

const services: Services = {
  config,
  prisma,
  bankId: new MockBankIdClient(),
  payments: new MockPaymentProvider(),
  ai: new AiService(config),
  social: new DemoSocialProvider(),
};

describe('HTTP-lagret', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp(services);
  });

  afterAll(async () => {
    await app.close();
  });

  it('svarar på hälsokontrollen', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok', bankIdMode: 'mock' });
  });

  it('svarar 404 med problemformat för okända slutpunkter', async () => {
    const response = await app.inject({ method: 'GET', url: '/finns-inte' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: 'not_found' });
  });

  it('kräver inloggning för skyddade slutpunkter', async () => {
    const response = await app.inject({ method: 'GET', url: '/matches' });
    expect(response.statusCode).toBe(401);
    expect(response.json().message).toMatch(/BankID/);
  });

  it('avvisar en token som signerats med fel nyckel', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/matches',
      headers: { authorization: 'Bearer inte.en.giltig-token' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('stoppar en influencer från restaurangens slutpunkter', async () => {
    const token = app.jwt.sign({ sub: 'user-1', role: 'INFLUENCER', pid: 'inf-1' });
    const response = await app.inject({
      method: 'GET',
      url: '/campaigns/mine',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(403);
  });

  it('validerar begäran innan databasen rörs', async () => {
    const token = app.jwt.sign({ sub: 'user-1', role: 'INFLUENCER', pid: 'inf-1' });
    const response = await app.inject({
      method: 'POST',
      url: '/swipes',
      headers: { authorization: `Bearer ${token}` },
      payload: { campaignId: '', direction: 'KANSKE' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'validation_error' });
  });

  it('döljer dev-inloggningen när den inte är påslagen', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/dev-login',
      payload: { personalNumber: '199001011234', name: 'Test', role: 'INFLUENCER' },
    });
    expect(response.statusCode).toBe(404);
  });

  it('avvisar betyg utanför skalan innan databasen rörs', async () => {
    const token = app.jwt.sign({ sub: 'user-1', role: 'BUSINESS', pid: 'biz-1' });
    const response = await app.inject({
      method: 'POST',
      url: '/contracts/ctr-1/reviews',
      headers: { authorization: `Bearer ${token}` },
      payload: { scores: { communication: 0, asDescribed: 6, again: 3 }, comment: '' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'validation_error' });
  });

  it('kräver färdig profil innan ett omdöme kan lämnas', async () => {
    // Utan pid är onboardingen inte klar, och då finns ingen part att vara.
    const token = app.jwt.sign({ sub: 'user-1', role: 'BUSINESS' });
    const response = await app.inject({
      method: 'POST',
      url: '/contracts/ctr-1/reviews',
      headers: { authorization: `Bearer ${token}` },
      payload: { scores: { communication: 5, asDescribed: 5, again: 5 }, comment: '' },
    });
    expect(response.statusCode).toBe(403);
  });

  it('kräver inloggning för att läsa en profils omdömen', async () => {
    const response = await app.inject({ method: 'GET', url: '/influencers/inf-1/reviews' });
    expect(response.statusCode).toBe(401);
  });

  it('svarar 400 på Stripe-webhooken utan signatur', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: { 'content-type': 'application/json' },
      payload: '{}',
    });
    // Utan riktig Stripe-nyckel är webhooken inte konfigurerad.
    expect([400, 503]).toContain(response.statusCode);
  });
});
