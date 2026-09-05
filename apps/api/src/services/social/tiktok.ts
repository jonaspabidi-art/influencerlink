import { createHash, randomBytes } from 'node:crypto';
import type { SocialStats } from './index.js';

/**
 * TikTok Login Kit och Display API (v2).
 *
 * Det här är enda vägen till siffror som faktiskt stämmer. Kreatören loggar in
 * hos TikTok, vi får en token, och läser följarantal och statistik på hennes
 * senaste videor direkt från källan. Ett användarnamn räcker inte – det finns
 * ingen öppen väg att slå upp någon annans konto, och det ska det inte heller.
 *
 * Fältnamnen nedan är TikToks, samlade här så att de går att rätta på ett
 * ställe om plattformen döper om något.
 */

const AUTHORIZE_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const USER_INFO_URL = 'https://open.tiktokapis.com/v2/user/info/';
const VIDEO_LIST_URL = 'https://open.tiktokapis.com/v2/video/list/';

/**
 * Behörigheterna vi ber om. Varje scope måste vara påslaget för appen i
 * TikToks utvecklarportal, annars kommer koden tillbaka utan de fälten.
 *
 * user.info.basic    open_id och visningsnamn
 * user.info.profile  användarnamnet och om kontot är verifierat
 * user.info.stats    följarantal, antal videor, totalt antal likes
 * video.list         listan över kreatörens videor med visningar och likes
 */
export const TIKTOK_SCOPES = [
  'user.info.basic',
  'user.info.profile',
  'user.info.stats',
  'video.list',
] as const;

/** Så många av de senaste videorna vi räknar snittet på. */
export const VIDEO_SAMPLE_SIZE = 6;

const TIMEOUT_MS = 10_000;

export interface TikTokConfig {
  clientKey: string;
  clientSecret: string;
  /** Måste stämma tecken för tecken med adressen i utvecklarportalen. */
  redirectUri: string;
}

export interface AuthorizationStart {
  url: string;
  /** Sparas av anroparen och skickas tillbaka vid inväxlingen. */
  codeVerifier: string;
}

export interface TikTokTokens {
  accessToken: string;
  refreshToken: string;
  openId: string;
  expiresAt: Date;
}

/** En video som kreatören kan välja att visa upp på sin profil. */
export interface TikTokVideo {
  id: string;
  title: string;
  /** Miniatyrbilden. TikTok ger en adress som slutar gälla efter ett tag. */
  coverImageUrl: string | null;
  /** Permalänken till inlägget. */
  shareUrl: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  /** Sekunder sedan epoch, som TikTok anger det. */
  createdAt: number;
}

/** Statistiken vi räknar fram ur videolistan. */
export interface VideoStats {
  /** Antal videor snittet bygger på. Färre än VIDEO_SAMPLE_SIZE för nya konton. */
  sampleSize: number;
  avgViews: number;
  /** (likes + kommentarer + delningar) / visningar, som andel. */
  engagementRate: number;
}

export class TikTokError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'TikTokError';
  }
}

export class TikTokClient {
  constructor(private readonly config: TikTokConfig) {}

  /**
   * Adressen kreatören skickas till. PKCE gör att den kod som kommer tillbaka
   * bara går att lösa in av den som startade inloggningen.
   */
  authorizationUrl(state: string): AuthorizationStart {
    const codeVerifier = randomBytes(48).toString('hex');
    const challenge = createHash('sha256').update(codeVerifier).digest('base64url');

    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set('client_key', this.config.clientKey);
    url.searchParams.set('scope', TIKTOK_SCOPES.join(','));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');

    return { url: url.toString(), codeVerifier };
  }

  async exchangeCode(code: string, codeVerifier: string): Promise<TikTokTokens> {
    return this.token({
      client_key: this.config.clientKey,
      client_secret: this.config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.config.redirectUri,
      code_verifier: codeVerifier,
    });
  }

  async refreshTokens(refreshToken: string): Promise<TikTokTokens> {
    return this.token({
      client_key: this.config.clientKey,
      client_secret: this.config.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
  }

  /** Kontouppgifterna: användarnamn, följarantal, om kontot är verifierat. */
  async userInfo(accessToken: string): Promise<{
    openId: string;
    username: string;
    displayName: string;
    followers: number;
    videoCount: number;
    verified: boolean;
  }> {
    const url = new URL(USER_INFO_URL);
    url.searchParams.set(
      'fields',
      'open_id,union_id,display_name,username,follower_count,following_count,likes_count,video_count,is_verified',
    );

    const body = await this.request(url.toString(), {
      method: 'GET',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const user = (body.data as Record<string, unknown> | undefined)?.user as
      | Record<string, unknown>
      | undefined;
    if (!user) throw new TikTokError('TikTok svarade utan kontouppgifter.', 'missing_user');

    return {
      openId: text(user.open_id),
      username: text(user.username),
      displayName: text(user.display_name),
      followers: count(user.follower_count),
      videoCount: count(user.video_count),
      verified: user.is_verified === true,
    };
  }

  /**
   * Kreatörens senaste videor, med miniatyr och permalänk.
   *
   * Används när hon ska välja vilka som ska synas på profilen. Miniatyren
   * kommer med i svaret, så vi slipper slå upp varje inlägg för sig.
   */
  async recentVideos(accessToken: string, limit = 20): Promise<TikTokVideo[]> {
    const body = await this.request(videoListUrl(), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ max_count: Math.max(1, Math.min(20, limit)) }),
    });

    const videos = ((body.data as Record<string, unknown> | undefined)?.videos ?? []) as Array<
      Record<string, unknown>
    >;
    return videos
      .map((video) => ({
        id: text(video.id),
        title: text(video.title),
        coverImageUrl: https(video.cover_image_url),
        shareUrl: https(video.share_url),
        views: count(video.view_count),
        likes: count(video.like_count),
        comments: count(video.comment_count),
        shares: count(video.share_count),
        createdAt: count(video.create_time),
      }))
      .filter((video) => video.id !== '')
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Snittvisningar och engagemang på de senaste videorna.
   *
   * Engagemanget räknas mot visningar, inte mot följare: det är det måttet som
   * säger något om hur innehållet faktiskt tas emot, och det som inte går att
   * lyfta genom att köpa följare.
   */
  async recentVideoStats(accessToken: string, sampleSize = VIDEO_SAMPLE_SIZE): Promise<VideoStats> {
    const body = await this.request(videoListUrl(), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ max_count: Math.max(1, Math.min(20, sampleSize)) }),
    });

    const videos = ((body.data as Record<string, unknown> | undefined)?.videos ?? []) as Array<
      Record<string, unknown>
    >;
    return summariseVideos(videos, sampleSize);
  }

  /** Allt appen behöver om ett konto, i ett anrop utåt. */
  async statsFor(tokens: TikTokTokens): Promise<SocialStats> {
    const [user, videos] = await Promise.all([
      this.userInfo(tokens.accessToken),
      // En kreatör utan publicerade videor är inget fel – då blir snittet noll.
      this.recentVideoStats(tokens.accessToken).catch(() => emptyVideoStats()),
    ]);

    return {
      externalId: user.openId,
      handle: user.username || user.displayName,
      followers: user.followers,
      avgViews: videos.avgViews,
      engagementRate: videos.engagementRate,
      verified: user.verified,
      source: 'PLATFORM',
      sampleSize: videos.sampleSize,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt,
    };
  }

  private async token(params: Record<string, string>): Promise<TikTokTokens> {
    const body = await this.request(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });

    const accessToken = text(body.access_token);
    if (!accessToken) {
      throw new TikTokError('TikTok lämnade ingen åtkomsttoken.', 'missing_token');
    }
    return {
      accessToken,
      refreshToken: text(body.refresh_token),
      openId: text(body.open_id),
      expiresAt: new Date(Date.now() + count(body.expires_in) * 1000),
    };
  }

  /**
   * TikTok svarar 200 även på fel; felet ligger i `error.code`, som är
   * strängen "ok" när allt gick bra.
   */
  private async request(url: string, init: RequestInit): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, { ...init, signal: controller.signal });
    } catch (caught) {
      throw new TikTokError(
        caught instanceof Error && caught.name === 'AbortError'
          ? 'TikTok svarade inte i tid.'
          : 'Kunde inte nå TikTok.',
        'network',
      );
    } finally {
      clearTimeout(timer);
    }

    let body: Record<string, unknown>;
    try {
      body = (await response.json()) as Record<string, unknown>;
    } catch {
      throw new TikTokError('TikTok svarade med något vi inte kunde läsa.', 'bad_response');
    }

    const error = body.error;
    if (typeof error === 'string' && error !== '') {
      // Tokenslutpunkten svarar med error som sträng, inte objekt.
      throw new TikTokError(text(body.error_description) || 'TikTok nekade begäran.', error);
    }
    if (error && typeof error === 'object') {
      const record = error as Record<string, unknown>;
      const code = text(record.code);
      if (code && code !== 'ok') {
        throw new TikTokError(text(record.message) || 'TikTok nekade begäran.', code);
      }
    }
    if (!response.ok) {
      throw new TikTokError('TikTok nekade begäran.', `http_${response.status}`);
    }
    return body;
  }
}

/** Räknar snitt över de nyaste videorna. Exporterad för att kunna testas. */
export function summariseVideos(
  videos: Array<Record<string, unknown>>,
  sampleSize = VIDEO_SAMPLE_SIZE,
): VideoStats {
  const newestFirst = [...videos].sort((a, b) => count(b.create_time) - count(a.create_time));
  const sample = newestFirst.slice(0, sampleSize);
  if (sample.length === 0) return emptyVideoStats();

  let views = 0;
  let interactions = 0;
  for (const video of sample) {
    views += count(video.view_count);
    interactions +=
      count(video.like_count) + count(video.comment_count) + count(video.share_count);
  }

  return {
    sampleSize: sample.length,
    avgViews: Math.round(views / sample.length),
    // Utan visningar finns inget att sätta engagemanget i förhållande till.
    engagementRate: views > 0 ? Number((interactions / views).toFixed(4)) : 0,
  };
}

function emptyVideoStats(): VideoStats {
  return { sampleSize: 0, avgViews: 0, engagementRate: 0 };
}

/** Fälten vi ber om ur videolistan. Samma uppsättning för båda anropen. */
function videoListUrl(): string {
  const url = new URL(VIDEO_LIST_URL);
  url.searchParams.set(
    'fields',
    'id,create_time,title,cover_image_url,share_url,view_count,like_count,comment_count,share_count',
  );
  return url.toString();
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Adresser som inte går över https ritas ändå inte av appen. */
function https(value: unknown): string | null {
  const url = text(value);
  return url.startsWith('https://') ? url : null;
}

/** TikTok skickar ibland tal som strängar. */
function count(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : 0;
  }
  return 0;
}
