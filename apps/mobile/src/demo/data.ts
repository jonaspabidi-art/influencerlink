import type { Category, DeliverableKind, Platform } from '@pacta/shared';

/**
 * Demodata som speglar prisma/seed.ts, men körs helt i appen. Används när
 * appen startas utan backend så att hela flödet går att klicka igenom.
 */

export interface DemoSocial {
  id: string;
  platform: Platform;
  handle: string;
  followers: number;
  avgViews: number;
  engagementRate: number;
  verified: boolean;
}

export interface DemoShowcase {
  id: string;
  platform: Platform;
  url: string;
  postId: string | null;
  title: string;
  authorName: string;
  thumbnailUrl: string | null;
  thumbnailWidth: number | null;
  thumbnailHeight: number | null;
  views: number | null;
  position: number;
}

export interface DemoInfluencer {
  id: string;
  userId: string;
  displayName: string;
  bio: string;
  city: string;
  avatarUrl: string | null;
  categories: Category[];
  priceMin: number;
  priceTarget: number;
  payoutsEnabled: boolean;
  stripeAccountId: string | null;
  socials: DemoSocial[];
  showcase: DemoShowcase[];
}

export interface DemoBusiness {
  id: string;
  userId: string;
  companyName: string;
  orgNumber: string;
  city: string;
  address: string;
  description: string;
  logoUrl: string | null;
  photos: string[];
  categories: Category[];
}

export interface DemoUser {
  id: string;
  name: string;
  role: 'INFLUENCER' | 'BUSINESS';
  personalNumberMask: string;
  onboardingComplete: boolean;
  profileId: string | null;
}

export interface DemoCampaign {
  id: string;
  businessId: string;
  title: string;
  brief: string;
  categories: Category[];
  platforms: Platform[];
  deliverables: DeliverableKind[];
  compensationType: 'FIXED' | 'PRODUCT' | 'HYBRID';
  budgetPerCreator: number;
  productValue: number;
  slots: number;
  city: string;
  minFollowers: number;
  imageUrl: string | null;
  startDate: string;
  endDate: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'CLOSED';
}

const kr = (kronor: number) => kronor * 100;
const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

export const DEMO_INFLUENCERS: DemoInfluencer[] = [
  {
    id: 'inf_anna',
    userId: 'usr_anna',
    displayName: 'annaäter',
    bio: 'Testar Göteborgs lunchställen varje vardag. Kort, snabbt, ärligt. Publiken är 25–40 år och bor i stan.',
    city: 'Göteborg',
    avatarUrl: null,
    categories: ['RESTAURANG', 'MAT_OCH_DRYCK', 'LIVSSTIL'],
    priceMin: kr(2_000),
    priceTarget: kr(4_500),
    payoutsEnabled: true,
    stripeAccountId: 'acct_demo_anna',
    socials: [
      { id: 'soc_anna_tt', platform: 'TIKTOK', handle: 'annaater', followers: 48_000, avgViews: 39_000, engagementRate: 0.071, verified: false },
      { id: 'soc_anna_ig', platform: 'INSTAGRAM', handle: 'annaater', followers: 21_000, avgViews: 9_000, engagementRate: 0.048, verified: false },
    ],
    // Miniatyrerna hämtas från plattformen i skarpt läge. I demoläget finns
    // ingen uppkoppling, så korten visar titel och plattform i stället.
    showcase: [
      { id: 'shw_anna_1', platform: 'TIKTOK', url: 'https://www.tiktok.com/@annaater/video/7300000000000000001', postId: '7300000000000000001', title: 'Dagens lunch för under 130 kr', authorName: 'annaater', thumbnailUrl: null, thumbnailWidth: null, thumbnailHeight: null, views: 42_000, position: 0 },
      { id: 'shw_anna_2', platform: 'TIKTOK', url: 'https://www.tiktok.com/@annaater/video/7300000000000000002', postId: '7300000000000000002', title: 'Tre nyöppnade ställen i Haga', authorName: 'annaater', thumbnailUrl: null, thumbnailWidth: null, thumbnailHeight: null, views: 18_500, position: 1 },
    ],
  },
  {
    id: 'inf_erik',
    userId: 'usr_erik',
    displayName: 'Kocken Erik',
    bio: 'Utbildad kock som recenserar fine dining och nya öppningar. Långa format med fokus på hantverket i köket.',
    city: 'Göteborg',
    avatarUrl: null,
    categories: ['FINE_DINING', 'RESTAURANG'],
    priceMin: kr(5_000),
    priceTarget: kr(12_000),
    payoutsEnabled: true,
    stripeAccountId: 'acct_demo_erik',
    socials: [
      { id: 'soc_erik_ig', platform: 'INSTAGRAM', handle: 'kockenerik', followers: 96_000, avgViews: 41_000, engagementRate: 0.032, verified: true },
      { id: 'soc_erik_yt', platform: 'YOUTUBE', handle: 'kockenerik', followers: 34_000, avgViews: 22_000, engagementRate: 0.041, verified: false },
    ],
    showcase: [],
  },
  {
    id: 'inf_sara',
    userId: 'usr_sara',
    displayName: 'saraiskafferiet',
    bio: 'Kaféhäng, bakverk och studieplatser med bra kaffe. Liten men väldigt aktiv publik i Göteborg.',
    city: 'Göteborg',
    avatarUrl: null,
    categories: ['CAFE', 'BAGERI', 'LIVSSTIL'],
    priceMin: kr(1_200),
    priceTarget: kr(2_800),
    payoutsEnabled: false,
    stripeAccountId: null,
    socials: [
      { id: 'soc_sara_tt', platform: 'TIKTOK', handle: 'saraiskafferiet', followers: 14_500, avgViews: 18_000, engagementRate: 0.093, verified: false },
    ],
    showcase: [],
  },
  {
    id: 'inf_johan',
    userId: 'usr_johan',
    displayName: 'gbgstreetfood',
    bio: 'Street food, food trucks och sena kvällsmackor. Snabba klipp med hög visningsgrad.',
    city: 'Göteborg',
    avatarUrl: null,
    categories: ['STREET_FOOD', 'MAT_OCH_DRYCK'],
    priceMin: kr(1_500),
    priceTarget: kr(3_500),
    payoutsEnabled: true,
    stripeAccountId: 'acct_demo_johan',
    socials: [
      { id: 'soc_johan_tt', platform: 'TIKTOK', handle: 'gbgstreetfood', followers: 62_000, avgViews: 55_000, engagementRate: 0.065, verified: true },
      { id: 'soc_johan_ig', platform: 'INSTAGRAM', handle: 'gbgstreetfood', followers: 18_000, avgViews: 7_500, engagementRate: 0.039, verified: false },
    ],
    showcase: [
      { id: 'shw_johan_1', platform: 'TIKTOK', url: 'https://www.tiktok.com/@gbgstreetfood/video/7300000000000000010', postId: '7300000000000000010', title: 'Bästa kebabpizzan efter midnatt', authorName: 'gbgstreetfood', thumbnailUrl: null, thumbnailWidth: null, thumbnailHeight: null, views: 42_000, position: 0 },
    ],
  },
  {
    id: 'inf_maja',
    userId: 'usr_maja',
    displayName: 'majagront',
    bio: 'Vegetariskt och veganskt i Stockholm. Recept och restaurangtips till en matlagningsintresserad publik.',
    city: 'Stockholm',
    avatarUrl: null,
    categories: ['VEGETARISKT', 'MAT_OCH_DRYCK'],
    priceMin: kr(3_000),
    priceTarget: kr(7_000),
    payoutsEnabled: true,
    stripeAccountId: 'acct_demo_maja',
    socials: [
      { id: 'soc_maja_ig', platform: 'INSTAGRAM', handle: 'majagront', followers: 71_000, avgViews: 28_000, engagementRate: 0.044, verified: true },
    ],
    showcase: [],
  },
  {
    id: 'inf_oskar',
    userId: 'usr_oskar',
    displayName: 'oskarpakrogen',
    bio: 'Barer, cocktails och afterwork i Göteborg. 21+ och mycket helgtrafik.',
    city: 'Göteborg',
    avatarUrl: null,
    categories: ['BAR', 'NOJE'],
    priceMin: kr(2_500),
    priceTarget: kr(5_500),
    payoutsEnabled: false,
    stripeAccountId: null,
    socials: [
      { id: 'soc_oskar_tt', platform: 'TIKTOK', handle: 'oskarpakrogen', followers: 29_000, avgViews: 24_000, engagementRate: 0.058, verified: false },
    ],
    showcase: [],
  },
];

export const DEMO_BUSINESSES: DemoBusiness[] = [
  {
    id: 'biz_kajutan',
    userId: 'usr_petra',
    companyName: 'Restaurang Kajutan',
    orgNumber: '5560123456',
    city: 'Göteborg',
    address: 'Kungsportsavenyen 12, 411 36 Göteborg',
    description: 'Västkustkök med råvaror från Fiskhamnen. 60 sittplatser.',
    logoUrl: null,
    photos: [],
    categories: ['RESTAURANG', 'FINE_DINING'],
  },
  {
    id: 'biz_solrosen',
    userId: 'usr_ali',
    companyName: 'Bageri Solrosen',
    orgNumber: '5569876543',
    city: 'Göteborg',
    address: 'Andra Långgatan 4, 413 03 Göteborg',
    description: 'Surdegsbageri och kafé i Linné. Öppnar 07 varje dag.',
    logoUrl: null,
    photos: [],
    categories: ['BAGERI', 'CAFE'],
  },
];

export const DEMO_USERS: DemoUser[] = [
  { id: 'usr_anna', name: 'Anna Karlsson', role: 'INFLUENCER', personalNumberMask: '19920315-****', onboardingComplete: true, profileId: 'inf_anna' },
  { id: 'usr_erik', name: 'Erik Lindberg', role: 'INFLUENCER', personalNumberMask: '19880722-****', onboardingComplete: true, profileId: 'inf_erik' },
  { id: 'usr_sara', name: 'Sara Nyström', role: 'INFLUENCER', personalNumberMask: '19991102-****', onboardingComplete: true, profileId: 'inf_sara' },
  { id: 'usr_johan', name: 'Johan Bergqvist', role: 'INFLUENCER', personalNumberMask: '19950530-****', onboardingComplete: true, profileId: 'inf_johan' },
  { id: 'usr_maja', name: 'Maja Öberg', role: 'INFLUENCER', personalNumberMask: '19940117-****', onboardingComplete: true, profileId: 'inf_maja' },
  { id: 'usr_oskar', name: 'Oskar Holm', role: 'INFLUENCER', personalNumberMask: '20010228-****', onboardingComplete: true, profileId: 'inf_oskar' },
  { id: 'usr_petra', name: 'Petra Sandell', role: 'BUSINESS', personalNumberMask: '19700101-****', onboardingComplete: true, profileId: 'biz_kajutan' },
  { id: 'usr_ali', name: 'Ali Rahimi', role: 'BUSINESS', personalNumberMask: '19801212-****', onboardingComplete: true, profileId: 'biz_solrosen' },
];

export const DEMO_CAMPAIGNS: DemoCampaign[] = [
  {
    id: 'cmp_lunch',
    businessId: 'biz_kajutan',
    title: 'Lansera vår nya lunchmeny',
    brief:
      'Vi byter till en ny lunchmeny med råvaror från Fiskhamnen. Du kommer förbi en vardag mellan 11 och 14, äter på vår bekostnad och gör innehåll som visar rätterna och stämningen i lokalen. Ta gärna med att lunchen kostar 145 kr inklusive kaffe.',
    categories: ['RESTAURANG', 'MAT_OCH_DRYCK'],
    platforms: ['TIKTOK', 'INSTAGRAM'],
    deliverables: ['TIKTOK_VIDEO', 'INSTAGRAM_STORY'],
    compensationType: 'HYBRID',
    budgetPerCreator: kr(4_000),
    productValue: kr(300),
    slots: 3,
    city: 'Göteborg',
    minFollowers: 10_000,
    startDate: daysFromNow(0),
    endDate: daysFromNow(60),
    imageUrl: null,
    status: 'ACTIVE',
  },
  {
    id: 'cmp_smakmeny',
    businessId: 'biz_kajutan',
    title: 'Smakmeny för matintresserade',
    brief:
      'Sexrättersmeny med dryckespaket för dig som gör innehåll om fine dining. Vi vill ha en längre film där du berättar om rätterna och köket, och ett inlägg i flödet.',
    categories: ['FINE_DINING', 'RESTAURANG'],
    platforms: ['YOUTUBE', 'INSTAGRAM'],
    deliverables: ['YOUTUBE_VIDEO', 'INSTAGRAM_POST'],
    compensationType: 'HYBRID',
    budgetPerCreator: kr(12_000),
    productValue: kr(2_400),
    slots: 1,
    city: 'Göteborg',
    minFollowers: 30_000,
    startDate: daysFromNow(0),
    endDate: daysFromNow(60),
    imageUrl: null,
    status: 'ACTIVE',
  },
  {
    id: 'cmp_morgonbrod',
    businessId: 'biz_solrosen',
    title: 'Morgonbröd och kaffe i Linné',
    brief:
      'Vi vill nå studenter och folk som jobbar hemifrån. Kom förbi på förmiddagen, visa surdegen och våra sittplatser. Nämn gärna att vi öppnar 07 varje dag.',
    categories: ['BAGERI', 'CAFE'],
    platforms: ['TIKTOK', 'INSTAGRAM'],
    deliverables: ['TIKTOK_VIDEO'],
    compensationType: 'PRODUCT',
    budgetPerCreator: 0,
    productValue: kr(400),
    slots: 5,
    city: 'Göteborg',
    minFollowers: 3_000,
    startDate: daysFromNow(0),
    endDate: daysFromNow(14),
    imageUrl: null,
    status: 'ACTIVE',
  },
  {
    id: 'cmp_afterwork',
    businessId: 'biz_kajutan',
    title: 'Afterwork med havsutsikt',
    brief:
      'Torsdagar 16–19 kör vi afterwork med tilltugg och dryckesspecial. Vi vill nå folk som jobbar i centrala Göteborg och letar efter något efter jobbet.',
    categories: ['BAR', 'NOJE'],
    platforms: ['TIKTOK', 'INSTAGRAM'],
    deliverables: ['TIKTOK_VIDEO', 'INSTAGRAM_STORY'],
    compensationType: 'HYBRID',
    budgetPerCreator: kr(3_000),
    productValue: kr(500),
    slots: 2,
    city: 'Göteborg',
    minFollowers: 8_000,
    startDate: daysFromNow(0),
    endDate: daysFromNow(45),
    imageUrl: null,
    status: 'ACTIVE',
  },
];

/** Ansökningar som redan väntar när restaurangen loggar in. */
export const DEMO_APPLICATIONS = [
  {
    id: 'app_sara',
    campaignId: 'cmp_lunch',
    influencerId: 'inf_sara',
    pitch:
      'Hej! Jag gör lunchtips varje vecka och mina tittare frågar ofta efter ställen nära Avenyn. Jag skulle filma rätterna i närbild och lägga upp både en TikTok och en story samma dag.',
    proposedFee: kr(3_000),
    status: 'PENDING' as const,
    createdAt: daysFromNow(-2),
  },
  {
    id: 'app_johan',
    campaignId: 'cmp_lunch',
    influencerId: 'inf_johan',
    pitch:
      'Jag har gjort liknande jobb för tre lunchställen i Göteborg. Snittet ligger på 55 000 visningar. Kan komma redan nästa vecka.',
    proposedFee: null,
    status: 'PENDING' as const,
    createdAt: daysFromNow(-1),
  },
];

export interface DemoReview {
  id: string;
  contractId: string;
  campaignTitle: string;
  /** Vem som skrev. Motsatt part är den som blir bedömd. */
  authorRole: 'INFLUENCER' | 'BUSINESS';
  authorName: string;
  influencerId: string;
  businessId: string;
  scores: { communication: number; asDescribed: number; again: number };
  comment: string;
  createdAt: string;
  publishedAt: string | null;
  visibleAt: string;
}

/**
 * Omdömen från samarbeten som redan är avslutade och utbetalda. Utan dem står
 * varje profil på noll och betygen syns aldrig i kortleken.
 *
 * Alla är publicerade: båda parter hann skriva innan fönstret gick ut.
 */
export const DEMO_REVIEWS: DemoReview[] = [
  review('rev_1', 'ctr_h1', 'Helgbrunch i Linné', 'BUSINESS', 'Ali Rahimi', 'inf_anna', 'biz_solrosen', [5, 5, 5],
    'Kom i tid, filmade utan att störa gästerna och la upp samma kväll. Vi märkte det direkt på lördagen efter.', -40),
  review('rev_2', 'ctr_h2', 'Ny kvällsmeny', 'BUSINESS', 'Petra Sandell', 'inf_anna', 'biz_kajutan', [5, 4, 5],
    'Bra kontakt hela vägen. Filmen blev något kortare än vi tänkt oss, men den gjorde jobbet.', -22),
  review('rev_3', 'ctr_h1', 'Helgbrunch i Linné', 'INFLUENCER', 'Anna Karlsson', 'inf_anna', 'biz_solrosen', [5, 5, 5],
    'Tydlig brief och allt var förberett när jag kom. Pengarna låg spärrade från start, det gör stor skillnad.', -40),
  review('rev_4', 'ctr_h3', 'Smakmeny i höst', 'BUSINESS', 'Petra Sandell', 'inf_erik', 'biz_kajutan', [4, 5, 5],
    'Kunnig och grundlig. Tog längre tid än vi räknat med, men resultatet var värt det.', -33),
  review('rev_5', 'ctr_h3', 'Smakmeny i höst', 'INFLUENCER', 'Erik Lindberg', 'inf_erik', 'biz_kajutan', [4, 4, 4],
    'Bra mat och trevligt bemötande. Briefen ändrades under tiden, vilket kostade en extra inspelningsdag.', -33),
  review('rev_6', 'ctr_h4', 'Morgonbröd', 'BUSINESS', 'Ali Rahimi', 'inf_sara', 'biz_solrosen', [5, 5, 5],
    'Sara känner våra gäster bättre än vi gör. Tredje gången vi jobbar ihop och det blir bättre varje gång.', -15),
  review('rev_7', 'ctr_h4', 'Morgonbröd', 'INFLUENCER', 'Sara Nyström', 'inf_sara', 'biz_solrosen', [5, 5, 5],
    'Enklaste samarbetet jag gjort. Snabba svar och betalningen kom fram samma dag som de godkände.', -15),
  review('rev_8', 'ctr_h5', 'Lunch på Avenyn', 'BUSINESS', 'Petra Sandell', 'inf_johan', 'biz_kajutan', [3, 4, 3],
    'Innehållet blev bra men det var svårt att få tag på honom under veckan före. Deadline höll knappt.', -11),
  review('rev_9', 'ctr_h6', 'Fikapaus', 'BUSINESS', 'Ali Rahimi', 'inf_maja', 'biz_solrosen', [5, 4, 5],
    'Väldigt lätt att jobba med. Vi bad om en story till och det fixade hon utan diskussion.', -8),
];

/** Kortform så att listan ovan går att läsa som en tabell. */
function review(
  id: string,
  contractId: string,
  campaignTitle: string,
  authorRole: 'INFLUENCER' | 'BUSINESS',
  authorName: string,
  influencerId: string,
  businessId: string,
  [communication, asDescribed, again]: [number, number, number],
  comment: string,
  daysAgo: number,
): DemoReview {
  const createdAt = daysFromNow(daysAgo);
  return {
    id,
    contractId,
    campaignTitle,
    authorRole,
    authorName,
    influencerId,
    businessId,
    scores: { communication, asDescribed, again },
    comment,
    createdAt,
    publishedAt: createdAt,
    visibleAt: createdAt,
  };
}
