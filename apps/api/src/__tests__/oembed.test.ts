import { recogniseLink } from '@pacta/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpOembedProvider, StubOembedProvider } from '../services/oembed.js';

/** recogniseLink är testad för sig – här litar vi på den och matar in svaret. */
function link(url: string) {
  const recognised = recogniseLink(url);
  if (!recognised) throw new Error(`Länken kändes inte igen: ${url}`);
  return recognised;
}

const TIKTOK = 'https://www.tiktok.com/@annaater/video/7300000000000000001';

function mockFetch(response: unknown, ok = true) {
  const fetchMock = vi.fn(async () => ({
    ok,
    json: async () => response,
  })) as unknown as typeof fetch;
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock as unknown as ReturnType<typeof vi.fn>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HttpOembedProvider', () => {
  it('läser titel, kontonamn och miniatyr ur svaret', async () => {
    mockFetch({
      title: 'Dagens lunch',
      author_name: 'annaater',
      thumbnail_url: 'https://p16.tiktokcdn.com/bild.jpeg',
      thumbnail_width: 720,
      thumbnail_height: 1280,
    });

    const result = await new HttpOembedProvider().lookup(link(TIKTOK));

    expect(result).toEqual({
      title: 'Dagens lunch',
      authorName: 'annaater',
      thumbnailUrl: 'https://p16.tiktokcdn.com/bild.jpeg',
      thumbnailWidth: 720,
      thumbnailHeight: 1280,
    });
  });

  it('frågar plattformen om den rena adressen', async () => {
    const fetchMock = mockFetch({});
    await new HttpOembedProvider().lookup(
      link(`${TIKTOK}?is_from_webapp=1&sender_device=pc`),
    );
    const requested = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requested.origin + requested.pathname).toBe('https://www.tiktok.com/oembed');
    expect(requested.searchParams.get('url')).toBe(TIKTOK);
  });

  // Ett borttaget inlägg svarar 404. Länken ska ändå gå att spara.
  it('ger tomt resultat när inlägget inte finns', async () => {
    mockFetch({}, false);
    const result = await new HttpOembedProvider().lookup(link(TIKTOK));
    expect(result.thumbnailUrl).toBeNull();
    expect(result.title).toBe('');
  });

  it('ger tomt resultat när nätverket fallerar', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ENOTFOUND');
      }),
    );
    const result = await new HttpOembedProvider().lookup(link(TIKTOK));
    expect(result.thumbnailUrl).toBeNull();
  });

  // En miniatyr över osäker anslutning blockeras ändå av appen.
  it('kastar miniatyrer som inte går över https', async () => {
    mockFetch({ thumbnail_url: 'http://p16.tiktokcdn.com/bild.jpeg' });
    const result = await new HttpOembedProvider().lookup(link(TIKTOK));
    expect(result.thumbnailUrl).toBeNull();
  });

  it('rör inte nätet för Instagram, som kräver apptoken', async () => {
    const fetchMock = mockFetch({ title: 'ska aldrig hämtas' });
    const result = await new HttpOembedProvider().lookup(
      link('https://www.instagram.com/reel/CxYz123/'),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.title).toBe('');
  });
});

describe('StubOembedProvider', () => {
  it('svarar utan att röra nätet', async () => {
    const result = await new StubOembedProvider().lookup(link(TIKTOK));
    expect(result.title).toBe('Inlägg på tiktok');
    expect(result.authorName).toBe('annaater');
  });
});
