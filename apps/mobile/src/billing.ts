import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

/**
 * Får abonnemanget köpas direkt i appen?
 *
 * Apple tar en del av digitala abonnemang som säljs i en iPhone-app och kan
 * neka appen om köpet går förbi deras betalsystem. Om barterabonnemanget
 * räknas som digitalt är inte avgjort. Tills det är det visar iPhone-appen
 * nivån och hänvisar till webben, medan webben och Android säljer som vanligt.
 *
 * Att ändra det här är en rad – bygget är detsamma, bara knappen skiljer.
 */
export const CAN_PURCHASE_IN_APP = Platform.OS !== 'ios';

/**
 * Öppnar Stripes sida – betalsidan eller kundportalen.
 *
 * På webben byter fliken sida och kommer tillbaka via adressen. I appen
 * öppnas en webbläsare ovanpå, och när den stängs läser skärmen om läget.
 */
export async function openBillingPage(url: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.location?.assign(url);
    return;
  }
  await WebBrowser.openBrowserAsync(url);
}
