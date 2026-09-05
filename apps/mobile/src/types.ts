import type {
  Category,
  CompensationType,
  ContractStatus,
  DeliverableKind,
  MatchStatus,
  PaymentStatus,
  Platform,
  RatingSummary,
  ReviewScores,
  Role,
} from '@pacta/shared';

export type { RatingSummary, ReviewScores };

export interface SessionUser {
  id: string;
  name: string;
  role: Role;
  onboardingComplete: boolean;
  personalNumberMask?: string | null;
  profileId?: string | null;
}

export interface Campaign {
  id: string;
  businessId: string;
  businessName: string;
  businessLogoUrl: string | null;
  title: string;
  brief: string;
  categories: Category[];
  platforms: Platform[];
  deliverables: DeliverableKind[];
  compensationType: CompensationType;
  budgetPerCreator: number;
  productValue: number;
  slots: number;
  slotsFilled: number;
  city: string;
  minFollowers: number;
  startDate: string;
  endDate: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'CLOSED';
}

export interface CampaignCard {
  score: number;
  reason: string;
  aiReviewed: boolean;
  /** Restaurangens betyg. count 0 = inga omdömen än. */
  rating: RatingSummary;
  campaign: Campaign;
}

export interface SocialAccount {
  id: string;
  platform: Platform;
  handle: string;
  followers: number;
  avgViews: number;
  engagementRate: number;
  verified: boolean;
  lastSyncedAt: string | null;
}

/** Ett inlägg kreatören valt att visa upp på sin profil. */
export interface ShowcaseItem {
  id: string;
  platform: Platform;
  url: string;
  postId: string | null;
  title: string;
  authorName: string;
  thumbnailUrl: string | null;
  thumbnailWidth: number | null;
  thumbnailHeight: number | null;
  position: number;
}

/** Företagets egen vy av sin profil – med organisationsnummer och adress. */
export interface OwnBusinessProfile {
  id: string;
  companyName: string;
  orgNumber: string;
  city: string;
  address: string;
  description: string;
  logoUrl: string | null;
  categories: Category[];
}

/** Kreatörsprofilen som den syns för andra – och för kreatören själv. */
export interface InfluencerProfile {
  id: string;
  displayName: string;
  bio: string;
  city: string;
  avatarUrl: string | null;
  categories: Category[];
  priceMin: number;
  priceTarget: number;
  payoutsEnabled: boolean;
  followers: number;
  avgViews: number;
  engagementRate: number;
  platforms: Platform[];
  socialAccounts: SocialAccount[];
  showcase: ShowcaseItem[];
}

export interface InfluencerCard {
  score: number;
  reason: string;
  aiReviewed: boolean;
  /** Kreatörens betyg. count 0 = inga omdömen än. */
  rating: RatingSummary;
  influencer: {
    id: string;
    displayName: string;
    bio: string;
    city: string;
    avatarUrl: string | null;
    categories: string[];
    platforms: string[];
    followers: number;
    avgViews: number;
    engagementRate: number;
    priceTarget: number;
    showcase: { id: string; platform: string; url: string; thumbnailUrl: string | null }[];
  };
}

export interface Match {
  id: string;
  status: MatchStatus;
  matchScore: number;
  matchReason: string;
  createdAt: string;
  campaign: {
    id: string;
    title: string;
    businessId: string;
    businessName: string;
    budgetPerCreator: number;
    city: string;
  };
  influencer: { id: string; displayName: string; avatarUrl: string | null; city: string };
  contractId: string | null;
  lastMessage: string | null;
  counterpartRating: RatingSummary;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
}

export interface Contract {
  id: string;
  campaignId: string;
  campaignTitle: string;
  businessId: string;
  businessName: string;
  influencerId: string;
  influencerName: string;
  status: ContractStatus;
  fee: number;
  platformFee: number;
  payout: number;
  deliverables: DeliverableKind[];
  dueDate: string;
  reviewDays: number;
  terms: string;
  signedByInfluencerAt: string | null;
  signedByBusinessAt: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  paymentStatus: PaymentStatus | null;
  awaitingMySignature: boolean;
}

export interface SwipeResult {
  recorded: true;
  match: {
    id: string;
    campaignId: string;
    influencerId: string;
    matchScore: number;
    matchReason: string;
  } | null;
}

export interface BankIdStart {
  orderRef: string;
  autoStartToken: string;
  qrData: string;
  autoStartUrl: string;
}

export interface BankIdStatus {
  status: 'PENDING' | 'COMPLETE' | 'FAILED';
  hintCode?: string;
  hintText: string;
  qrData?: string;
  accessToken?: string;
  user?: { id: string; name: string; role: Role; onboardingComplete: boolean };
}

export interface PayoutStatus {
  connected: boolean;
  payoutsEnabled: boolean;
  pendingPayout: number;
  paidOut: number;
}

export interface PendingLike {
  campaignId: string;
  title: string;
  businessName: string;
  businessLogoUrl: string | null;
  budgetPerCreator: number;
  likedAt: string;
}

export interface Review {
  id: string;
  contractId: string;
  campaignTitle: string;
  /** Vem omdömet handlar om, inte vem som skrev det. */
  subject: 'INFLUENCER' | 'BUSINESS';
  authorName: string;
  rating: number;
  scores: ReviewScores;
  comment: string;
  createdAt: string;
  publishedAt: string | null;
}

/** Omdömesläget för ett avtal, sett från den inloggade parten. */
export interface ReviewState {
  canReview: boolean;
  reason: string | null;
  daysLeft: number;
  mine: Review | null;
  theirs: Review | null;
  /** Motparten har skrivit, men omdömena är fortfarande blinda. */
  theirsPending: boolean;
}

export interface ProfileReviews {
  summary: RatingSummary;
  reviews: Review[];
}

export interface PendingReview {
  contractId: string;
  campaignTitle: string;
  counterpartName: string;
  completedAt: string;
  daysLeft: number;
}

/** Testkonto i väljaren på inloggningen. Finns bara när BankID är simulerat. */
export interface DemoAccount {
  id: string;
  name: string;
  role: 'INFLUENCER' | 'BUSINESS';
  displayName: string;
  onboardingComplete: boolean;
  summary: string;
}
