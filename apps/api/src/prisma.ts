import { PrismaClient } from '@prisma/client';

let client: PrismaClient | undefined;

/** En delad Prisma-instans per process – flera skulle äta upp anslutningspoolen. */
export function getPrisma(): PrismaClient {
  client ??= new PrismaClient();
  return client;
}

export async function disconnectPrisma(): Promise<void> {
  await client?.$disconnect();
  client = undefined;
}

export type { PrismaClient };
