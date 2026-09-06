/**
 * Domänmodellens grundbegrepp. Delas mellan API och mobilapp så att båda
 * sidorna alltid pratar samma språk om roller, plattformar och statusflöden.
 */

export const ROLES = ['INFLUENCER', 'BUSINESS', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const PLATFORMS = ['TIKTOK', 'INSTAGRAM', 'YOUTUBE'] as const;
export type Platform = (typeof PLATFORMS)[number];

/** Nischer som både kampanjer och influencers taggas med. Driver grovmatchningen. */
export const CATEGORIES = [
  'RESTAURANG',
  'CAFE',
  'BAR',
  'STREET_FOOD',
  'FINE_DINING',
  'BAGERI',
  'VEGETARISKT',
  'MAT_OCH_DRYCK',
  'LIVSSTIL',
  'RESA',
  'FAMILJ',
  'TRANING',
  'NOJE',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const COMPENSATION_TYPES = ['FIXED', 'PRODUCT', 'HYBRID'] as const;
/** FIXED = enbart pengar, PRODUCT = enbart mat/upplevelse, HYBRID = båda. */
export type CompensationType = (typeof COMPENSATION_TYPES)[number];

export const CAMPAIGN_STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const SWIPE_DIRECTIONS = ['LIKE', 'PASS'] as const;
export type SwipeDirection = (typeof SWIPE_DIRECTIONS)[number];

export const SWIPE_ACTORS = ['INFLUENCER', 'BUSINESS'] as const;
export type SwipeActor = (typeof SWIPE_ACTORS)[number];

export const MATCH_STATUSES = ['NEW', 'IN_CONVERSATION', 'CONTRACTED', 'DECLINED'] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const APPLICATION_STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const CONTRACT_STATUSES = [
  'DRAFT',
  'SENT',
  'PARTIALLY_SIGNED',
  'ACTIVE',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const PAYMENT_STATUSES = [
  'PENDING',
  'ESCROWED',
  'RELEASED',
  'REFUNDED',
  'FAILED',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const BANKID_PURPOSES = ['LOGIN', 'SIGN'] as const;
export type BankIdPurpose = (typeof BANKID_PURPOSES)[number];

export const BANKID_STATUSES = ['PENDING', 'COMPLETE', 'FAILED'] as const;
export type BankIdStatus = (typeof BANKID_STATUSES)[number];

export const DELIVERABLE_KINDS = [
  'TIKTOK_VIDEO',
  'INSTAGRAM_REEL',
  'INSTAGRAM_POST',
  'INSTAGRAM_STORY',
  'YOUTUBE_SHORT',
  'YOUTUBE_VIDEO',
] as const;
export type DeliverableKind = (typeof DELIVERABLE_KINDS)[number];

/**
 * Förmedlingsavgiften är delad: företaget betalar sin del ovanpå arvodet och
 * kreatören får sin dragen vid utbetalning. Båda ser samma procentsats, och
 * kreatören får mer i handen än när hon bar hela avgiften ensam.
 */
export const BUSINESS_FEE_BPS = 1000;
export const CREATOR_FEE_BPS = 1000;

/**
 * Den odelade avgiften, som gällde före den delade. Avtal tecknade då har den
 * sparad på sig och ska räknas om precis som när de signerades.
 */
export const LEGACY_PLATFORM_FEE_BPS = 1200;

/** All valuta hanteras i minsta enhet (öre) för att undvika flyttalsfel. */
export const CURRENCY = 'sek';
