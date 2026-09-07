import { dehydrate, hydrate, type DehydratedState, type QueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';

/**
 * Sparar hämtad data mellan omstarter.
 *
 * React Query håller allt i minnet, vilket räcker så länge appen är öppen. Men
 * webbversionen startar om vid varje omladdning, och då börjar varje skärm på
 * noll igen – det är det som känns som att appen "laddar hela tiden".
 *
 * Bara webben sparar. På telefonen ligger lagringen i nyckelringen, som är till
 * för hemligheter och har en storleksgräns långt under en full cache; där lever
 * appen dessutom kvar i bakgrunden och behöver det inte.
 */
const KEY = 'pacta.query';

/** Äldre än så här kastas bort: hellre en hämtning än siffror från i går. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Hur ofta det sparade läget skrivs om, så vi inte skriver vid varje tangent. */
const WRITE_DEBOUNCE_MS = 1000;

const isWeb = Platform.OS === 'web';

/**
 * Data som aldrig ska ligga kvar på disk.
 *
 * Uppladdningsadresser och uppspelningslänkar är signerade och kortlivade, och
 * ett gammalt svar därifrån är i bästa fall trasigt.
 */
const SKIP = ['upload-url', 'playback'];

export function restoreQueryCache(client: QueryClient): void {
  if (!isWeb) return;
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as { savedAt: number; state: DehydratedState };
    if (!saved.savedAt || Date.now() - saved.savedAt > MAX_AGE_MS) {
      globalThis.localStorage?.removeItem(KEY);
      return;
    }
    hydrate(client, saved.state);
  } catch {
    // Ett trasigt sparat läge ska aldrig hindra appen från att starta.
    try {
      globalThis.localStorage?.removeItem(KEY);
    } catch {
      // Lagringen är otillgänglig. Appen fungerar ändå, den hämtar bara om.
    }
  }
}

export function persistQueryCache(client: QueryClient): () => void {
  if (!isWeb) return () => {};

  let timer: ReturnType<typeof setTimeout> | undefined;
  const write = () => {
    try {
      const state = dehydrate(client, {
        shouldDehydrateQuery: (query) =>
          query.state.status === 'success' &&
          !SKIP.some((part) => JSON.stringify(query.queryKey).includes(part)),
      });
      globalThis.localStorage?.setItem(KEY, JSON.stringify({ savedAt: Date.now(), state }));
    } catch {
      // Full disk eller privat läge: appen fungerar, den minns bara inte.
    }
  };

  const unsubscribe = client.getQueryCache().subscribe(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(write, WRITE_DEBOUNCE_MS);
  });

  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
  };
}

/** Vid utloggning: nästa användare ska inte se den förras data. */
export function clearQueryCache(): void {
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    // Se ovan.
  }
}
