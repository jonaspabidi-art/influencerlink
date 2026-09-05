import { z } from 'zod';
import {
  APPLICATION_STATUSES,
  BANKID_PURPOSES,
  BANKID_STATUSES,
  CAMPAIGN_STATUSES,
  CATEGORIES,
  COMPENSATION_TYPES,
  CONTRACT_STATUSES,
  DELIVERABLE_KINDS,
  MATCH_STATUSES,
  PAYMENT_STATUSES,
  PLATFORMS,
  ROLES,
  SWIPE_DIRECTIONS,
} from './domain.js';
import { mediaUrlSchema } from './media.js';
import { MAX_RATING, MIN_RATING, REVIEW_CRITERIA } from './reviews.js';

export const roleSchema = z.enum(ROLES);
export const platformSchema = z.enum(PLATFORMS);
export const categorySchema = z.enum(CATEGORIES);
export const compensationTypeSchema = z.enum(COMPENSATION_TYPES);
export const campaignStatusSchema = z.enum(CAMPAIGN_STATUSES);
export const contractStatusSchema = z.enum(CONTRACT_STATUSES);
export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);
export const matchStatusSchema = z.enum(MATCH_STATUSES);
export const applicationStatusSchema = z.enum(APPLICATION_STATUSES);
export const swipeDirectionSchema = z.enum(SWIPE_DIRECTIONS);
export const deliverableKindSchema = z.enum(DELIVERABLE_KINDS);
export const bankIdPurposeSchema = z.enum(BANKID_PURPOSES);
export const bankIdStatusSchema = z.enum(BANKID_STATUSES);

const oreSchema = z.number().int().min(0);
const cuidSchema = z.string().min(1);

/** Svenskt personnummer, 12 siffror utan bindestreck (ÅÅÅÅMMDDNNNN). */
export const personalNumberSchema = z
  .string()
  .regex(/^\d{12}$/, 'Personnummer ska anges med 12 siffror, t.ex. 199001011234');

/** Svenskt organisationsnummer, 10 siffror utan bindestreck. */
export const orgNumberSchema = z
  .string()
  .regex(/^\d{10}$/, 'Organisationsnummer ska anges med 10 siffror');

// ---------------------------------------------------------------------------
// Autentisering med BankID
// ---------------------------------------------------------------------------

export const bankIdStartSchema = z.object({
  purpose: bankIdPurposeSchema,
  /** Vilken kontotyp som ska skapas om personen loggar in för första gången. */
  role: z.enum(['INFLUENCER', 'BUSINESS']).optional(),
  /** Utelämnas vid QR-inloggning där användaren skannar med sin telefon. */
  personalNumber: personalNumberSchema.optional(),
  /** Krävs när syftet är SIGN. */
  contractId: cuidSchema.optional(),
});
export type BankIdStartInput = z.infer<typeof bankIdStartSchema>;

export const bankIdStartResponseSchema = z.object({
  orderRef: z.string(),
  autoStartToken: z.string(),
  /** Innehåll att rendera som QR-kod. Roteras vid varje statusanrop. */
  qrData: z.string(),
});

export const bankIdCollectResponseSchema = z.object({
  status: bankIdStatusSchema,
  /** Nyckel som appen översätter till svensk hjälptext, t.ex. "userSign". */
  hintCode: z.string().optional(),
  qrData: z.string().optional(),
  /** Sätts först när status är COMPLETE och syftet var LOGIN. */
  accessToken: z.string().optional(),
  user: z
    .object({
      id: cuidSchema,
      name: z.string(),
      role: roleSchema,
      onboardingComplete: z.boolean(),
    })
    .optional(),
});

// ---------------------------------------------------------------------------
// Profiler
// ---------------------------------------------------------------------------

export const socialAccountInputSchema = z.object({
  platform: platformSchema,
  handle: z.string().min(1).max(64),
  /** OAuth-kod från plattformens inloggning. Utelämnad i demoläge. */
  authorizationCode: z.string().optional(),
});
export type SocialAccountInput = z.infer<typeof socialAccountInputSchema>;

/**
 * Varifrån siffrorna kommer. PLATFORM betyder hämtat från plattformen efter
 * att kreatören loggat in; DEMO att de är genererade i väntan på att
 * integrationen godkänns, och alltså inte säger något om verkligheten.
 */
export const statsSourceSchema = z.enum(['PLATFORM', 'DEMO']);
export type StatsSource = z.infer<typeof statsSourceSchema>;

export const socialAccountSchema = z.object({
  id: cuidSchema,
  platform: platformSchema,
  handle: z.string(),
  followers: z.number().int().min(0),
  avgViews: z.number().int().min(0),
  engagementRate: z.number().min(0).max(1),
  verified: z.boolean(),
  statsSource: statsSourceSchema,
  /** Antal videor snittvisningarna bygger på. Null när siffran inte är mätt. */
  sampleSize: z.number().int().nullable(),
  lastSyncedAt: z.string().datetime().nullable(),
});

/** Startad TikTok-inloggning: adressen kreatören ska till, och vårt state. */
export const tiktokAuthorizationSchema = z.object({
  url: z.string(),
  state: z.string(),
});

/** En video kreatören kan välja att visa upp på sin profil. */
export const tiktokVideoSchema = z.object({
  id: z.string(),
  title: z.string(),
  coverImageUrl: z.string().nullable(),
  shareUrl: z.string().nullable(),
  views: z.number().int(),
  /** Sekunder sedan epoch, som TikTok anger det. */
  createdAt: z.number().int(),
  /** Om videon redan ligger på profilen. */
  showcased: z.boolean(),
});
export type TikTokVideo = z.infer<typeof tiktokVideoSchema>;

/** Vilka videor som ska synas på profilen. Listan ersätter den tidigare. */
export const showcaseSelectionSchema = z.object({
  videoIds: z.array(z.string().min(1)).max(12),
});
export type ShowcaseSelection = z.infer<typeof showcaseSelectionSchema>;

export const tiktokConnectSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});
export type TikTokConnectInput = z.infer<typeof tiktokConnectSchema>;

export const showcaseItemInputSchema = z.object({
  /** Adressen kreatören klistrat in, precis som den kopierades. */
  url: z.string().min(8).max(500),
});
export type ShowcaseItemInput = z.infer<typeof showcaseItemInputSchema>;

export const showcaseItemSchema = z.object({
  id: cuidSchema,
  platform: platformSchema,
  url: z.string(),
  postId: z.string().nullable(),
  title: z.string(),
  authorName: z.string(),
  thumbnailUrl: z.string().nullable(),
  thumbnailWidth: z.number().int().nullable(),
  thumbnailHeight: z.number().int().nullable(),
  /** Antal visningar. Null när plattformen inte lämnar ut siffran. */
  views: z.number().int().nullable(),
  position: z.number().int(),
});
export type ShowcaseItem = z.infer<typeof showcaseItemSchema>;

export const influencerProfileInputSchema = z.object({
  displayName: z.string().min(2).max(80),
  bio: z.string().max(600).default(''),
  city: z.string().min(2).max(80),
  categories: z.array(categorySchema).min(1).max(6),
  priceMin: oreSchema,
  priceTarget: oreSchema,
  avatarUrl: mediaUrlSchema.nullish(),
});
export type InfluencerProfileInput = z.infer<typeof influencerProfileInputSchema>;

export const businessProfileInputSchema = z.object({
  companyName: z.string().min(2).max(120),
  orgNumber: orgNumberSchema,
  city: z.string().min(2).max(80),
  address: z.string().max(200).default(''),
  description: z.string().max(600).default(''),
  categories: z.array(categorySchema).min(1).max(6),
  logoUrl: mediaUrlSchema.nullish(),
});
export type BusinessProfileInput = z.infer<typeof businessProfileInputSchema>;

// ---------------------------------------------------------------------------
// Kampanjer
// ---------------------------------------------------------------------------

export const campaignInputSchema = z
  .object({
    title: z.string().min(4).max(120),
    brief: z.string().min(10).max(4000),
    categories: z.array(categorySchema).min(1).max(6),
    platforms: z.array(platformSchema).min(1),
    deliverables: z.array(deliverableKindSchema).min(1).max(10),
    compensationType: compensationTypeSchema,
    budgetPerCreator: oreSchema,
    /** Värdet på mat/upplevelse som ingår, i öre. */
    productValue: oreSchema.default(0),
    slots: z.number().int().min(1).max(100),
    city: z.string().min(2).max(80),
    minFollowers: z.number().int().min(0).default(0),
    imageUrl: mediaUrlSchema.nullish(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
  })
  .refine((value) => new Date(value.endDate) > new Date(value.startDate), {
    message: 'Slutdatum måste ligga efter startdatum',
    path: ['endDate'],
  })
  .refine((value) => value.compensationType === 'PRODUCT' || value.budgetPerCreator > 0, {
    message: 'Kontant ersättning måste vara större än noll',
    path: ['budgetPerCreator'],
  })
  .refine((value) => value.compensationType === 'FIXED' || value.productValue > 0, {
    message: 'Ange värdet på det som bjuds',
    path: ['productValue'],
  });
export type CampaignInput = z.infer<typeof campaignInputSchema>;

/** Fritextbeskrivning som Sonnet omvandlar till ett färdigt kampanjutkast. */
export const campaignDraftRequestSchema = z.object({
  prompt: z.string().min(10).max(1000),
  city: z.string().min(2).max(80).optional(),
});
export type CampaignDraftRequest = z.infer<typeof campaignDraftRequestSchema>;

// ---------------------------------------------------------------------------
// Swipe, matchning och ansökningar
// ---------------------------------------------------------------------------

export const swipeInputSchema = z.object({
  campaignId: cuidSchema,
  /** Sätts av restaurangen när den swipar på en influencer. */
  influencerId: cuidSchema.optional(),
  direction: swipeDirectionSchema,
});
export type SwipeInput = z.infer<typeof swipeInputSchema>;

export const swipeResponseSchema = z.object({
  recorded: z.literal(true),
  /** Fylls i när båda parter har svajpat höger. */
  match: z
    .object({
      id: cuidSchema,
      campaignId: cuidSchema,
      influencerId: cuidSchema,
      matchScore: z.number(),
      matchReason: z.string(),
    })
    .nullable(),
});

export const applicationInputSchema = z.object({
  campaignId: cuidSchema,
  pitch: z.string().min(10).max(1500),
  proposedFee: oreSchema.optional(),
});
export type ApplicationInput = z.infer<typeof applicationInputSchema>;

export const messageInputSchema = z.object({
  body: z.string().min(1).max(2000),
});

// ---------------------------------------------------------------------------
// Kontrakt och betalning
// ---------------------------------------------------------------------------

export const contractInputSchema = z.object({
  matchId: cuidSchema,
  fee: oreSchema,
  deliverables: z.array(deliverableKindSchema).min(1),
  dueDate: z.string().datetime(),
  /** Dagar restaurangen har på sig att godkänna leveransen innan den auto-godkänns. */
  reviewDays: z.number().int().min(1).max(30).default(7),
  extraTerms: z.string().max(2000).default(''),
});
export type ContractInput = z.infer<typeof contractInputSchema>;

export const contractSchema = z.object({
  id: cuidSchema,
  campaignId: cuidSchema,
  influencerId: cuidSchema,
  status: contractStatusSchema,
  fee: oreSchema,
  platformFee: oreSchema,
  payout: oreSchema,
  deliverables: z.array(deliverableKindSchema),
  dueDate: z.string().datetime(),
  terms: z.string(),
  signedByInfluencerAt: z.string().datetime().nullable(),
  signedByBusinessAt: z.string().datetime().nullable(),
});

export const deliveryProofInputSchema = z.object({
  /** Länkar till de publicerade inläggen. */
  urls: z.array(z.string().url()).min(1).max(10),
  note: z.string().max(1000).default(''),
});
export type DeliveryProofInput = z.infer<typeof deliveryProofInputSchema>;

export const paymentSchema = z.object({
  id: cuidSchema,
  contractId: cuidSchema,
  amount: oreSchema,
  platformFee: oreSchema,
  payout: oreSchema,
  currency: z.string(),
  status: paymentStatusSchema,
  escrowedAt: z.string().datetime().nullable(),
  releasedAt: z.string().datetime().nullable(),
});

// ---------------------------------------------------------------------------
// Omdömen
// ---------------------------------------------------------------------------

const scoreSchema = z.number().int().min(MIN_RATING).max(MAX_RATING);

export const reviewScoresSchema = z.object(
  Object.fromEntries(REVIEW_CRITERIA.map((criterion) => [criterion, scoreSchema])) as Record<
    (typeof REVIEW_CRITERIA)[number],
    typeof scoreSchema
  >,
);

export const reviewInputSchema = z.object({
  scores: reviewScoresSchema,
  /** Frivillig, men det är texten motparten faktiskt läser. */
  comment: z.string().max(1000).default(''),
});
export type ReviewInput = z.infer<typeof reviewInputSchema>;

export const ratingSummarySchema = z.object({
  average: z.number(),
  count: z.number().int().min(0),
  distribution: z.array(z.number().int().min(0)).length(5),
});

export const reviewSchema = z.object({
  id: cuidSchema,
  contractId: cuidSchema,
  campaignTitle: z.string(),
  /** Vem som blir bedömd: INFLUENCER eller BUSINESS. */
  subject: z.enum(['INFLUENCER', 'BUSINESS']),
  authorName: z.string(),
  rating: z.number(),
  scores: reviewScoresSchema,
  comment: z.string(),
  createdAt: z.string().datetime(),
  /** Null så länge omdömet fortfarande är blint. */
  publishedAt: z.string().datetime().nullable(),
});

// ---------------------------------------------------------------------------
// Konto med e-post och lösenord
// ---------------------------------------------------------------------------

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Ange en giltig e-postadress');

/** Åtta tecken är golvet. Längd skyddar bättre än teckenkrav. */
export const passwordSchema = z
  .string()
  .min(8, 'Lösenordet behöver minst 8 tecken')
  .max(200);

export const registerInputSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(2, 'Skriv ditt namn'),
  role: z.enum(['INFLUENCER', 'BUSINESS']),
});
export type RegisterInput = z.infer<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Fyll i lösenordet'),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const problemSchema = z.object({
  error: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});
