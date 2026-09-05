import { afterEach, describe, expect, it, vi } from 'vitest';
import { signState, verifyState } from '../lib/oauthstate.js';
import { TikTokClient, TikTokError, summariseVideos } from '../services/social/tiktok.js';

const config = {
  clientKey: 'test-key',
  clientSecret: 'test-secret',
  redirectUri: 'https://pacta.se/auth/tiktok/callback',
};

function mockFetch(...responses: Array<{ body: unknown; ok?: boolean }>) {
  const fetchMock = vi.fn(async () => {
    const next = responses.shift() ?? { body: {} };
    return { ok: next.ok ?? true, status: 200, json: async () => next.body };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('authorizationUrl', () => {
  it('ber om de behörigheter statistiken kräver', () => {
    const { url } = new TikTokClient(config).authorizationUrl('state-123');
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://www.tiktok.com/v2/auth/authorize/');
    expect(parsed.searchParams.get('scope')).toBe(
      'user.info.basic,user.info.profile,user.info.stats,video.list',
    );
    expect(parsed.searchParams.get('client_key')).toBe('test-key');
    expect(parsed.searchParams.get('redirect_uri')).toBe(config.redirectUri);
    expect(parsed.searchParams.get('state')).toBe('state-123');
  });

  // Utan PKCE kan en avlyssnad kod lösas in av någon annan.
  it('skickar en kodutmaning och behåller verifieraren', () => {
    const { url, codeVerifier } = new TikTokClient(config).authorizationUrl('s');
    const parsed = new URL(url);
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    expect(parsed.searchParams.get('code_challenge')).toBeTruthy();
    expect(parsed.searchParams.get('code_challenge')).not.toBe(codeVerifier);
    expect(codeVerifier.length).toBeGreaterThan(40);
  });

  it('ger en ny verifierare varje gång', () => {
    const client = new TikTokClient(config);
    expect(client.authorizationUrl('s').codeVerifier).not.toBe(
      client.authorizationUrl('s').codeVerifier,
    );
  });
});

describe('exchangeCode', () => {
  it('växlar in koden och räknar ut när tokenen går ut', async () => {
    mockFetch({
      body: {
        access_token: 'act',
        refresh_token: 'rft',
        open_id: 'open-1',
        expires_in: 86_400,
      },
    });
    const before = Date.now();
    const tokens = await new TikTokClient(config).exchangeCode('code', 'verifier');
    expect(tokens.accessToken).toBe('act');
    expect(tokens.refreshToken).toBe('rft');
    expect(tokens.openId).toBe('open-1');
    expect(tokens.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 86_400_000);
  });

  it('kastar när TikTok nekar', async () => {
    mockFetch({ body: { error: 'invalid_grant', error_description: 'Koden är förbrukad.' } });
    await expect(new TikTokClient(config).exchangeCode('code', 'v')).rejects.toThrow(TikTokError);
  });
});

describe('statsFor', () => {
  it('hämtar följare från kontot och visningar från videorna', async () => {
    mockFetch(
      {
        body: {
          data: {
            user: {
              open_id: 'open-1',
              username: 'annaater',
              display_name: 'annaäter',
              follower_count: 48_000,
              video_count: 210,
              is_verified: false,
            },
          },
          error: { code: 'ok' },
        },
      },
      {
        body: {
          data: {
            videos: [
              { id: '1', create_time: 300, view_count: 40_000, like_count: 3_000, comment_count: 120, share_count: 80 },
              { id: '2', create_time: 200, view_count: 20_000, like_count: 1_000, comment_count: 40, share_count: 20 },
            ],
          },
          error: { code: 'ok' },
        },
      },
    );

    const stats = await new TikTokClient(config).statsFor({
      accessToken: 'act',
      refreshToken: 'rft',
      openId: 'open-1',
      expiresAt: new Date(),
    });

    expect(stats.followers).toBe(48_000);
    expect(stats.handle).toBe('annaater');
    expect(stats.avgViews).toBe(30_000);
    expect(stats.source).toBe('PLATFORM');
    expect(stats.sampleSize).toBe(2);
  });

  // En kreatör som inte publicerat något ska ändå kunna koppla kontot.
  it('ger noll i snitt när videolistan inte går att hämta', async () => {
    mockFetch(
      {
        body: {
          data: { user: { open_id: 'o', username: 'ny', follower_count: 12, is_verified: false } },
          error: { code: 'ok' },
        },
      },
      { body: { error: { code: 'scope_not_authorized', message: 'video.list saknas' } } },
    );

    const stats = await new TikTokClient(config).statsFor({
      accessToken: 'act',
      refreshToken: 'rft',
      openId: 'o',
      expiresAt: new Date(),
    });
    expect(stats.avgViews).toBe(0);
    expect(stats.sampleSize).toBe(0);
    expect(stats.followers).toBe(12);
  });

  // TikTok svarar 200 även på fel; felet ligger i error.code.
  it('kastar på fel som kommer med statuskod 200', async () => {
    mockFetch({ body: { error: { code: 'access_token_invalid', message: 'Tokenen gäller inte.' } } });
    await expect(new TikTokClient(config).userInfo('act')).rejects.toThrow('Tokenen gäller inte.');
  });
});

describe('summariseVideos', () => {
  it('räknar på de nyaste videorna, inte de som råkar komma först', () => {
    const videos = [
      { create_time: 100, view_count: 1_000, like_count: 10, comment_count: 0, share_count: 0 },
      { create_time: 900, view_count: 9_000, like_count: 90, comment_count: 0, share_count: 0 },
      { create_time: 500, view_count: 5_000, like_count: 50, comment_count: 0, share_count: 0 },
    ];
    expect(summariseVideos(videos, 2).avgViews).toBe(7_000);
    expect(summariseVideos(videos, 2).sampleSize).toBe(2);
  });

  it('räknar engagemang mot visningar, inte mot följare', () => {
    const stats = summariseVideos([
      { create_time: 1, view_count: 10_000, like_count: 400, comment_count: 50, share_count: 50 },
    ]);
    expect(stats.engagementRate).toBe(0.05);
  });

  it('ger noll utan videor', () => {
    expect(summariseVideos([])).toEqual({ sampleSize: 0, avgViews: 0, engagementRate: 0 });
  });

  // Ett konto med nya videor som ingen sett får inte ge division med noll.
  it('ger noll i engagemang när ingen sett videorna', () => {
    const stats = summariseVideos([
      { create_time: 1, view_count: 0, like_count: 0, comment_count: 0, share_count: 0 },
    ]);
    expect(stats.engagementRate).toBe(0);
  });

  it('läser tal som kommer som strängar', () => {
    const stats = summariseVideos([
      { create_time: '1', view_count: '2000', like_count: '100', comment_count: '0', share_count: '0' },
    ]);
    expect(stats.avgViews).toBe(2_000);
    expect(stats.engagementRate).toBe(0.05);
  });
});

describe('OAuth-state', () => {
  const secret = 'test-secret-som-ar-minst-32-tecken-langt';
  const state = {
    purpose: 'tiktok',
    userId: 'usr_1',
    influencerId: 'inf_1',
    codeVerifier: 'verifier',
  };

  it('går att läsa tillbaka', () => {
    expect(verifyState(signState(state, secret), secret)).toEqual(state);
  });

  it('avvisar ett ändrat state', () => {
    const token = signState(state, secret);
    const [payload, signature] = token.split('.');
    const tampered = Buffer.from(
      JSON.stringify({ ...state, influencerId: 'inf_2', exp: Date.now() + 60_000 }),
    ).toString('base64url');
    expect(verifyState(`${tampered}.${signature}`, secret)).toBeNull();
    expect(verifyState(`${payload}.${signature?.slice(0, -2)}xx`, secret)).toBeNull();
  });

  it('avvisar ett state signerat med en annan nyckel', () => {
    const token = signState(state, 'en-helt-annan-nyckel-minst-32-tecken-lang');
    expect(verifyState(token, secret)).toBeNull();
  });

  it('avvisar ett state som gått ut', () => {
    const token = signState(state, secret, Date.now() - 20 * 60 * 1000);
    expect(verifyState(token, secret)).toBeNull();
  });

  it('avvisar skräp', () => {
    expect(verifyState('', secret)).toBeNull();
    expect(verifyState('bara-en-del', secret)).toBeNull();
  });
});
