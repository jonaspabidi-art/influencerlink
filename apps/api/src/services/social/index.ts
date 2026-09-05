import { createHash } from 'node:crypto';
import type { Platform } from '@pacta/shared';
import type { Config } from '../../config.js';
import { TikTokClient } from './tiktok.js';

/**
 * Varifrån siffrorna kommer.
 *
 * Skillnaden är hela poängen: ett företag som betalar utifrån räckvidd måste
 * kunna se om talet kommer från plattformen eller är något vi genererat medan
 * integrationen väntar på godkännande.
 */
export type StatsSource = 'PLATFORM' | 'DEMO';

export interface SocialStats {
  externalId: string;
  handle: string;
  followers: number;
  avgViews: number;
  /** Andel, t.ex. 0.045 för 4,5 %. */
  engagementRate: number;
  verified: boolean;
  source: StatsSource;
  /** Antal videor snittvisningarna bygger på. Noll när siffran inte är mätt. */
  sampleSize?: number;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
}

export interface SocialProvider {
  /**
   * Växlar in en OAuth-kod mot åtkomsttoken och hämtar kontostatistik.
   *
   * Riktiga anrop per plattform:
   *   TikTok    POST https://open.tiktokapis.com/v2/oauth/token/ → /v2/user/info/
   *   Instagram POST https://api.instagram.com/oauth/access_token → Graph API /me
   *   YouTube   POST https://oauth2.googleapis.com/token → youtube/v3/channels
   */
  connect(input: { platform: Platform; handle: string; authorizationCode?: string }): Promise<SocialStats>;
  /** Uppdaterar statistiken för ett redan kopplat konto. */
  refresh(input: { platform: Platform; handle: string; externalId: string }): Promise<SocialStats>;
}

/**
 * Demoleverantör som genererar stabil, rimlig statistik utifrån användarnamnet.
 * Samma handle ger alltid samma siffror, vilket gör seed-data och tester
 * förutsägbara. Byts mot riktiga OAuth-klienter när plattformsapparna är
 * godkända hos TikTok, Meta och Google.
 */
export class DemoSocialProvider implements SocialProvider {
  async connect(input: { platform: Platform; handle: string }): Promise<SocialStats> {
    return this.statsFor(input.platform, input.handle);
  }

  async refresh(input: { platform: Platform; handle: string }): Promise<SocialStats> {
    return this.statsFor(input.platform, input.handle);
  }

  private statsFor(platform: Platform, rawHandle: string): SocialStats {
    // Normalisera först: @Anna och anna är samma konto och ska ge samma siffror.
    const handle = rawHandle.replace(/^@/, '');
    const seed = createHash('sha256').update(`${platform}:${handle.toLowerCase()}`).digest();
    const pick = (offset: number, span: number) => (seed.readUInt32BE(offset) % span) + 1;

    // Följarintervall som speglar hur plattformarna faktiskt ser ut i Sverige.
    const followerCeiling = platform === 'YOUTUBE' ? 120_000 : 250_000;
    const followers = 2_000 + pick(0, followerCeiling);
    // TikTok ger normalt fler visningar per följare än Instagram och YouTube.
    const viewRatio = platform === 'TIKTOK' ? 0.9 : platform === 'INSTAGRAM' ? 0.45 : 0.3;
    const avgViews = Math.round(followers * viewRatio * (0.6 + (pick(4, 80) / 100)));
    const engagementRate = Number(((pick(8, 90) + 10) / 1500).toFixed(4));

    return {
      externalId: seed.subarray(0, 8).toString('hex'),
      handle,
      followers,
      avgViews,
      engagementRate,
      verified: followers > 50_000,
      source: 'DEMO',
    };
  }
}

/** Summerar statistik över alla kopplade konton till profilnivå. */
export function aggregateStats(
  accounts: Array<{ followers: number; avgViews: number; engagementRate: number }>,
): { followers: number; avgViews: number; engagementRate: number } {
  if (accounts.length === 0) return { followers: 0, avgViews: 0, engagementRate: 0 };
  const followers = accounts.reduce((sum, account) => sum + account.followers, 0);
  const avgViews = Math.round(
    accounts.reduce((sum, account) => sum + account.avgViews, 0) / accounts.length,
  );
  // Engagemanget vägs med följarantal så att ett litet extrakonto inte snedvrider.
  const weighted = accounts.reduce(
    (sum, account) => sum + account.engagementRate * account.followers,
    0,
  );
  return {
    followers,
    avgViews,
    engagementRate: followers > 0 ? Number((weighted / followers).toFixed(4)) : 0,
  };
}

/**
 * TikTok-klienten, eller null när appen inte är godkänd och konfigurerad än.
 *
 * Kopplingen mot TikTok går inte genom `SocialProvider`: den kräver att
 * kreatören loggar in hos TikTok först, och har därför egna slutpunkter.
 * Instagram och YouTube använder fortfarande demoleverantören, och deras
 * siffror märks som ogranskade hela vägen ut i appen.
 */
export function createTikTokClient(config: Config): TikTokClient | null {
  if (!config.TIKTOK_CLIENT_KEY || !config.TIKTOK_CLIENT_SECRET) return null;
  return new TikTokClient({
    clientKey: config.TIKTOK_CLIENT_KEY,
    clientSecret: config.TIKTOK_CLIENT_SECRET,
    redirectUri: config.TIKTOK_REDIRECT_URI,
  });
}
