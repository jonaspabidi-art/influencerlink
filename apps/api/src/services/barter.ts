import type { PrismaClient } from '@prisma/client';
import {
  MAX_OPEN_BARTER_PER_CREATOR,
  barterAllowance,
  barterBlocker,
  type BarterAllowance,
  type CreatorReliability,
} from '@pacta/shared';
import { badRequest } from '../lib/errors.js';

/**
 * Mat mot innehåll: takräkning och pålitlighet.
 *
 * Ett bartersamarbete känns igen på att arvodet är noll. Det är avsiktligt
 * inget eget fält: ett avtal utan pengar *är* ett barteravtal, och två
 * sanningar om samma sak hade kunnat glida isär.
 */

/** Början på innevarande kalendermånad, i serverns tidszon. */
function startOfMonth(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Hur många bartersamarbeten företaget startat den här månaden.
 *
 * Räknat på när avtalet skapades, inte på när det blev klart. Annars skulle
 * ett företag kunna fylla appen med uppdrag som aldrig slutförs utan att det
 * syns i taket.
 */
export async function barterUsage(
  prisma: PrismaClient,
  businessId: string,
  now = new Date(),
): Promise<BarterAllowance> {
  const [business, used] = await Promise.all([
    prisma.businessProfile.findUniqueOrThrow({
      where: { id: businessId },
      select: { barterPlan: true },
    }),
    prisma.contract.count({
      where: {
        fee: 0,
        status: { not: 'CANCELLED' },
        campaign: { businessId },
        createdAt: { gte: startOfMonth(now) },
      },
    }),
  ]);
  return barterAllowance({ plan: business.barterPlan, used });
}

/** Kastar med en läsbar mening när företaget inte får starta fler den här månaden. */
export async function assertBarterAllowed(
  prisma: PrismaClient,
  businessId: string,
): Promise<void> {
  const allowance = await barterUsage(prisma, businessId);
  const blocker = barterBlocker(allowance);
  if (blocker) throw badRequest(blocker);
}

/**
 * Kreatören får ha ett par öppna bartersamarbeten åt gången.
 *
 * Utan tak kan någon boka in sig på sex ställen samma vecka och gå till två.
 * Det kostar restaurangerna mat och Pacta trovärdighet, och det syns inte
 * förrän skadan är gjord.
 */
export async function assertCreatorHasBarterRoom(
  prisma: PrismaClient,
  influencerId: string,
): Promise<void> {
  const open = await prisma.contract.count({
    where: {
      fee: 0,
      influencerId,
      status: { in: ['SENT', 'PARTIALLY_SIGNED', 'ACTIVE', 'DELIVERED'] },
    },
  });
  if (open >= MAX_OPEN_BARTER_PER_CREATOR) {
    throw badRequest(
      `Kreatören har redan ${MAX_OPEN_BARTER_PER_CREATOR} pågående samarbeten mot mat och kan inte ta fler förrän något är klart.`,
    );
  }
}

/**
 * Genomförda och avbrutna bartersamarbeten för en kreatör.
 *
 * Avbrutet räknas fram, inte anmäls: ett avtal som passerat sitt datum utan
 * att ha levererats är avbrutet. Ett formulär där restaurangen anmäler någon
 * hade blivit ett vapen, och hade dessutom krävt att någon orkar fylla i det.
 */
export async function creatorReliability(
  prisma: PrismaClient,
  influencerId: string,
  now = new Date(),
): Promise<CreatorReliability> {
  const [completed, abandoned] = await Promise.all([
    prisma.contract.count({ where: { fee: 0, influencerId, status: 'COMPLETED' } }),
    prisma.contract.count({
      where: {
        fee: 0,
        influencerId,
        status: { in: ['SENT', 'PARTIALLY_SIGNED', 'ACTIVE'] },
        dueDate: { lt: now },
      },
    }),
  ]);
  return { completed, abandoned };
}

/** Samma siffror för flera kreatörer på en gång, till listor. */
export async function creatorReliabilityMap(
  prisma: PrismaClient,
  influencerIds: string[],
  now = new Date(),
): Promise<Map<string, CreatorReliability>> {
  const result = new Map<string, CreatorReliability>();
  if (influencerIds.length === 0) return result;

  const rows = await prisma.contract.groupBy({
    by: ['influencerId', 'status'],
    where: { fee: 0, influencerId: { in: influencerIds } },
    _count: { _all: true },
    // Avbrutna kräver ett datumvillkor som inte går att uttrycka per grupp,
    // så de räknas separat nedan.
  });
  const overdue = await prisma.contract.groupBy({
    by: ['influencerId'],
    where: {
      fee: 0,
      influencerId: { in: influencerIds },
      status: { in: ['SENT', 'PARTIALLY_SIGNED', 'ACTIVE'] },
      dueDate: { lt: now },
    },
    _count: { _all: true },
  });

  for (const id of influencerIds) result.set(id, { completed: 0, abandoned: 0 });
  for (const row of rows) {
    if (row.status !== 'COMPLETED') continue;
    const entry = result.get(row.influencerId);
    if (entry) entry.completed = row._count._all;
  }
  for (const row of overdue) {
    const entry = result.get(row.influencerId);
    if (entry) entry.abandoned = row._count._all;
  }
  return result;
}
