import { supportsOembed, type Platform, type RecognisedLink } from '@pacta/shared';

/**
 * Slår upp ett inlägg hos plattformens oEmbed-slutpunkt.
 *
 * TikTok och YouTube svarar utan nyckel och utan att appen behöver vara
 * godkänd, vilket gör att kreatörer kan visa upp sitt innehåll långt innan
 * OAuth-integrationen finns. Instagram stängde sin öppna slutpunkt 2020 och
 * kräver apptoken, så därifrån sparas bara länken.
 */
export interface OembedResult {
  title: string;
  authorName: string;
  thumbnailUrl: string | null;
  thumbnailWidth: number | null;
  thumbnailHeight: number | null;
}

export interface OembedProvider {
  lookup(link: RecognisedLink): Promise<OembedResult>;
}

const ENDPOINTS: Partial<Record<Platform, string>> = {
  TIKTOK: 'https://www.tiktok.com/oembed',
  YOUTUBE: 'https://www.youtube.com/oembed',
};

/** Plattformarna svarar långsamt ibland, och en profilsida ska inte hänga sig. */
const TIMEOUT_MS = 6000;

export class HttpOembedProvider implements OembedProvider {
  async lookup(link: RecognisedLink): Promise<OembedResult> {
    const endpoint = ENDPOINTS[link.platform];
    if (!endpoint || !supportsOembed(link.platform)) return empty();

    const url = new URL(endpoint);
    url.searchParams.set('url', link.url);
    url.searchParams.set('format', 'json');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { accept: 'application/json' },
      });
      // Ett borttaget eller privat inlägg svarar 404. Länken sparas ändå, men
      // utan bild – kreatören ser då själv att något är fel med den.
      if (!response.ok) return empty();
      return parse(await response.json());
    } catch {
      return empty();
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Svarens fältnamn följer oEmbed-standarden hos båda plattformarna. */
function parse(body: unknown): OembedResult {
  const data = (body ?? {}) as Record<string, unknown>;
  const asText = (value: unknown) => (typeof value === 'string' ? value : '');
  const asNumber = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null;

  const thumbnail = asText(data.thumbnail_url);
  return {
    title: asText(data.title).slice(0, 300),
    authorName: asText(data.author_name).slice(0, 120),
    thumbnailUrl: thumbnail.startsWith('https://') ? thumbnail : null,
    thumbnailWidth: asNumber(data.thumbnail_width),
    thumbnailHeight: asNumber(data.thumbnail_height),
  };
}

function empty(): OembedResult {
  return { title: '', authorName: '', thumbnailUrl: null, thumbnailWidth: null, thumbnailHeight: null };
}

/** Fast svar för tester och demoläge, utan att röra nätet. */
export class StubOembedProvider implements OembedProvider {
  constructor(private readonly result: Partial<OembedResult> = {}) {}

  async lookup(link: RecognisedLink): Promise<OembedResult> {
    if (!supportsOembed(link.platform)) return empty();
    return {
      ...empty(),
      title: `Inlägg på ${link.platform.toLowerCase()}`,
      authorName: link.handle ?? '',
      ...this.result,
    };
  }
}
