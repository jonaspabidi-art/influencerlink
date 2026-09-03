import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * Skriver en rad i spårbarhetsloggen. Används för allt med juridisk eller
 * ekonomisk innebörd: signeringar, escrow, utbetalningar och statusbyten.
 */
export async function recordAudit(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: {
    userId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata,
    },
  });
}
