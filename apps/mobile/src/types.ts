import type {
  ExpertOrderStatus,
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
  /** Kampanjens egen bild. Faller tillbaka på logotypen på korten. */
  imageUrl: string | null;
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
  /** Företagets betyg. count 0 = inga omdömen än. */
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
  /** PLATFORM = hämtat från plattformen. DEMO = genererat, säger inget. */
  statsSource: 'PLATFORM' | 'DEMO';
  /** Antal videor snittvisningarna bygger på. */
  sampleSize: number | null;
  lastSyncedAt: string | null;
}

/** En video kreatören kan välja att visa upp. */
export interface TikTokVideo {
  id: string;
  title: string;
  coverImageUrl: string | null;
  shareUrl: string | null;
  views: number;
  createdAt: number;
  showcased: boolean;
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
  /** Antal visningar. Null för inklistrade länkar. */
  views: number | null;
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
  /** Bilder på verksamheten, i visningsordning. */
  photos: string[];
  categories: Category[];
  /** Hemsidan, om de har en. Kreatören vill se vad hon tackar ja till. */
  websiteUrl: string | null;
  /** Företagets egna konton – det är dem kreatören ska tagga. */
  socials: { platform: Platform; handle: string }[];
}

/** Företaget som kreatören ser det. */
export interface VenueProfile {
  id: string;
  companyName: string;
  city: string;
  address: string;
  description: string;
  logoUrl: string | null;
  photos: string[];
  categories: Category[];
  websiteUrl: string | null;
  socials: { platform: Platform; handle: string }[];
  openCampaigns: {
    id: string;
    title: string;
    budgetPerCreator: number;
    compensationType: 'FIXED' | 'PRODUCT' | 'HYBRID';
    productValue: number;
  }[];
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
    businessLogoUrl: string | null;
    imageUrl: string | null;
    budgetPerCreator: number;
    city: string;
  };
  influencer: { id: string; displayName: string; avatarUrl: string | null; city: string };
  contractId: string | null;
  /** Vad kreatören begärt, om hon sökt med ett eget pris. */
  proposedFee: number | null;
  lastMessage: string | null;
  counterpartRating: RatingSummary;
}

/** Vad ett samarbete gav. */
export interface ContractResults {
  measuredAt: string | null;
  /** Mätfönstret är slut; siffran ändras inte mer. */
  final: boolean;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
  /** Arvodet per tusen visningar, i öre. */
  costPerMille: number;
  posts: {
    url: string;
    platform: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
  }[];
  /** Tillägget om annonsering, när det finns ett. */
  usageRights: UsageRights | null;
  /** Vad tillägget skulle kosta, när det går att fråga. Null annars. */
  usageRightsOffer: { amount: number; creatorShare: number; months: number } | null;
}

/** Rätten att köra materialet som betald annons. */
export interface UsageRights {
  status: 'REQUESTED' | 'ACCEPTED' | 'DECLINED';
  months: number;
  /** Vad företaget betalar. */
  amount: number;
  /** Kreatörens del. */
  creatorShare: number;
  terms: string;
  paymentStatus: PaymentStatus;
  respondedAt: string | null;
}

/** Ett videoutkast som lämnats för godkännande. */
export interface Draft {
  id: string;
  version: number;
  status: 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED';
  fileName: string;
  contentType: string;
  sizeBytes: number;
  note: string;
  reviewNote: string;
  submittedAt: string;
  reviewedAt: string | null;
  autoApproved: boolean;
  /** Signerad adress som slutar gälla. Null när lagringen inte svarar. */
  playbackUrl: string | null;
  daysLeftToReview: number;
  cleared: boolean;
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
  /** Det avtalade arvodet. */
  fee: number;
  /** Företagets del av avgiften, ovanpå arvodet. */
  businessFee: number;
  /** Vad företaget betalar in. */
  charge: number;
  /** Kreatörens del, dragen från arvodet. */
  creatorFee: number;
  /** Hela förmedlingsavgiften. */
  platformFee: number;
  /** Vad kreatören får utbetalt. */
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

/** Om vi tar emot fler uppdrag just nu. */
export interface ExpertAvailability {
  available: boolean;
  price: number;
  /** Sant om företaget redan har ett uppdrag på gång. */
  hasOpenOrder: boolean;
}

/** Ett uppdrag där vi bygger kampanjen åt företaget. */
export interface ExpertOrder {
  id: string;
  status: ExpertOrderStatus;
  goal: string;
  timing: string;
  budget: string;
  notes: string;
  price: number;
  /** Kampanjen vi levererat, när den finns. */
  campaignId: string | null;
  requestedAt: string;
  deliveredAt: string | null;
  paymentStatus: PaymentStatus;
}

// --- Plattformsvyn (ADMIN) --------------------------------------------------

export interface AdminOverview {
  businesses: number;
  influencers: number;
  activeCampaigns: number;
  openContracts: number;
  /** Summan av arvodena i signerade avtal, i öre. */
  signedVolume: number;
  /** Vad plattformen tjänat på dem. */
  platformRevenue: number;
  escrowHeld: number;
  openExpertOrders: number;
}

export interface AdminBusinessRow {
  id: string;
  companyName: string;
  orgNumber: string;
  city: string;
  campaigns: number;
  contracts: number;
}

export interface AdminBusiness {
  id: string;
  companyName: string;
  orgNumber: string;
  city: string;
  address: string;
  description: string;
  websiteUrl: string | null;
  contactName: string;
  createdAt: string;
  campaigns: {
    id: string;
    title: string;
    status: Campaign['status'];
    slots: number;
    slotsFilled: number;
    budgetPerCreator: number;
    contracts: number;
  }[];
}

export interface AdminInfluencerRow {
  id: string;
  displayName: string;
  city: string;
  followers: number;
  /** Om siffrorna kommer från plattformen eller är påhittade. */
  statsVerified: boolean;
  payoutsReady: boolean;
  contracts: number;
}

export interface AdminInfluencer {
  id: string;
  displayName: string;
  bio: string;
  city: string;
  contactName: string;
  /** Maskerat. Hela numret finns bara som hash. */
  personalNumberMask: string | null;
  priceMin: number;
  priceTarget: number;
  payoutsReady: boolean;
  createdAt: string;
  rating: RatingSummary;
  socials: {
    platform: string;
    handle: string;
    followers: number;
    avgViews: number;
    statsSource: string;
    /** Sant om kontot är kopplat med inloggning. Nyckeln visas aldrig. */
    connected: boolean;
  }[];
  contracts: {
    id: string;
    campaignTitle: string;
    businessName: string;
    status: ContractStatus;
    fee: number;
    payout: number;
  }[];
}

export interface AdminContractRow {
  id: string;
  campaignTitle: string;
  businessName: string;
  influencerName: string;
  status: ContractStatus;
  fee: number;
  paymentStatus: string | null;
  createdAt: string;
}

export interface AdminContract {
  id: string;
  campaignId: string;
  campaignTitle: string;
  businessId: string;
  businessName: string;
  influencerId: string;
  influencerName: string;
  status: ContractStatus;
  fee: number;
  charge: number;
  platformFee: number;
  payout: number;
  dueDate: string;
  terms: string;
  signedByBusinessAt: string | null;
  signedByInfluencerAt: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  deliveryUrls: string[];
  payment: {
    status: string;
    amount: number;
    payout: number;
    escrowedAt: string | null;
    releasedAt: string | null;
  } | null;
  usageRights: {
    status: string;
    amount: number;
    creatorShare: number;
    paymentStatus: string;
  } | null;
  views: number;
}

/** Ett uppdrag i kön, sett från vår sida. */
export interface AdminExpertOrder extends ExpertOrder {
  businessId: string;
  companyName: string;
  city: string;
}
