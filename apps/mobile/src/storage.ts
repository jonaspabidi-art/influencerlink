import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Sessionstoken lagras i enhetens nyckelring på iOS och Android.
 * expo-secure-store finns inte på webben, så där används localStorage –
 * mindre skyddat, men webbversionen är i första hand till för förhandsvisning
 * och demo. Alla anrop är tysta vid fel så att appen aldrig fastnar på att
 * lagringen är otillgänglig (privat läge, blockerade cookies).
 */

const isWeb = Platform.OS === 'web';

export async function getItem(key: string): Promise<string | null> {
  try {
    if (isWeb) return globalThis.localStorage?.getItem(key) ?? null;
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  try {
    if (isWeb) globalThis.localStorage?.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // Utan lagring får användaren logga in igen nästa gång – inte värt att krascha på.
  }
}

export async function removeItem(key: string): Promise<void> {
  try {
    if (isWeb) globalThis.localStorage?.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  } catch {
    // Se ovan.
  }
}
