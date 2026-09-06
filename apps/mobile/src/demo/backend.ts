import {
  checkEligibility,
  checkReviewEligibility,
  daysLeftToReview,
  emptyRatingSummary,
  overallRating,
  rankCampaigns,
  rankInfluencers,
  recogniseLink,
  renderContractTerms,
  reviewDeadline,
  splitFee,
  summarizeRatings,
  type CampaignCandidate,
  type Category,
  type DeliverableKind,
  type InfluencerCandidate,
  type Platform,
  type RatingSummary,
  type ReviewScores,
} from '@pacta/shared';
import {
  DEMO_APPLICATIONS,
  DEMO_BUSINESSES,
  DEMO_CAMPAIGNS,
  DEMO_INFLUENCERS,
  DEMO_REVIEWS,
  DEMO_USERS,
  type DemoBusiness,
  type DemoCampaign,
  type DemoInfluencer,
  type DemoReview,
  type DemoUser,
} from './data';

/**
 * En liten backend som körs i appen. Den speglar API:ets slutpunkter tillräckligt
 * exakt för att hela flödet ska gå att klicka igenom utan server, databas,
 * BankID-certifikat eller Stripe-nycklar.
 *
 * Skillnader mot riktiga API:et, medvetet:
 *  - BankID legitimerar direkt utan att någon skannar något.
 *  - Betalningar bokförs utan att pengar rör sig.
 *  - Matchningen använder bara heuristiken, inte Claude.
 * Allt annat – regler, statusflöden, avtalstext – är samma kod.
 */

export class DemoError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

interface Swipe {
  campaignId: string;
  influencerId: string;
  actor: 'INFLUENCER' | 'BUSINESS';
  direction: 'LIKE' | 'PASS';
}

interface Match {
  id: string;
  campaignId: string;
  influencerId: string;
  status: 'NEW' | 'IN_CONVERSATION' | 'CONTRACTED' | 'DECLINED';
  matchScore: number;
  matchReason: string;
  createdAt: string;
}

interface Message {
  id: string;
  matchId: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
}

interface Application {
  id: string;
  campaignId: string;
  influencerId: string;
  pitch: string;
  proposedFee: number | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
  createdAt: string;
}

interface Contract {
  id: string;
  matchId: string;
  campaignId: string;
  influencerId: string;
  status: 'SENT' | 'PARTIALLY_SIGNED' | 'ACTIVE' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED';
  fee: number;
  businessFeeBps: number;
  creatorFeeBps: number;
  deliverables: DeliverableKind[];
  dueDate: string;
  reviewDays: number;
  terms: string;
  signedByInfluencerAt: string | null;
  signedByBusinessAt: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  paymentStatus: 'PENDING' | 'ESCROWED' | 'RELEASED' | 'REFUNDED' | 'FAILED' | null;
}

interface BankIdOrder {
  orderRef: string;
  purpose: 'LOGIN' | 'SIGN';
  role: 'INFLUENCER' | 'BUSINESS' | undefined;
  contractId: string | undefined;
  createdAt: number;
  cancelled: boolean;
}

interface State {
  users: DemoUser[];
  influencers: DemoInfluencer[];
  businesses: DemoBusiness[];
  campaigns: DemoCampaign[];
  swipes: Swipe[];
  matches: Match[];
  messages: Message[];
  applications: Application[];
  contracts: Contract[];
  reviews: DemoReview[];
  accounts: DemoAccountRecord[];
  orders: BankIdOrder[];
  sessionUserId: string | null;
}

/** Så länge låtsas BankID-dialogen pågå innan den blir klar. */
const DEMO_BANKID_MS = 1400;
const FEE_SPLIT = { businessFeeBps: 1000, creatorFeeBps: 1000 };

/** Avgiftsfördelningen som avtalet tecknades med. */
function feeSplitOf(contract: { businessFeeBps: number; creatorFeeBps: number }) {
  return { businessFeeBps: contract.businessFeeBps, creatorFeeBps: contract.creatorFeeBps };
}

const STORAGE_KEY = 'pacta.demo';

/**
 * På webben sparas demoläget i localStorage, så att svep och avtal överlever
 * en omladdning av sidan. På native finns ingen localStorage och tillståndet
 * lever bara i minnet – appen laddas sällan om där.
 */
const STATE_ARRAYS = [
  'users',
  'influencers',
  'businesses',
  'campaigns',
  'swipes',
  'matches',
  'messages',
  'applications',
  'contracts',
  'reviews',
  'accounts',
  'orders',
] as const;

function loadPersisted(): State | null {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<State>;
    // Sparat läge från en äldre version av appen saknar fält som tillkommit
    // sedan dess. Då är det bättre att börja om än att köra vidare halvtomt.
    if (STATE_ARRAYS.some((key) => !Array.isArray(parsed[key]))) return null;
    return parsed as State;
  } catch {
    return null;
  }
}

function persist(): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Full disk eller privat läge: demon fungerar ändå, den glömmer bara vid omladdning.
  }
}

let state: State = loadPersisted() ?? freshState();
let sequence = 0;

const nextId = (prefix: string) => `${prefix}_${(sequence += 1).toString(36)}${Date.now().toString(36).slice(-4)}`;

function freshState(): State {
  return {
    users: DEMO_USERS.map((user) => ({ ...user })),
    influencers: DEMO_INFLUENCERS.map((profile) => ({
      ...profile,
      socials: [...profile.socials],
      showcase: [...profile.showcase],
    })),
    businesses: DEMO_BUSINESSES.map((business) => ({ ...business })),
    campaigns: DEMO_CAMPAIGNS.map((campaign) => ({ ...campaign })),
    // Anna har redan swipat höger på lunchkampanjen: restaurangen ser henne direkt.
    swipes: [{ campaignId: 'cmp_lunch', influencerId: 'inf_anna', actor: 'INFLUENCER', direction: 'LIKE' }],
    matches: [],
    messages: [],
    applications: DEMO_APPLICATIONS.map((application) => ({ ...application })),
    contracts: [],
    reviews: DEMO_REVIEWS.map((item) => ({ ...item, scores: { ...item.scores } })),
    accounts: [],
    orders: [],
    sessionUserId: null,
  };
}

/** Nollställer demon till utgångsläget. */
export function resetDemo(): void {
  state = freshState();
  persist();
}

// --- hjälpare ---------------------------------------------------------------

function currentUser(): DemoUser {
  const user = state.users.find((item) => item.id === state.sessionUserId);
  if (!user) throw new DemoError(401, 'unauthorized', 'Du måste vara inloggad.');
  return user;
}

function requireProfileId(user: DemoUser): string {
  if (!user.profileId) {
    throw new DemoError(403, 'forbidden', 'Du behöver slutföra din profil först.');
  }
  return user.profileId;
}

function influencerById(id: string): DemoInfluencer {
  const profile = state.influencers.find((item) => item.id === id);
  if (!profile) throw new DemoError(404, 'not_found', 'Profilen hittades inte.');
  return profile;
}

function businessById(id: string): DemoBusiness {
  const business = state.businesses.find((item) => item.id === id);
  if (!business) throw new DemoError(404, 'not_found', 'Företaget hittades inte.');
  return business;
}

function campaignById(id: string): DemoCampaign {
  const campaign = state.campaigns.find((item) => item.id === id);
  if (!campaign) throw new DemoError(404, 'not_found', 'Kampanjen hittades inte.');
  return campaign;
}

function aggregate(profile: DemoInfluencer) {
  const followers = profile.socials.reduce((sum, account) => sum + account.followers, 0);
  const avgViews = profile.socials.length
    ? Math.round(profile.socials.reduce((sum, account) => sum + account.avgViews, 0) / profile.socials.length)
    : 0;
  const weighted = profile.socials.reduce(
    (sum, account) => sum + account.engagementRate * account.followers,
    0,
  );
  return {
    followers,
    avgViews,
    engagementRate: followers > 0 ? Number((weighted / followers).toFixed(4)) : 0,
  };
}

function toInfluencerCandidate(profile: DemoInfluencer): InfluencerCandidate {
  const stats = aggregate(profile);
  return {
    id: profile.id,
    displayName: profile.displayName,
    city: profile.city,
    categories: profile.categories,
    platforms: profile.socials.map((account) => account.platform),
    followers: stats.followers,
    avgViews: stats.avgViews,
    engagementRate: stats.engagementRate,
    priceMin: profile.priceMin,
    priceTarget: Math.max(profile.priceTarget, profile.priceMin),
  };
}

function toCampaignCandidate(campaign: DemoCampaign): CampaignCandidate {
  return {
    id: campaign.id,
    title: campaign.title,
    city: campaign.city,
    categories: campaign.categories,
    platforms: campaign.platforms,
    deliverables: campaign.deliverables,
    minFollowers: campaign.minFollowers,
    budgetPerCreator: campaign.budgetPerCreator,
  };
}

function slotsFilled(campaignId: string): number {
  return state.contracts.filter(
    (contract) => contract.campaignId === campaignId && contract.status !== 'CANCELLED',
  ).length;
}

function publicCampaign(campaign: DemoCampaign) {
  const business = businessById(campaign.businessId);
  return {
    ...campaign,
    businessName: business.companyName,
    businessLogoUrl: business.logoUrl,
    slotsFilled: slotsFilled(campaign.id),
  };
}

function publicContract(contract: Contract, role: 'INFLUENCER' | 'BUSINESS') {
  const campaign = campaignById(contract.campaignId);
  const business = businessById(campaign.businessId);
  const influencer = influencerById(contract.influencerId);
  const breakdown = splitFee(contract.fee, feeSplitOf(contract));
  const mine = role === 'INFLUENCER' ? contract.signedByInfluencerAt : contract.signedByBusinessAt;

  return {
    id: contract.id,
    campaignId: contract.campaignId,
    campaignTitle: campaign.title,
    businessId: business.id,
    businessName: business.companyName,
    influencerId: contract.influencerId,
    influencerName: influencer.displayName,
    status: contract.status,
    fee: breakdown.fee,
    businessFee: breakdown.businessFee,
    charge: breakdown.charge,
    creatorFee: breakdown.creatorFee,
    platformFee: breakdown.platformFee,
    payout: breakdown.net,
    deliverables: contract.deliverables,
    dueDate: contract.dueDate,
    reviewDays: contract.reviewDays,
    terms: contract.terms,
    signedByInfluencerAt: contract.signedByInfluencerAt,
    signedByBusinessAt: contract.signedByBusinessAt,
    deliveredAt: contract.deliveredAt,
    completedAt: contract.completedAt,
    paymentStatus: contract.paymentStatus,
    awaitingMySignature:
      mine === null && (contract.status === 'SENT' || contract.status === 'PARTIALLY_SIGNED'),
  };
}

/** Publicerat = båda skrev, eller fönstret gick ut och det ensamma släpptes fram. */
function isPublished(review: DemoReview, now = Date.now()): boolean {
  return review.publishedAt !== null || new Date(review.visibleAt).getTime() <= now;
}

/** Betyget för en profil, räknat på publicerade omdömen från motparten. */
function ratingFor(subject: 'INFLUENCER' | 'BUSINESS', profileId: string): RatingSummary {
  const authorRole = subject === 'INFLUENCER' ? 'BUSINESS' : 'INFLUENCER';
  const ratings = state.reviews
    .filter(
      (review) =>
        review.authorRole === authorRole &&
        isPublished(review) &&
        (subject === 'INFLUENCER' ? review.influencerId : review.businessId) === profileId,
    )
    .map((review) => overallRating(review.scores));
  return ratings.length ? summarizeRatings(ratings) : emptyRatingSummary();
}

function publicReview(review: DemoReview) {
  return {
    id: review.id,
    contractId: review.contractId,
    campaignTitle: review.campaignTitle,
    subject: review.authorRole === 'BUSINESS' ? ('INFLUENCER' as const) : ('BUSINESS' as const),
    authorName: review.authorName,
    rating: overallRating(review.scores),
    scores: review.scores,
    comment: review.comment,
    createdAt: review.createdAt,
    publishedAt: review.publishedAt,
  };
}

/** Samma regel som i API:et: ömsesidig LIKE ger en matchning. */
function recordSwipe(input: Swipe): Match | null {
  const campaign = campaignById(input.campaignId);
  if (campaign.status !== 'ACTIVE') {
    throw new DemoError(400, 'bad_request', 'Kampanjen tar inte emot nya intresseanmälningar.');
  }
  if (slotsFilled(campaign.id) >= campaign.slots) {
    throw new DemoError(400, 'bad_request', 'Kampanjen är fullbokad.');
  }

  state.swipes = state.swipes.filter(
    (swipe) =>
      !(
        swipe.campaignId === input.campaignId &&
        swipe.influencerId === input.influencerId &&
        swipe.actor === input.actor
      ),
  );
  state.swipes.push(input);

  if (input.direction === 'PASS') return null;

  const opposite = input.actor === 'INFLUENCER' ? 'BUSINESS' : 'INFLUENCER';
  const counterpart = state.swipes.find(
    (swipe) =>
      swipe.campaignId === input.campaignId &&
      swipe.influencerId === input.influencerId &&
      swipe.actor === opposite,
  );
  if (!counterpart || counterpart.direction !== 'LIKE') return null;

  const existing = state.matches.find(
    (match) => match.campaignId === input.campaignId && match.influencerId === input.influencerId,
  );
  if (existing) return existing;

  const { total, reasons } = rankInfluencers(toCampaignCandidate(campaign), [
    toInfluencerCandidate(influencerById(input.influencerId)),
  ])[0]!.score;

  const match: Match = {
    id: nextId('mat'),
    campaignId: input.campaignId,
    influencerId: input.influencerId,
    status: 'NEW',
    matchScore: total,
    matchReason: reasons[0] ?? 'Ömsesidigt intresse',
    createdAt: new Date().toISOString(),
  };
  state.matches.push(match);
  return match;
}

function publicMatch(match: Match, viewerRole: 'INFLUENCER' | 'BUSINESS') {
  const campaign = campaignById(match.campaignId);
  const business = businessById(campaign.businessId);
  const influencer = influencerById(match.influencerId);
  const contract = state.contracts.find((item) => item.matchId === match.id);
  const messages = state.messages.filter((message) => message.matchId === match.id);

  return {
    id: match.id,
    status: match.status,
    matchScore: match.matchScore,
    matchReason: match.matchReason,
    createdAt: match.createdAt,
    campaign: {
      id: campaign.id,
      title: campaign.title,
      businessId: business.id,
      businessName: business.companyName,
      businessLogoUrl: business.logoUrl,
      imageUrl: campaign.imageUrl,
      budgetPerCreator: campaign.budgetPerCreator,
      city: campaign.city,
    },
    influencer: {
      id: influencer.id,
      displayName: influencer.displayName,
      avatarUrl: influencer.avatarUrl,
      city: influencer.city,
    },
    contractId: contract?.id ?? null,
    proposedFee:
      state.applications.find(
        (application) =>
          application.campaignId === campaign.id && application.influencerId === influencer.id,
      )?.proposedFee ?? null,
    lastMessage: messages[messages.length - 1]?.body ?? null,
    counterpartRating:
      viewerRole === 'BUSINESS'
        ? ratingFor('INFLUENCER', influencer.id)
        : ratingFor('BUSINESS', business.id),
  };
}

// --- routern ----------------------------------------------------------------

type Handler = (context: {
  body: Record<string, unknown>;
  query: URLSearchParams;
  params: string[];
}) => unknown;

interface Route {
  method: string;
  pattern: RegExp;
  handle: Handler;
}

const routes: Route[] = [];

function route(method: string, path: string, handle: Handler): void {
  // ":x" i sökvägen blir en fångstgrupp, resten matchas ordagrant.
  const pattern = new RegExp(
    `^${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:[a-zA-Z]+/g, '([^/]+)')}$`,
  );
  routes.push({ method, pattern, handle });
}

// Autentisering ---------------------------------------------------------------

route('POST', '/auth/bankid/start', ({ body }) => {
  const order: BankIdOrder = {
    orderRef: nextId('ord'),
    purpose: body.purpose === 'SIGN' ? 'SIGN' : 'LOGIN',
    role: body.role === 'BUSINESS' ? 'BUSINESS' : body.role === 'INFLUENCER' ? 'INFLUENCER' : undefined,
    contractId: typeof body.contractId === 'string' ? body.contractId : undefined,
    createdAt: Date.now(),
    cancelled: false,
  };
  state.orders.push(order);
  return {
    orderRef: order.orderRef,
    autoStartToken: 'demo',
    qrData: `demo.${order.orderRef}`,
    autoStartUrl: '',
  };
});

route('GET', '/auth/bankid/:orderRef', ({ params }) => {
  const order = state.orders.find((item) => item.orderRef === params[0]);
  if (!order) throw new DemoError(404, 'not_found', 'BankID-ordern finns inte längre.');
  if (order.cancelled) {
    return { status: 'FAILED', hintCode: 'userCancel', hintText: 'Du avbröt legitimeringen.' };
  }

  if (Date.now() - order.createdAt < DEMO_BANKID_MS) {
    return {
      status: 'PENDING',
      hintCode: 'userSign',
      hintText: 'Demoläge – ingen riktig legitimering. Klart om ett ögonblick …',
      qrData: `demo.${order.orderRef}.${Math.floor((Date.now() - order.createdAt) / 1000)}`,
    };
  }

  if (order.purpose === 'SIGN') {
    signContract(order.contractId);
    return { status: 'COMPLETE', hintText: 'Avtalet är signerat.' };
  }

  // Logga in som den demoprofil som passar den valda rollen.
  const user =
    state.users.find((item) => item.id === (order.role === 'BUSINESS' ? 'usr_petra' : 'usr_anna')) ??
    state.users[0]!;
  state.sessionUserId = user.id;

  return {
    status: 'COMPLETE',
    hintText: 'Inloggad i demoläge.',
    accessToken: `demo-token-${user.id}`,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      onboardingComplete: user.onboardingComplete,
    },
  };
});

route('POST', '/auth/bankid/:orderRef/cancel', ({ params }) => {
  const order = state.orders.find((item) => item.orderRef === params[0]);
  if (order) order.cancelled = true;
  return { cancelled: true };
});

/** Konton skapade i demoläget. Lösenordet sparas i klartext – det är en demo. */
interface DemoAccountRecord {
  userId: string;
  email: string;
  password: string;
}

route('POST', '/auth/register', ({ body }) => {
  const email = String(body.email ?? '').trim().toLowerCase();
  if (state.accounts.some((account) => account.email === email)) {
    throw new DemoError(409, 'conflict', 'Det finns redan ett konto med den adressen.');
  }

  const user: DemoUser = {
    id: nextId('usr'),
    name: String(body.name ?? '').trim(),
    role: body.role === 'BUSINESS' ? 'BUSINESS' : 'INFLUENCER',
    personalNumberMask: '',
    onboardingComplete: false,
    profileId: null,
  };
  state.users.push(user);
  state.accounts.push({ userId: user.id, email, password: String(body.password ?? '') });
  state.sessionUserId = user.id;

  return { accessToken: `demo-token-${user.id}`, user: publicUser(user) };
});

route('POST', '/auth/login', ({ body }) => {
  const email = String(body.email ?? '').trim().toLowerCase();
  const account = state.accounts.find(
    (item) => item.email === email && item.password === String(body.password ?? ''),
  );
  if (!account) {
    throw new DemoError(401, 'unauthorized', 'Fel e-postadress eller lösenord.');
  }
  const user = state.users.find((item) => item.id === account.userId);
  if (!user) throw new DemoError(401, 'unauthorized', 'Fel e-postadress eller lösenord.');

  state.sessionUserId = user.id;
  return { accessToken: `demo-token-${user.id}`, user: publicUser(user) };
});

route('GET', '/auth/demo-accounts', () =>
  state.users.map((user) => {
    const influencer = state.influencers.find((item) => item.id === user.profileId);
    const business = state.businesses.find((item) => item.id === user.profileId);
    const parts: string[] = [];
    if (influencer) {
      parts.push(influencer.city);
      const matches = state.matches.filter((m) => m.influencerId === influencer.id).length;
      if (matches > 0) parts.push(`${matches} ${matches === 1 ? 'matchning' : 'matchningar'}`);
    } else if (business) {
      parts.push(business.city);
      const campaigns = state.campaigns.filter((c) => c.businessId === business.id).length;
      if (campaigns > 0) parts.push(`${campaigns} ${campaigns === 1 ? 'kampanj' : 'kampanjer'}`);
    } else {
      parts.push('profilen inte klar');
    }
    return {
      id: user.id,
      name: user.name,
      role: user.role,
      displayName: influencer?.displayName ?? business?.companyName ?? user.name,
      onboardingComplete: user.onboardingComplete,
      summary: parts.join(' · '),
    };
  }),
);

route('POST', '/auth/demo-login', ({ body }) => {
  const user = state.users.find((item) => item.id === String(body.userId ?? ''));
  if (!user) throw new DemoError(404, 'not_found', 'Kontot hittades inte.');
  state.sessionUserId = user.id;
  return { accessToken: `demo-token-${user.id}` };
});

function publicUser(user: DemoUser) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    onboardingComplete: user.onboardingComplete,
    personalNumberMask: user.personalNumberMask,
    profileId: user.profileId,
  };
}

route('GET', '/auth/me', () => {
  const user = currentUser();
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    onboardingComplete: user.onboardingComplete,
    personalNumberMask: user.personalNumberMask,
    profileId: user.profileId,
  };
});

route('POST', '/auth/refresh', () => ({ accessToken: `demo-token-${currentUser().id}` }));

// Profiler --------------------------------------------------------------------

route('PUT', '/me/influencer-profile', ({ body }) => {
  const user = currentUser();
  const existing = user.profileId ? influencerById(user.profileId) : undefined;
  const profile: DemoInfluencer = {
    id: existing?.id ?? nextId('inf'),
    userId: user.id,
    displayName: String(body.displayName ?? ''),
    bio: String(body.bio ?? ''),
    city: String(body.city ?? ''),
    avatarUrl: typeof body.avatarUrl === 'string' ? body.avatarUrl : null,
    categories: (body.categories as Category[]) ?? [],
    priceMin: Number(body.priceMin ?? 0),
    priceTarget: Number(body.priceTarget ?? 0),
    payoutsEnabled: existing?.payoutsEnabled ?? false,
    stripeAccountId: existing?.stripeAccountId ?? null,
    socials: existing?.socials ?? [],
    showcase: existing?.showcase ?? [],
  };
  state.influencers = [...state.influencers.filter((item) => item.id !== profile.id), profile];
  user.profileId = profile.id;
  user.onboardingComplete = profile.socials.length > 0;

  return {
    profile: { id: profile.id },
    accessToken: `demo-token-${user.id}`,
  };
});

// Demoläget har ingen TikTok-app att logga in mot. Svaret säger det rakt ut i
// stället för att låtsas att kopplingen lyckades.
route('GET', '/me/influencer-profile/tiktok/videos', () => {
  throw new DemoError(
    400,
    'bad_request',
    'Logga in med TikTok först, så kan vi hämta dina videor. Det går inte i demoläget.',
  );
});

// Demoläget har ingen fillagring. Listan är tom och uppladdningen förklarar
// varför i stället för att fela tyst.
// Demoläget mäter ingenting – siffrorna finns bara hos plattformen.
route('POST', '/assistant/ask', () => ({
  available: false,
  answer: null,
  candidateCount: 0,
}));

route('GET', '/contracts/:id/results', () => ({
  measuredAt: null,
  final: false,
  views: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  engagementRate: 0,
  costPerMille: 0,
  posts: [],
}));

route('GET', '/contracts/:id/drafts', () => []);

route('POST', '/contracts/:id/drafts/upload-url', () => {
  throw new DemoError(
    503,
    'service_unavailable',
    'Uppladdning av utkast fungerar inte i demoläget.',
  );
});

route('POST', '/me/influencer-profile/socials/tiktok/authorize', () => {
  throw new DemoError(
    503,
    'service_unavailable',
    'TikTok-inloggningen fungerar inte i demoläget. Koppla kontot med användarnamn så länge.',
  );
});

route('POST', '/me/influencer-profile/socials', ({ body }) => {
  const user = currentUser();
  const profile = influencerById(requireProfileId(user));
  const platform = body.platform as Platform;
  const handle = String(body.handle ?? '').replace(/^@/, '');

  // Siffrorna är påhittade men stabila per användarnamn, precis som i API:et.
  const seed = [...`${platform}:${handle.toLowerCase()}`].reduce(
    (sum, character) => (sum * 31 + character.charCodeAt(0)) % 1_000_003,
    7,
  );
  const followers = 2_000 + (seed % 180_000);
  const account = {
    id: nextId('soc'),
    platform,
    handle,
    followers,
    avgViews: Math.round(followers * (platform === 'TIKTOK' ? 0.8 : 0.4)),
    engagementRate: Number((((seed % 70) + 15) / 1500).toFixed(4)),
    verified: followers > 50_000,
  };
  profile.socials = [...profile.socials.filter((item) => item.platform !== platform), account];
  user.onboardingComplete = true;
  return { ...account, statsSource: 'DEMO', sampleSize: null, lastSyncedAt: new Date().toISOString() };
});

// Samma tre slutpunkter som API:et. Demoläget har ingen uppkoppling, så
// länken sparas utan miniatyr – titeln sätts av plattformsnamnet.
route('DELETE', '/me/influencer-profile/socials/:id', ({ params }) => {
  const profile = influencerById(requireProfileId(currentUser()));
  const before = profile.socials.length;
  profile.socials = profile.socials.filter((item) => item.id !== params[0]);
  if (profile.socials.length === before) {
    throw new DemoError(404, 'not_found', 'Kontot hittades inte.');
  }
  return { deleted: true };
});

route('GET', '/businesses/:id', ({ params }) => {
  const business = businessById(params[0]!);
  return {
    id: business.id,
    companyName: business.companyName,
    city: business.city,
    address: business.address,
    description: business.description,
    logoUrl: business.logoUrl,
    photos: business.photos,
    categories: business.categories,
    websiteUrl: business.websiteUrl,
    socials: business.socials,
    openCampaigns: state.campaigns
      .filter((campaign) => campaign.businessId === business.id && campaign.status === 'ACTIVE')
      .slice(0, 5)
      .map((campaign) => ({
        id: campaign.id,
        title: campaign.title,
        budgetPerCreator: campaign.budgetPerCreator,
        compensationType: campaign.compensationType,
        productValue: campaign.productValue,
      })),
  };
});

route('GET', '/influencers', ({ query }) => {
  const city = query.get('city')?.toLowerCase();
  const category = query.get('category');
  return state.influencers
    .filter((profile) => profile.socials.length > 0)
    .filter((profile) => !city || profile.city.toLowerCase() === city)
    .filter((profile) => !category || profile.categories.includes(category as Category))
    .map((profile) => {
      const stats = aggregate(profile);
      return {
        id: profile.id,
        displayName: profile.displayName,
        bio: profile.bio,
        city: profile.city,
        avatarUrl: profile.avatarUrl,
        categories: profile.categories,
        priceMin: profile.priceMin,
        priceTarget: profile.priceTarget,
        payoutsEnabled: profile.payoutsEnabled,
        followers: stats.followers,
        avgViews: stats.avgViews,
        engagementRate: stats.engagementRate,
        platforms: profile.socials.map((account) => account.platform),
        socialAccounts: profile.socials.map((account) => ({
          ...account,
          statsSource: 'DEMO',
          sampleSize: null,
          lastSyncedAt: null,
        })),
        showcase: [...profile.showcase].sort((a, b) => a.position - b.position),
        rating: ratingFor('INFLUENCER', profile.id),
      };
    });
});

route('GET', '/influencers/:id', ({ params }) => {
  const profile = influencerById(params[0]!);
  const stats = aggregate(profile);
  return {
    id: profile.id,
    displayName: profile.displayName,
    bio: profile.bio,
    city: profile.city,
    avatarUrl: profile.avatarUrl,
    categories: profile.categories,
    priceMin: profile.priceMin,
    priceTarget: profile.priceTarget,
    payoutsEnabled: profile.payoutsEnabled,
    followers: stats.followers,
    avgViews: stats.avgViews,
    engagementRate: stats.engagementRate,
    platforms: profile.socials.map((account) => account.platform),
    socialAccounts: profile.socials.map((account) => ({
      ...account,
      statsSource: 'DEMO',
      sampleSize: null,
      lastSyncedAt: null,
    })),
    showcase: [...profile.showcase].sort((a, b) => a.position - b.position),
  };
});

route('GET', '/me/influencer-profile/showcase', () => {
  const profile = influencerById(requireProfileId(currentUser()));
  return [...profile.showcase].sort((a, b) => a.position - b.position);
});

route('POST', '/me/influencer-profile/showcase', ({ body }) => {
  const profile = influencerById(requireProfileId(currentUser()));
  const link = recogniseLink(String(body.url ?? ''));
  if (!link) {
    throw new DemoError(
      400,
      'bad_request',
      'Länken känns inte igen. Klistra in en länk till ett inlägg på TikTok, Instagram eller YouTube.',
    );
  }
  if (profile.showcase.some((item) => item.url === link.url)) {
    throw new DemoError(409, 'conflict', 'Inlägget finns redan på profilen.');
  }
  if (profile.showcase.length >= 12) {
    throw new DemoError(409, 'conflict', 'Du kan visa upp högst 12 inlägg. Ta bort ett först.');
  }

  const item = {
    id: nextId('shw'),
    platform: link.platform,
    url: link.url,
    postId: link.postId,
    title: `Inlägg på ${link.platform.toLowerCase()}`,
    authorName: link.handle ?? '',
    thumbnailUrl: null,
    thumbnailWidth: null,
    thumbnailHeight: null,
    views: null,
    position: profile.showcase.length,
  };
  profile.showcase = [...profile.showcase, item];
  return item;
});

route('DELETE', '/me/influencer-profile/showcase/:id', ({ params }) => {
  const profile = influencerById(requireProfileId(currentUser()));
  const before = profile.showcase.length;
  profile.showcase = profile.showcase
    .filter((item) => item.id !== params[0])
    .map((item, index) => ({ ...item, position: index }));
  if (profile.showcase.length === before) {
    throw new DemoError(404, 'not_found', 'Inlägget hittades inte.');
  }
  return { deleted: true };
});

// Demoläget har ingen server att lagra bilder i. Bilden stannar i
// webbläsaren som en data-URL, vilket ser likadant ut för resten av appen.
route('POST', '/media', ({ body }) => {
  const mimeType = String(body.mimeType ?? 'image/jpeg');
  const data = String(body.data ?? '');
  if (data.length === 0) throw new DemoError(400, 'bad_request', 'Bilden gick inte att läsa.');
  return {
    url: `data:${mimeType};base64,${data}`,
    width: typeof body.width === 'number' ? body.width : null,
    height: typeof body.height === 'number' ? body.height : null,
  };
});

route('GET', '/me/business-profile', () => {
  const user = currentUser();
  const business = state.businesses.find((item) => item.id === user.profileId);
  if (!business) throw new DemoError(404, 'not_found', 'Företagsprofilen hittades inte.');
  return {
    id: business.id,
    companyName: business.companyName,
    orgNumber: business.orgNumber,
    city: business.city,
    address: business.address,
    description: business.description,
    logoUrl: business.logoUrl,
    photos: business.photos,
    categories: business.categories,
    websiteUrl: business.websiteUrl,
    socials: business.socials,
  };
});

route('PUT', '/me/business-profile', ({ body }) => {
  const user = currentUser();
  const existing = user.profileId ? state.businesses.find((item) => item.id === user.profileId) : undefined;
  const business: DemoBusiness = {
    id: existing?.id ?? nextId('biz'),
    userId: user.id,
    companyName: String(body.companyName ?? ''),
    orgNumber: String(body.orgNumber ?? ''),
    city: String(body.city ?? ''),
    address: String(body.address ?? ''),
    description: String(body.description ?? ''),
    logoUrl: typeof body.logoUrl === 'string' ? body.logoUrl : null,
    photos: Array.isArray(body.photos) ? (body.photos as string[]) : [],
    categories: (body.categories as Category[]) ?? [],
    websiteUrl: typeof body.websiteUrl === 'string' ? body.websiteUrl : null,
    socials: Array.isArray(body.socials)
      ? (body.socials as { platform: Platform; handle: string }[])
      : [],
  };
  state.businesses = [...state.businesses.filter((item) => item.id !== business.id), business];
  user.profileId = business.id;
  user.onboardingComplete = true;
  return { profile: { id: business.id }, accessToken: `demo-token-${user.id}` };
});

route('GET', '/me/payouts/status', () => {
  const profile = influencerById(requireProfileId(currentUser()));
  const mine = state.contracts.filter((contract) => contract.influencerId === profile.id);
  const sum = (status: Contract['paymentStatus']) =>
    mine
      .filter((contract) => contract.paymentStatus === status)
      .reduce((total, contract) => total + splitFee(contract.fee, feeSplitOf(contract)).net, 0);

  return {
    connected: profile.stripeAccountId !== null,
    payoutsEnabled: profile.payoutsEnabled,
    pendingPayout: sum('ESCROWED'),
    paidOut: sum('RELEASED'),
  };
});

route('POST', '/me/payouts/onboarding', () => {
  const profile = influencerById(requireProfileId(currentUser()));
  profile.stripeAccountId ??= `acct_demo_${profile.id}`;
  profile.payoutsEnabled = true;
  return { accountId: profile.stripeAccountId, onboardingUrl: '' };
});

// Kampanjer -------------------------------------------------------------------

route('GET', '/campaigns/mine', () => {
  const businessId = requireProfileId(currentUser());
  return state.campaigns
    .filter((campaign) => campaign.businessId === businessId)
    .map(publicCampaign);
});

route('POST', '/campaigns/draft', ({ body }) => {
  // Utan Claude gissar demon utifrån nyckelord i texten.
  const prompt = String(body.prompt ?? '').toLowerCase();
  const cafe = /kaffe|bageri|bröd|fika|kafé|cafe/.test(prompt);
  const bar = /bar|cocktail|afterwork|drink/.test(prompt);
  const fine = /fine dining|smakmeny|meny i flera rätter|gourmet/.test(prompt);

  return {
    available: true,
    draft: {
      title: cafe ? 'Visa upp vårt fik' : bar ? 'Afterwork hos oss' : 'Prova vår meny',
      brief:
        'Du kommer förbi vid ett tillfälle som passar dig, äter på vår bekostnad och gör innehåll som visar maten och stämningen. Ta gärna med öppettider och var vi ligger. Materialet ska märkas som reklam.',
      categories: cafe ? ['CAFE', 'BAGERI'] : bar ? ['BAR', 'NOJE'] : ['RESTAURANG', 'MAT_OCH_DRYCK'],
      platforms: ['TIKTOK', 'INSTAGRAM'],
      deliverables: ['TIKTOK_VIDEO', 'INSTAGRAM_STORY'],
      compensationType: fine ? 'HYBRID' : 'HYBRID',
      budgetPerCreator: fine ? 1_200_000 : 350_000,
      productValue: fine ? 240_000 : 30_000,
      slots: 3,
      minFollowers: fine ? 30_000 : 5_000,
      rationale:
        'Demoläge: förslaget är en enkel gissning utifrån din text. Med en Claude-nyckel skrivs brief och budget om utifrån just din restaurang.',
    },
  };
});

route('POST', '/campaigns', ({ body }) => {
  const businessId = requireProfileId(currentUser());
  const campaign: DemoCampaign = {
    id: nextId('cmp'),
    businessId,
    title: String(body.title ?? ''),
    brief: String(body.brief ?? ''),
    categories: (body.categories as Category[]) ?? [],
    platforms: (body.platforms as Platform[]) ?? [],
    deliverables: (body.deliverables as DeliverableKind[]) ?? [],
    compensationType: (body.compensationType as DemoCampaign['compensationType']) ?? 'HYBRID',
    budgetPerCreator: Number(body.budgetPerCreator ?? 0),
    productValue: Number(body.productValue ?? 0),
    slots: Number(body.slots ?? 1),
    city: String(body.city ?? ''),
    minFollowers: Number(body.minFollowers ?? 0),
    imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : null,
    startDate: String(body.startDate ?? new Date().toISOString()),
    endDate: String(body.endDate ?? new Date().toISOString()),
    status: 'DRAFT',
  };
  state.campaigns.push(campaign);
  return publicCampaign(campaign);
});

route('PATCH', '/campaigns/:id', ({ params, body }) => {
  const campaign = campaignById(params[0]!);
  campaign.title = String(body.title ?? campaign.title);
  campaign.brief = String(body.brief ?? campaign.brief);
  campaign.city = String(body.city ?? campaign.city);
  campaign.slots = Number(body.slots ?? campaign.slots);
  campaign.minFollowers = Number(body.minFollowers ?? campaign.minFollowers);
  campaign.budgetPerCreator = Number(body.budgetPerCreator ?? campaign.budgetPerCreator);
  campaign.productValue = Number(body.productValue ?? campaign.productValue);
  campaign.imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl : null;
  return publicCampaign(campaign);
});

route('GET', '/campaigns/:id', ({ params }) => publicCampaign(campaignById(params[0]!)));

route('POST', '/campaigns/:id/publish', ({ params }) => {
  const campaign = campaignById(params[0]!);
  campaign.status = 'ACTIVE';
  return publicCampaign(campaign);
});

route('POST', '/campaigns/:id/status', ({ params, body }) => {
  const campaign = campaignById(params[0]!);
  campaign.status = body.status as DemoCampaign['status'];
  return publicCampaign(campaign);
});

route('GET', '/campaigns/:id/applications', ({ params }) =>
  state.applications
    .filter((application) => application.campaignId === params[0])
    .map((application) => {
      const influencer = influencerById(application.influencerId);
      return {
        id: application.id,
        status: application.status,
        pitch: application.pitch,
        proposedFee: application.proposedFee,
        createdAt: application.createdAt,
        influencer: {
          id: influencer.id,
          displayName: influencer.displayName,
          avatarUrl: influencer.avatarUrl,
          city: influencer.city,
        },
      };
    }),
);

route('POST', '/applications/:id/decision', ({ params, body }) => {
  const application = state.applications.find((item) => item.id === params[0]);
  if (!application) throw new DemoError(404, 'not_found', 'Ansökan hittades inte.');
  const accept = body.accept === true;

  const match = recordSwipe({
    campaignId: application.campaignId,
    influencerId: application.influencerId,
    actor: 'BUSINESS',
    direction: accept ? 'LIKE' : 'PASS',
  });
  application.status = accept ? 'ACCEPTED' : 'REJECTED';
  return { status: application.status, matchId: match?.id ?? null };
});

// Flöden och swipes -----------------------------------------------------------

route('GET', '/feed/campaigns', () => {
  const profile = influencerById(requireProfileId(currentUser()));
  const candidate = toInfluencerCandidate(profile);

  const available = state.campaigns.filter(
    (campaign) =>
      campaign.status === 'ACTIVE' &&
      new Date(campaign.endDate).getTime() >= Date.now() &&
      slotsFilled(campaign.id) < campaign.slots &&
      !state.swipes.some(
        (swipe) =>
          swipe.campaignId === campaign.id &&
          swipe.influencerId === profile.id &&
          swipe.actor === 'INFLUENCER',
      ) &&
      checkEligibility(toCampaignCandidate(campaign), candidate).eligible,
  );

  return rankCampaigns(candidate, available.map(toCampaignCandidate)).map((entry) => {
    const campaign = campaignById(entry.campaign.id);
    return {
      score: entry.score.total,
      reason: entry.score.reasons[0] ?? 'Passar din nisch och räckvidd',
      aiReviewed: false,
      rating: ratingFor('BUSINESS', campaign.businessId),
      campaign: publicCampaign(campaign),
    };
  });
});

route('GET', '/feed/pending', () => {
  const influencerId = requireProfileId(currentUser());
  return state.swipes
    .filter(
      (swipe) =>
        swipe.influencerId === influencerId &&
        swipe.actor === 'INFLUENCER' &&
        swipe.direction === 'LIKE' &&
        !state.matches.some(
          (match) => match.campaignId === swipe.campaignId && match.influencerId === influencerId,
        ),
    )
    .map((swipe) => {
      const campaign = campaignById(swipe.campaignId);
      const business = businessById(campaign.businessId);
      return {
        campaignId: campaign.id,
        title: campaign.title,
        businessName: business.companyName,
        businessLogoUrl: business.logoUrl,
        budgetPerCreator: campaign.budgetPerCreator,
        likedAt: new Date().toISOString(),
      };
    });
});

route('GET', '/feed/influencers', ({ query }) => {
  const campaign = campaignById(query.get('campaignId') ?? '');
  const candidate = toCampaignCandidate(campaign);

  const available = state.influencers.filter(
    (profile) =>
      profile.socials.length > 0 &&
      !state.swipes.some(
        (swipe) =>
          swipe.campaignId === campaign.id &&
          swipe.influencerId === profile.id &&
          swipe.actor === 'BUSINESS',
      ) &&
      checkEligibility(candidate, toInfluencerCandidate(profile)).eligible,
  );

  return rankInfluencers(candidate, available.map(toInfluencerCandidate)).map((entry) => {
    const profile = influencerById(entry.influencer.id);
    return {
      score: entry.score.total,
      reason: entry.score.reasons[0] ?? 'Matchar kampanjens krav',
      aiReviewed: false,
      rating: ratingFor('INFLUENCER', profile.id),
      influencer: {
        id: profile.id,
        displayName: profile.displayName,
        bio: profile.bio,
        city: profile.city,
        avatarUrl: profile.avatarUrl,
        categories: profile.categories,
        platforms: entry.influencer.platforms,
        followers: entry.influencer.followers,
        avgViews: entry.influencer.avgViews,
        engagementRate: entry.influencer.engagementRate,
        priceTarget: entry.influencer.priceTarget,
        showcase: [...profile.showcase]
          .sort((a, b) => a.position - b.position)
          .slice(0, 3)
          .map((item) => ({
            id: item.id,
            platform: item.platform,
            url: item.url,
            thumbnailUrl: item.thumbnailUrl,
          })),
      },
    };
  });
});

route('POST', '/swipes', ({ body }) => {
  const user = currentUser();
  const profileId = requireProfileId(user);
  const influencerId =
    user.role === 'INFLUENCER' ? profileId : String(body.influencerId ?? '');

  const match = recordSwipe({
    campaignId: String(body.campaignId ?? ''),
    influencerId,
    actor: user.role,
    direction: body.direction === 'LIKE' ? 'LIKE' : 'PASS',
  });

  return {
    recorded: true,
    match: match
      ? {
          id: match.id,
          campaignId: match.campaignId,
          influencerId: match.influencerId,
          matchScore: match.matchScore,
          matchReason: match.matchReason,
        }
      : null,
  };
});

// Matchningar och meddelanden --------------------------------------------------

route('GET', '/matches', () => {
  const user = currentUser();
  const profileId = requireProfileId(user);
  return state.matches
    .filter((match) =>
      user.role === 'INFLUENCER'
        ? match.influencerId === profileId
        : campaignById(match.campaignId).businessId === profileId,
    )
    .map((match) => publicMatch(match, user.role));
});

route('GET', '/matches/:id/messages', ({ params }) =>
  state.messages.filter((message) => message.matchId === params[0]),
);

route('POST', '/matches/:id/messages', ({ params, body }) => {
  const user = currentUser();
  const match = state.matches.find((item) => item.id === params[0]);
  if (!match) throw new DemoError(404, 'not_found', 'Matchningen hittades inte.');
  if (match.status === 'NEW') match.status = 'IN_CONVERSATION';

  const message: Message = {
    id: nextId('msg'),
    matchId: match.id,
    senderId: user.id,
    senderName: user.name,
    body: String(body.body ?? ''),
    createdAt: new Date().toISOString(),
  };
  state.messages.push(message);
  return message;
});

// Avtal och betalning ----------------------------------------------------------

route('POST', '/contracts', ({ body }) => {
  const user = currentUser();
  const match = state.matches.find((item) => item.id === body.matchId);
  if (!match) throw new DemoError(404, 'not_found', 'Matchningen hittades inte.');
  if (state.contracts.some((item) => item.matchId === match.id && item.status !== 'CANCELLED')) {
    throw new DemoError(400, 'bad_request', 'Det finns redan ett avtal för matchningen.');
  }

  const campaign = campaignById(match.campaignId);
  const business = businessById(campaign.businessId);
  const influencer = influencerById(match.influencerId);
  const influencerUser = state.users.find((item) => item.id === influencer.userId);
  const contractId = nextId('ctr');
  const deliverables = (body.deliverables as DeliverableKind[]) ?? campaign.deliverables;

  const contract: Contract = {
    id: contractId,
    matchId: match.id,
    campaignId: campaign.id,
    influencerId: influencer.id,
    status: 'SENT',
    fee: Number(body.fee ?? campaign.budgetPerCreator),
    ...FEE_SPLIT,
    deliverables,
    dueDate: String(body.dueDate ?? new Date().toISOString()),
    reviewDays: Number(body.reviewDays ?? 7),
    terms: renderContractTerms({
      contractId,
      businessName: business.companyName,
      businessOrgNumber: business.orgNumber,
      influencerName: influencer.displayName,
      influencerPersonalNumberMask: influencerUser?.personalNumberMask ?? 'okänt',
      campaignTitle: campaign.title,
      campaignBrief: campaign.brief,
      deliverables,
      fee: Number(body.fee ?? campaign.budgetPerCreator),
      feeSplit: FEE_SPLIT,
      dueDate: new Date(String(body.dueDate ?? new Date().toISOString())),
      reviewDays: Number(body.reviewDays ?? 7),
      extraTerms: String(body.extraTerms ?? ''),
      businessAccounts: business.socials,
    }),
    signedByInfluencerAt: null,
    signedByBusinessAt: null,
    deliveredAt: null,
    completedAt: null,
    paymentStatus: null,
  };
  state.contracts.push(contract);
  match.status = 'CONTRACTED';
  return publicContract(contract, user.role);
});

route('GET', '/contracts', () => {
  const user = currentUser();
  const profileId = requireProfileId(user);
  return state.contracts
    .filter((contract) =>
      user.role === 'INFLUENCER'
        ? contract.influencerId === profileId
        : campaignById(contract.campaignId).businessId === profileId,
    )
    .map((contract) => publicContract(contract, user.role));
});

route('GET', '/contracts/:id', ({ params }) => {
  const contract = contractById(params[0]!);
  return publicContract(contract, currentUser().role);
});

route('POST', '/contracts/:id/payment', ({ params }) => {
  const contract = contractById(params[0]!);
  if (contract.status !== 'ACTIVE') {
    throw new DemoError(400, 'bad_request', 'Avtalet måste vara signerat av båda parter.');
  }
  // I demoläget bekräftas betalningen direkt; i skarpt läge sker det via Stripe.
  contract.paymentStatus = 'ESCROWED';
  return { clientSecret: 'demo', amount: contract.fee, paymentId: nextId('pay') };
});

route('POST', '/contracts/:id/delivery', ({ params }) => {
  const contract = contractById(params[0]!);
  if (contract.status !== 'ACTIVE') {
    throw new DemoError(400, 'bad_request', 'Avtalet är inte aktivt.');
  }
  contract.status = 'DELIVERED';
  contract.deliveredAt = new Date().toISOString();
  return publicContract(contract, currentUser().role);
});

route('POST', '/contracts/:id/approve', ({ params }) => {
  const contract = contractById(params[0]!);
  if (contract.status !== 'DELIVERED') {
    throw new DemoError(400, 'bad_request', 'Det finns ingen leverans att godkänna.');
  }
  if (contract.paymentStatus !== 'ESCROWED') {
    throw new DemoError(400, 'bad_request', 'Arvodet är inte inbetalt ännu.');
  }
  contract.status = 'COMPLETED';
  contract.completedAt = new Date().toISOString();
  contract.paymentStatus = 'RELEASED';
  return { status: contract.status, payout: splitFee(contract.fee, feeSplitOf(contract)).net };
});

// Omdömen ---------------------------------------------------------------------

route('GET', '/contracts/:id/reviews', ({ params }) => {
  const user = currentUser();
  const contract = contractById(params[0]!);
  assertContractParty(contract, user);

  const mine = state.reviews.find(
    (review) => review.contractId === contract.id && review.authorRole === user.role,
  );
  const theirs = state.reviews.find(
    (review) => review.contractId === contract.id && review.authorRole !== user.role,
  );
  const theirsVisible = theirs !== undefined && isPublished(theirs);

  const eligibility = checkReviewEligibility({
    status: contract.status,
    completedAt: contract.completedAt ? new Date(contract.completedAt) : null,
    alreadyReviewed: mine !== undefined,
  });

  return {
    canReview: eligibility.allowed,
    reason: eligibility.reason ?? null,
    daysLeft: contract.completedAt ? daysLeftToReview(new Date(contract.completedAt)) : 0,
    mine: mine ? publicReview(mine) : null,
    theirs: theirsVisible && theirs ? publicReview(theirs) : null,
    theirsPending: theirs !== undefined && !theirsVisible,
  };
});

route('POST', '/contracts/:id/reviews', ({ params, body }) => {
  const user = currentUser();
  const contract = contractById(params[0]!);
  assertContractParty(contract, user);

  const already = state.reviews.some(
    (review) => review.contractId === contract.id && review.authorRole === user.role,
  );
  const eligibility = checkReviewEligibility({
    status: contract.status,
    completedAt: contract.completedAt ? new Date(contract.completedAt) : null,
    alreadyReviewed: already,
  });
  if (!eligibility.allowed) {
    throw new DemoError(400, 'bad_request', eligibility.reason ?? 'Omdömet går inte att lämna.');
  }

  const scores = body.scores as ReviewScores;
  const campaign = campaignById(contract.campaignId);
  const completedAt = new Date(contract.completedAt as string);
  const now = new Date().toISOString();
  const counterpart = state.reviews.find(
    (review) => review.contractId === contract.id && review.authorRole !== user.role,
  );

  const review: DemoReview = {
    id: nextId('rev'),
    contractId: contract.id,
    campaignTitle: campaign.title,
    authorRole: user.role,
    authorName: user.name,
    influencerId: contract.influencerId,
    businessId: campaign.businessId,
    scores,
    comment: String(body.comment ?? ''),
    createdAt: now,
    // Har motparten redan skrivit blir båda synliga i samma stund.
    publishedAt: counterpart ? now : null,
    visibleAt: reviewDeadline(completedAt).toISOString(),
  };
  state.reviews.push(review);
  if (counterpart) counterpart.publishedAt = now;

  return publicReview(review);
});

route('GET', '/influencers/:id/reviews', ({ params }) => profileReviews('INFLUENCER', params[0]!));
route('GET', '/businesses/:id/reviews', ({ params }) => profileReviews('BUSINESS', params[0]!));

route('GET', '/reviews/pending', () => {
  const user = currentUser();
  const profileId = requireProfileId(user);
  return state.contracts
    .filter((contract) => {
      if (contract.status !== 'COMPLETED' || !contract.completedAt) return false;
      const mine = campaignById(contract.campaignId);
      const isParty =
        user.role === 'INFLUENCER'
          ? contract.influencerId === profileId
          : mine.businessId === profileId;
      const written = state.reviews.some(
        (review) => review.contractId === contract.id && review.authorRole === user.role,
      );
      return isParty && !written && daysLeftToReview(new Date(contract.completedAt)) > 0;
    })
    .map((contract) => {
      const campaign = campaignById(contract.campaignId);
      return {
        contractId: contract.id,
        campaignTitle: campaign.title,
        counterpartName:
          user.role === 'INFLUENCER'
            ? businessById(campaign.businessId).companyName
            : influencerById(contract.influencerId).displayName,
        completedAt: contract.completedAt as string,
        daysLeft: daysLeftToReview(new Date(contract.completedAt as string)),
      };
    });
});

function profileReviews(subject: 'INFLUENCER' | 'BUSINESS', profileId: string) {
  const authorRole = subject === 'INFLUENCER' ? 'BUSINESS' : 'INFLUENCER';
  const reviews = state.reviews
    .filter(
      (review) =>
        review.authorRole === authorRole &&
        isPublished(review) &&
        (subject === 'INFLUENCER' ? review.influencerId : review.businessId) === profileId,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    summary: reviews.length
      ? summarizeRatings(reviews.map((review) => overallRating(review.scores)))
      : emptyRatingSummary(),
    reviews: reviews.map(publicReview),
  };
}

/** Kastar om den inloggade inte var part i avtalet. */
function assertContractParty(contract: Contract, user: DemoUser): void {
  const profileId = requireProfileId(user);
  const isParty =
    user.role === 'INFLUENCER'
      ? contract.influencerId === profileId
      : campaignById(contract.campaignId).businessId === profileId;
  if (!isParty) throw new DemoError(403, 'forbidden', 'Du var inte part i det här samarbetet.');
}

function contractById(id: string): Contract {
  const contract = state.contracts.find((item) => item.id === id);
  if (!contract) throw new DemoError(404, 'not_found', 'Avtalet hittades inte.');
  return contract;
}

/** Signerar för den inloggade parten och aktiverar avtalet när båda skrivit på. */
function signContract(contractId: string | undefined): void {
  if (!contractId) throw new DemoError(400, 'bad_request', 'Signeringen saknar avtal.');
  const contract = contractById(contractId);
  const user = currentUser();
  const now = new Date().toISOString();

  if (user.role === 'INFLUENCER') contract.signedByInfluencerAt ??= now;
  else contract.signedByBusinessAt ??= now;

  contract.status =
    contract.signedByInfluencerAt && contract.signedByBusinessAt ? 'ACTIVE' : 'PARTIALLY_SIGNED';
}

/** Nätverkslatens på låtsas, så att laddningslägen syns som i skarp drift. */
const DEMO_LATENCY_MS = 140;

export async function handleDemoRequest(
  method: string,
  path: string,
  body: unknown,
  accessToken?: string | null,
): Promise<unknown> {
  await new Promise((resolve) => setTimeout(resolve, DEMO_LATENCY_MS));

  // Efter en omladdning finns tokenen kvar men inte sessionen – återskapa den.
  if (!state.sessionUserId && accessToken?.startsWith('demo-token-')) {
    const userId = accessToken.slice('demo-token-'.length);
    if (state.users.some((user) => user.id === userId)) state.sessionUserId = userId;
  }

  const [pathname, search] = path.split('?');
  const query = new URLSearchParams(search ?? '');

  for (const candidate of routes) {
    if (candidate.method !== method) continue;
    const match = candidate.pattern.exec(pathname ?? '');
    if (!match) continue;
    const result = candidate.handle({
      body: (body as Record<string, unknown>) ?? {},
      query,
      params: match.slice(1),
    });
    // Även GET kan ändra tillståndet: en klar BankID-order signerar avtalet.
    persist();
    return result;
  }

  throw new DemoError(404, 'not_found', `Slutpunkten ${method} ${pathname} finns inte i demoläget.`);
}
