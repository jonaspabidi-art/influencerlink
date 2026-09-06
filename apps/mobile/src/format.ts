import type { Category, ContractStatus, DeliverableKind, Platform } from '@pacta/shared';
import type { StatusTone } from './components/ui';

export { formatSek, kronorToOre, oreToKronor } from '@pacta/shared';

/** Följarantal kort: 48 000 → "48 tn". */
export function formatFollowers(followers: number): string {
  if (followers >= 1_000_000) return `${(followers / 1_000_000).toFixed(1).replace('.', ',')} mn`;
  if (followers >= 1_000) return `${Math.round(followers / 1_000)} tn`;
  return String(followers);
}

export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1).replace('.', ',')} %`;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' }).format(new Date(iso));
}

export const CATEGORY_LABELS: Record<Category, string> = {
  RESTAURANG: 'Restaurang',
  CAFE: 'Kafé',
  BAR: 'Bar',
  STREET_FOOD: 'Street food',
  FINE_DINING: 'Fine dining',
  BAGERI: 'Bageri',
  VEGETARISKT: 'Vegetariskt',
  MAT_OCH_DRYCK: 'Mat & dryck',
  LIVSSTIL: 'Livsstil',
  RESA: 'Resa',
  FAMILJ: 'Familj',
  TRANING: 'Träning',
  NOJE: 'Nöje',
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  TIKTOK: 'TikTok',
  INSTAGRAM: 'Instagram',
  YOUTUBE: 'YouTube',
};

export const DELIVERABLE_LABELS: Record<DeliverableKind, string> = {
  TIKTOK_VIDEO: 'TikTok-video',
  INSTAGRAM_REEL: 'Instagram Reel',
  INSTAGRAM_POST: 'Instagram-inlägg',
  INSTAGRAM_STORY: 'Instagram-story',
  YOUTUBE_SHORT: 'YouTube Short',
  YOUTUBE_VIDEO: 'YouTube-video',
};

/** "PRODUCT" → hur ersättningen ska beskrivas på kortet. */
export function describeCompensation(
  type: 'FIXED' | 'PRODUCT' | 'HYBRID',
  budget: number,
  productValue: number,
  formatMoney: (ore: number) => string,
): string {
  switch (type) {
    case 'FIXED':
      return formatMoney(budget);
    case 'PRODUCT':
      return `Bjuds på besök (värde ${formatMoney(productValue)})`;
    case 'HYBRID':
      return `${formatMoney(budget)} + besök (${formatMoney(productValue)})`;
  }
}

/**
 * Avtalets tillstånd på svenska. Låg här och inte i avtalsvyn, eftersom
 * chatten visar samma sak – och två uppsättningar etiketter för samma sak
 * glider isär.
 */
export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  DRAFT: 'Utkast',
  SENT: 'Väntar på signaturer',
  PARTIALLY_SIGNED: 'En part har signerat',
  ACTIVE: 'Pågår',
  DELIVERED: 'Levererat – väntar',
  COMPLETED: 'Klart och utbetalt',
  CANCELLED: 'Avbrutet',
};

/** Färgtonen som hör till varje avtalsläge. */
export const CONTRACT_STATUS_TONES: Record<ContractStatus, StatusTone> = {
  DRAFT: 'pending',
  SENT: 'pending',
  PARTIALLY_SIGNED: 'pending',
  ACTIVE: 'active',
  DELIVERED: 'active',
  COMPLETED: 'done',
  CANCELLED: 'cancelled',
};

/** Vad som händer härnäst, för den som läser. */
export function describeNextStep(
  status: ContractStatus,
  isBusiness: boolean,
  signedByMe: boolean,
): string {
  switch (status) {
    case 'SENT':
    case 'PARTIALLY_SIGNED':
      return signedByMe
        ? 'Väntar på motpartens signatur.'
        : 'Du signerar med BankID i avtalet.';
    case 'ACTIVE':
      return isBusiness
        ? 'Kreatören lämnar filmen för godkännande innan den publiceras.'
        : 'Lämna filmen för godkännande, publicera och rapportera länken.';
    case 'DELIVERED':
      return isBusiness
        ? 'Godkänn leveransen så betalas arvodet ut.'
        : 'Väntar på att uppdragsgivaren godkänner.';
    case 'COMPLETED':
      return 'Klart. Lämna gärna ett omdöme.';
    case 'CANCELLED':
      return 'Avtalet är avbrutet.';
    default:
      return '';
  }
}
