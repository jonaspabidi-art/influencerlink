import type { PrismaClient } from '@prisma/client';
import { badRequest } from '../../lib/errors.js';
import { decryptToken, encryptToken } from '../../lib/crypto.js';
import { TikTokError, type TikTokClient } from './tiktok.js';

/**
 * Giltig åtkomsttoken för en kreatörs TikTok-konto.
 *
 * Tokenen gäller ett dygn. Har den gått ut förnyas den här, vid anropet, i
 * stället för av ett schemalagt jobb – kreatören märker ingenting, och det
 * finns inget att glömma att sätta upp.
 *
 * Ligger för sig eftersom två vägar behöver den: kreatören som väljer klipp
 * till sin profil, och mätningen av ett publicerat inlägg i ett avtal.
 */
export async function tiktokAccessToken(
  prisma: PrismaClient,
  client: TikTokClient,
  influencerId: string,
): Promise<string> {
  const account = await prisma.socialAccount.findUnique({
    where: { influencerId_platform: { influencerId, platform: 'TIKTOK' } },
  });
  if (!account?.accessTokenEnc || account.statsSource !== 'PLATFORM') {
    throw badRequest('Kontot är inte kopplat med TikTok-inloggning.');
  }

  const expired = account.tokenExpiresAt !== null && account.tokenExpiresAt <= new Date();
  if (!expired) return decryptToken(account.accessTokenEnc);

  if (!account.refreshTokenEnc) {
    throw badRequest('Inloggningen hos TikTok har gått ut. Logga in igen.');
  }
  try {
    const tokens = await client.refreshTokens(decryptToken(account.refreshTokenEnc));
    await prisma.socialAccount.update({
      where: { id: account.id },
      data: {
        accessTokenEnc: encryptToken(tokens.accessToken),
        refreshTokenEnc: tokens.refreshToken ? encryptToken(tokens.refreshToken) : undefined,
        tokenExpiresAt: tokens.expiresAt,
      },
    });
    return tokens.accessToken;
  } catch (caught) {
    if (caught instanceof TikTokError) {
      throw badRequest('Inloggningen hos TikTok har gått ut. Logga in igen.');
    }
    throw caught;
  }
}
