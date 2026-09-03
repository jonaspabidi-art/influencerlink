import type {
  Category,
  CompensationType,
  ContractStatus,
  DeliverableKind,
  MatchStatus,
  PaymentStatus,
  Platform,
  Role,
} from '@influencerlink/shared';

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
  campaign: Campaign;
}

export interface InfluencerCard {
  score: number;
  reason: string;
  aiReviewed: boolean;
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
  };
}

export interface Match {
  id: string;
  status: MatchStatus;
  matchScore: number;
  matchReason: string;
  createdAt: string;
  campaign: { id: string; title: string; businessName: string; budgetPerCreator: number; city: string };
  influencer: { id: string; displayName: string; avatarUrl: string | null; city: string };
  contractId: string | null;
  lastMessage: string | null;
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
