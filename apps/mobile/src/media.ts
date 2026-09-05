import { API_BASE_URL } from './api';

/**
 * Gör en sparad bildadress visningsbar.
 *
 * Bilder vi lagrar själva sparas som `/media/<id>` – relativt, så att samma rad
 * fungerar mot utvecklings-API:et, demoläget och driften. Här sätts rätt värd
 * på innan bilden ritas. Andra adresser (miniatyrer från TikTok, data-URL:er i
 * demoläget) lämnas som de är.
 */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!url.startsWith('/')) return url;
  return API_BASE_URL ? `${API_BASE_URL}${url}` : url;
}
