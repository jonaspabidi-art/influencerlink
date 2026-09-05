/**
 * Igenkänning av länkar till sociala inlägg.
 *
 * Kreatören klistrar in en adress hon kopierat i TikTok- eller YouTube-appen.
 * De adresserna kommer i flera former – delningslänkar, korta länkar, med och
 * utan spårningsparametrar – och alla ska landa i samma sak: vilken plattform
 * det är och en ren adress att slå upp och länka vidare till.
 */

import type { Platform } from './domain.js';

export interface RecognisedLink {
  platform: Platform;
  /** Adressen utan spårningsparametrar. Det är den vi sparar och slår upp. */
  url: string;
  /** Inläggets id när det går att läsa ur adressen. Kortlänkar saknar det. */
  postId: string | null;
  /** Kontonamnet när adressen innehåller det, t.ex. TikToks @-form. */
  handle: string | null;
}

/** Adresser hos de här värdarna går att slå upp utan API-nyckel. */
const OEMBED_PLATFORMS: Platform[] = ['TIKTOK', 'YOUTUBE'];

/**
 * Går inlägget att hämta miniatyrbild för utan att appen är godkänd?
 * Instagram stängde sin öppna oEmbed 2020 och kräver apptoken.
 */
export function supportsOembed(platform: Platform): boolean {
  return OEMBED_PLATFORMS.includes(platform);
}

/** Parametrar som bara är spårning och som aldrig ska sparas. */
const TRACKING_PARAMS = [
  'is_from_webapp',
  'sender_device',
  'sender_web_id',
  'web_id',
  'refer',
  'referer',
  'igsh',
  'igshid',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'si',
  'feature',
  'pp',
];

/**
 * Läser en klistrad adress. Returnerar null när den inte pekar på ett inlägg
 * hos någon plattform vi känner igen – då ska användaren få veta det direkt
 * i stället för att en trasig länk sparas.
 */
export function recogniseLink(input: string): RecognisedLink | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  let url: URL;
  try {
    url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  for (const param of TRACKING_PARAMS) url.searchParams.delete(param);

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);

  // --- TikTok ---------------------------------------------------------------
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
    // https://www.tiktok.com/@handle/video/123
    const videoAt = parts.indexOf('video');
    if (videoAt > 0 && parts[videoAt + 1]) {
      const handle = parts[0]?.startsWith('@') ? parts[0].slice(1) : null;
      return { platform: 'TIKTOK', url: clean(url), postId: parts[videoAt + 1] ?? null, handle };
    }
    // Kortlänkar: vm.tiktok.com/XXXX och tiktok.com/t/XXXX. Id:t syns först
    // efter en omdirigering, så vi sparar adressen som den är.
    if (host.startsWith('vm.') || host.startsWith('vt.') || parts[0] === 't') {
      return { platform: 'TIKTOK', url: clean(url), postId: null, handle: null };
    }
    return null;
  }

  // --- YouTube --------------------------------------------------------------
  if (host === 'youtu.be') {
    const id = parts[0];
    return id ? { platform: 'YOUTUBE', url: clean(url), postId: id, handle: null } : null;
  }
  if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
    const fromQuery = url.searchParams.get('v');
    if (fromQuery) return { platform: 'YOUTUBE', url: clean(url), postId: fromQuery, handle: null };
    // /shorts/ID och /live/ID
    if ((parts[0] === 'shorts' || parts[0] === 'live') && parts[1]) {
      return { platform: 'YOUTUBE', url: clean(url), postId: parts[1], handle: null };
    }
    return null;
  }

  // --- Instagram ------------------------------------------------------------
  if (host === 'instagram.com' || host.endsWith('.instagram.com')) {
    // /p/KOD, /reel/KOD och /tv/KOD
    if ((parts[0] === 'p' || parts[0] === 'reel' || parts[0] === 'tv') && parts[1]) {
      return { platform: 'INSTAGRAM', url: clean(url), postId: parts[1], handle: null };
    }
    return null;
  }

  return null;
}

/** Adressen utan tomt frågetecken och utan avslutande snedstreck. */
function clean(url: URL): string {
  const query = url.searchParams.toString();
  const path = url.pathname.replace(/\/$/, '');
  return `${url.origin}${path}${query ? `?${query}` : ''}`;
}
