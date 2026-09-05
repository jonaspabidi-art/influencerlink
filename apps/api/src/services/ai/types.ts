import type {
  CampaignCandidate,
  Category,
  CompensationType,
  DeliverableKind,
  InfluencerCandidate,
  Platform,
  ScoreBreakdown,
} from '@pacta/shared';

export interface RankedInfluencer {
  influencer: InfluencerCandidate;
  score: ScoreBreakdown;
  /** 0–100 efter Sonnets bedömning. Lika med score.total när AI inte använts. */
  finalScore: number;
  /** En mening på svenska som visas på swipe-kortet. */
  reason: string;
  /** True när Sonnet faktiskt bedömde kandidaten. */
  aiReviewed: boolean;
}

export interface RankedCampaign {
  campaign: CampaignCandidate;
  score: ScoreBreakdown;
  finalScore: number;
  reason: string;
  aiReviewed: boolean;
}

export interface CampaignDraft {
  title: string;
  brief: string;
  categories: Category[];
  platforms: Platform[];
  deliverables: DeliverableKind[];
  compensationType: CompensationType;
  /** Föreslagen kontant ersättning per kreatör, i öre. */
  budgetPerCreator: number;
  /** Föreslaget värde på mat eller upplevelse, i öre. */
  productValue: number;
  slots: number;
  minFollowers: number;
  /** Kort förklaring av varför upplägget föreslås. */
  rationale: string;
}
