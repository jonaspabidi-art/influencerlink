import type { Config } from '../config.js';

/**
 * Fillagring för videoutkast.
 *
 * Bilder ligger i databasen – de är små och slipper då en extra tjänst. En
 * film gör inte det: trettio sekunder i 1080p är tiotals megabyte, och flera
 * hundra i 4K. De ligger därför i Supabase Storage.
 *
 * Filen passerar aldrig vår server. Appen får en signerad adress och laddar
 * upp direkt, och uppspelning sker mot en signerad adress som slutar gälla.
 * Det håller både minnet och trafiken borta från Railway, och gör att en
 * filmfil aldrig behöver ligga i en HTTP-kropp vi tar emot.
 */

/** Hur länge en uppspelningsadress gäller. Lång nog att se klart, kort nog att inte spridas. */
const PLAYBACK_TTL_SECONDS = 60 * 60;

/** Hur länge en uppladdningsadress gäller. */
const UPLOAD_TTL_SECONDS = 30 * 60;

export interface UploadTarget {
  /** Adressen appen laddar upp till med PUT. */
  url: string;
  /** Sökvägen i hinken. Sparas på raden så att filen går att hitta igen. */
  path: string;
}

export interface StorageProvider {
  createUploadTarget(path: string, contentType: string): Promise<UploadTarget>;
  createPlaybackUrl(path: string): Promise<string>;
  remove(path: string): Promise<void>;
}

export class StorageError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

const TIMEOUT_MS = 10_000;

export class SupabaseStorageProvider implements StorageProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly serviceKey: string,
    private readonly bucket: string,
  ) {}

  async createUploadTarget(path: string, contentType: string): Promise<UploadTarget> {
    const body = await this.request(
      `/storage/v1/object/upload/sign/${this.bucket}/${encodePath(path)}`,
      { method: 'POST', body: JSON.stringify({ expiresIn: UPLOAD_TTL_SECONDS, contentType }) },
    );

    // Supabase svarar med en relativ adress som redan innehåller token.
    const signed = typeof body.url === 'string' ? body.url : '';
    if (!signed) throw new StorageError('Lagringen gav ingen adress att ladda upp till.', 'no_url');
    return { url: new URL(signed, this.baseUrl).toString(), path };
  }

  async createPlaybackUrl(path: string): Promise<string> {
    const body = await this.request(`/storage/v1/object/sign/${this.bucket}/${encodePath(path)}`, {
      method: 'POST',
      body: JSON.stringify({ expiresIn: PLAYBACK_TTL_SECONDS }),
    });

    const signed = typeof body.signedURL === 'string' ? body.signedURL : '';
    if (!signed) throw new StorageError('Lagringen gav ingen adress att spela upp från.', 'no_url');
    return new URL(signed, this.baseUrl).toString();
  }

  async remove(path: string): Promise<void> {
    await this.request(`/storage/v1/object/${this.bucket}/${encodePath(path)}`, {
      method: 'DELETE',
    });
  }

  private async request(path: string, init: RequestInit): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(new URL(path, this.baseUrl), {
        ...init,
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${this.serviceKey}`,
          'content-type': 'application/json',
        },
      });
    } catch {
      throw new StorageError('Kunde inte nå fillagringen.', 'network');
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      // Hinken som inte finns är det vanligaste felet vid uppsättningen.
      throw new StorageError(
        response.status === 404
          ? 'Hinken för videoutkast finns inte i Supabase.'
          : 'Fillagringen nekade begäran.',
        `http_${response.status}`,
      );
    }

    try {
      return (await response.json()) as Record<string, unknown>;
    } catch {
      // DELETE svarar utan kropp.
      return {};
    }
  }
}

/**
 * Lagringen, eller null när den inte är konfigurerad.
 *
 * Utan nycklar är utkastuppladdningen avstängd och slutpunkten förklarar det,
 * på samma sätt som TikTok-inloggningen. Resten av appen fungerar.
 */
export function createStorageProvider(config: Config): StorageProvider | null {
  if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) return null;
  return new SupabaseStorageProvider(
    config.SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY,
    config.SUPABASE_VIDEO_BUCKET,
  );
}

/** Varje segment kodas för sig, så att snedstrecken i sökvägen står kvar. */
function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}
