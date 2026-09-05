import type { PrismaClient } from '@prisma/client';
import type { Config } from '../config.js';
import { AiService } from './ai/index.js';
import { createBankIdClient, type BankIdClient } from './bankid/index.js';
import { createPaymentProvider, type PaymentProvider } from './payments/index.js';
import { HttpOembedProvider, type OembedProvider } from './oembed.js';
import { DemoSocialProvider, type SocialProvider } from './social.js';

/**
 * Alla externa beroenden samlade på ett ställe. Routes tar emot den här
 * containern istället för att skapa klienter själva, vilket gör att tester
 * kan skjuta in mockar utan att röra HTTP-lagret.
 */
export interface Services {
  config: Config;
  prisma: PrismaClient;
  bankId: BankIdClient;
  payments: PaymentProvider;
  ai: AiService;
  social: SocialProvider;
  oembed: OembedProvider;
}

export function createServices(
  config: Config,
  prisma: PrismaClient,
  overrides: Partial<Services> = {},
): Services {
  return {
    config,
    prisma,
    bankId: createBankIdClient(config),
    payments: createPaymentProvider(config),
    ai: new AiService(config),
    social: new DemoSocialProvider(),
    oembed: new HttpOembedProvider(),
    ...overrides,
  };
}
