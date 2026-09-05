import type { Category, DeliverableKind, Platform } from '@pacta/shared';

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
