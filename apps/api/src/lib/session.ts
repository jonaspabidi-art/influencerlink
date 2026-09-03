import type { PrismaClient } from '@prisma/client';
import type { SessionPayload } from '../plugins/auth.js';

/**
 * Bygger sessionsnyttolasten. Profil-id läggs med så att routes slipper slå
 * upp profilen på varje anrop – tokenen är kortlivad, så den hinner inte bli
 * inaktuell på ett sätt som spelar roll.
 */
export async function buildSessionPayload(
  prisma: PrismaClient,
  userId: string,
): Promise<SessionPayload> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      influencerProfile: { select: { id: true } },
      businessProfile: { select: { id: true } },
    },
  });
  const profileId = user.influencerProfile?.id ?? user.businessProfile?.id;
  return { sub: user.id, role: user.role, ...(profileId ? { pid: profileId } : {}) };
}
