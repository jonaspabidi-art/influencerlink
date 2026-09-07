import { Platform } from 'react-native';

/**
 * Tar bort startskärmen som ligger i HTML-dokumentet.
 *
 * Den ritas innan appens kod ens har laddats, och ska ligga kvar tills första
 * skärmen faktiskt är ritad – annars blinkar det till mellan de två. Anropas
 * därför när typsnitten är klara, inte när komponenten monteras.
 *
 * Bara webben har en sådan startskärm; på telefonen sköter systemet det.
 */
export function hideHtmlSplash(): void {
  if (Platform.OS !== 'web') return;
  const node = globalThis.document?.getElementById('pacta-splash');
  if (!node) return;

  node.classList.add('pacta-splash-done');
  // Tas bort helt när uttoningen är klar, så den inte fångar tryck.
  globalThis.setTimeout(() => node.remove(), 300);
}
