/**
 * Gör en befintlig användare till admin.
 *
 * Rollen sätts aldrig från appen. Det är hela poängen: ingen kan höja sig
 * själv, och ett kapat vanligt konto kan inte bli plattformsadmin. Kör:
 *
 *   npx tsx scripts/make-admin.ts 198001019999
 *
 * Personnumret slås upp via samma hash som inloggningen använder.
 */
import { createHmac } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const personalNumber = process.argv[2];
if (!personalNumber || !/^\d{12}$/.test(personalNumber)) {
  console.error('Ange personnumret med tolv siffror: npx tsx scripts/make-admin.ts 198001019999');
  process.exit(1);
}

const key = process.env.PERSONAL_NUMBER_HMAC_KEY;
if (!key) {
  console.error('PERSONAL_NUMBER_HMAC_KEY saknas i miljön.');
  process.exit(1);
}

const prisma = new PrismaClient();
const hash = createHmac('sha256', key).update(personalNumber).digest('hex');

const user = await prisma.user.findUnique({ where: { personalNumberHash: hash } });
if (!user) {
  console.error('Ingen användare med det personnumret. Logga in i appen först.');
  await prisma.$disconnect();
  process.exit(1);
}

await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
console.log(`${user.name} är nu admin.`);
await prisma.$disconnect();
