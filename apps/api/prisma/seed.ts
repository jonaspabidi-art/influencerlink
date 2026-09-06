/**
 * Demodata för lokal utveckling: två restauranger, sex influencers med
 * kopplade konton, tre kampanjer och ett samarbete som redan hunnit bli
 * matchning. Kör med `npm run db:seed -w @pacta/api`.
 */
import { overallRating, renderContractTerms, reviewDeadline, splitFee } from '@pacta/shared';
import { PrismaClient, type Category, type Platform } from '@prisma/client';
import { createHmac } from 'node:crypto';

const prisma = new PrismaClient();

const hmacKey = process.env.PERSONAL_NUMBER_HMAC_KEY ?? '';
if (hmacKey.length < 32) {
  throw new Error('PERSONAL_NUMBER_HMAC_KEY måste vara satt (minst 32 tecken) innan seed körs.');
}

const hash = (personalNumber: string) =>
  createHmac('sha256', hmacKey).update(personalNumber).digest('hex');
const mask = (personalNumber: string) => `${personalNumber.slice(0, 8)}-****`;
const kr = (kronor: number) => kronor * 100;

interface InfluencerSeed {
  personalNumber: string;
  name: string;
  displayName: string;
  city: string;
  bio: string;
  categories: Category[];
  priceMin: number;
  priceTarget: number;
  accounts: Array<{
    platform: Platform;
    handle: string;
    followers: number;
    avgViews: number;
    engagementRate: number;
  }>;
}

const influencers: InfluencerSeed[] = [
  {
    personalNumber: '199203155566',
    name: 'Anna Karlsson',
    displayName: 'annaäter',
    city: 'Göteborg',
    bio: 'Testar Göteborgs lunchställen varje vardag. Kort, snabbt, ärligt.',
    categories: ['RESTAURANG', 'MAT_OCH_DRYCK', 'LIVSSTIL'],
    priceMin: kr(2_000),
    priceTarget: kr(4_500),
    accounts: [
      { platform: 'TIKTOK', handle: 'annaater', followers: 48_000, avgViews: 39_000, engagementRate: 0.071 },
      { platform: 'INSTAGRAM', handle: 'annaater', followers: 21_000, avgViews: 9_000, engagementRate: 0.048 },
    ],
  },
  {
    personalNumber: '198807221234',
    name: 'Erik Lindberg',
    displayName: 'Kocken Erik',
    city: 'Göteborg',
    bio: 'Utbildad kock som recenserar fine dining och nya öppningar.',
    categories: ['FINE_DINING', 'RESTAURANG'],
    priceMin: kr(5_000),
    priceTarget: kr(12_000),
    accounts: [
      { platform: 'INSTAGRAM', handle: 'kockenerik', followers: 96_000, avgViews: 41_000, engagementRate: 0.032 },
      { platform: 'YOUTUBE', handle: 'kockenerik', followers: 34_000, avgViews: 22_000, engagementRate: 0.041 },
    ],
  },
  {
    personalNumber: '199911024455',
    name: 'Sara Nyström',
    displayName: 'saraiskafferiet',
    city: 'Göteborg',
    bio: 'Kaféhäng, bakverk och studieplatser med bra kaffe.',
    categories: ['CAFE', 'BAGERI', 'LIVSSTIL'],
    priceMin: kr(1_200),
    priceTarget: kr(2_800),
    accounts: [
      { platform: 'TIKTOK', handle: 'saraiskafferiet', followers: 14_500, avgViews: 18_000, engagementRate: 0.093 },
    ],
  },
  {
    personalNumber: '199505308899',
    name: 'Johan Bergqvist',
    displayName: 'gbgstreetfood',
    city: 'Göteborg',
    bio: 'Street food, food trucks och sena kvällsmackor.',
    categories: ['STREET_FOOD', 'MAT_OCH_DRYCK'],
    priceMin: kr(1_500),
    priceTarget: kr(3_500),
    accounts: [
      { platform: 'TIKTOK', handle: 'gbgstreetfood', followers: 62_000, avgViews: 55_000, engagementRate: 0.065 },
      { platform: 'INSTAGRAM', handle: 'gbgstreetfood', followers: 18_000, avgViews: 7_500, engagementRate: 0.039 },
    ],
  },
  {
    personalNumber: '199401177788',
    name: 'Maja Öberg',
    displayName: 'majagront',
    city: 'Stockholm',
    bio: 'Vegetariskt och veganskt i Stockholm. Recept och restaurangtips.',
    categories: ['VEGETARISKT', 'MAT_OCH_DRYCK'],
    priceMin: kr(3_000),
    priceTarget: kr(7_000),
    accounts: [
      { platform: 'INSTAGRAM', handle: 'majagront', followers: 71_000, avgViews: 28_000, engagementRate: 0.044 },
    ],
  },
  {
    personalNumber: '200102283344',
    name: 'Oskar Holm',
    displayName: 'oskarpakrogen',
    city: 'Göteborg',
    bio: 'Barer, cocktails och afterwork. 21+.',
    categories: ['BAR', 'NOJE'],
    priceMin: kr(2_500),
    priceTarget: kr(5_500),
    accounts: [
      { platform: 'TIKTOK', handle: 'oskarpakrogen', followers: 29_000, avgViews: 24_000, engagementRate: 0.058 },
    ],
  },
];

const businesses = [
  {
    personalNumber: '197001019999',
    name: 'Petra Sandell',
    companyName: 'Restaurang Kajutan',
    orgNumber: '5560123456',
    city: 'Göteborg',
    address: 'Kungsportsavenyen 12, 411 36 Göteborg',
    description: 'Västkustkök med råvaror från Fiskhamnen. 60 sittplatser.',
    categories: ['RESTAURANG', 'FINE_DINING'] as Category[],
    websiteUrl: 'https://kajutan.se',
    socials: [
      { platform: 'TIKTOK' as const, handle: 'restaurangkajutan' },
      { platform: 'INSTAGRAM' as const, handle: 'kajutan_gbg' },
    ],
  },
  {
    personalNumber: '198012126666',
    name: 'Ali Rahimi',
    companyName: 'Bageri Solrosen',
    orgNumber: '5569876543',
    city: 'Göteborg',
    address: 'Andra Långgatan 4, 413 03 Göteborg',
    description: 'Surdegsbageri och kafé i Linné. Öppnar 07 varje dag.',
    categories: ['BAGERI', 'CAFE'] as Category[],
    websiteUrl: 'https://bagerisolrosen.se',
    socials: [{ platform: 'INSTAGRAM' as const, handle: 'bagerisolrosen' }],
  },
];

async function main(): Promise<void> {
  console.log('Rensar tidigare demodata …');
  // Ordningen spelar roll: barn före föräldrar.
  await prisma.auditEvent.deleteMany();
  await prisma.review.deleteMany();
  await prisma.processedWebhook.deleteMany();
  await prisma.bankIdSession.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.signature.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.message.deleteMany();
  await prisma.match.deleteMany();
  await prisma.application.deleteMany();
  await prisma.swipe.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.socialAccount.deleteMany();
  await prisma.influencerProfile.deleteMany();
  await prisma.businessProfile.deleteMany();
  await prisma.user.deleteMany();

  console.log('Skapar influencers …');
  const influencerProfiles = [];
  for (const seed of influencers) {
    const user = await prisma.user.create({
      data: {
        role: 'INFLUENCER',
        name: seed.name,
        personalNumberHash: hash(seed.personalNumber),
        personalNumberMask: mask(seed.personalNumber),
        bankIdVerifiedAt: new Date(),
        onboardingComplete: true,
        influencerProfile: {
          create: {
            displayName: seed.displayName,
            bio: seed.bio,
            city: seed.city,
            categories: seed.categories,
            priceMin: seed.priceMin,
            priceTarget: seed.priceTarget,
            // Demoprofiler har redan gått igenom Stripe-onboardingen.
            stripeAccountId: `acct_demo_${seed.displayName}`,
            payoutsEnabled: true,
            socialAccounts: {
              create: seed.accounts.map((account) => ({
                ...account,
                verified: account.followers > 50_000,
                lastSyncedAt: new Date(),
              })),
            },
          },
        },
      },
      include: { influencerProfile: true },
    });
    influencerProfiles.push(user.influencerProfile!);
  }

  console.log('Skapar restauranger …');
  const businessProfiles = [];
  for (const seed of businesses) {
    const user = await prisma.user.create({
      data: {
        role: 'BUSINESS',
        name: seed.name,
        personalNumberHash: hash(seed.personalNumber),
        personalNumberMask: mask(seed.personalNumber),
        bankIdVerifiedAt: new Date(),
        onboardingComplete: true,
        businessProfile: {
          create: {
            companyName: seed.companyName,
            orgNumber: seed.orgNumber,
            city: seed.city,
            address: seed.address,
            description: seed.description,
            categories: seed.categories,
            websiteUrl: seed.websiteUrl,
            socials: { create: seed.socials },
          },
        },
      },
      include: { businessProfile: true },
    });
    businessProfiles.push(user.businessProfile!);
  }

  const kajutan = businessProfiles[0]!;
  const solrosen = businessProfiles[1]!;
  const inTwoWeeks = new Date(Date.now() + 14 * 86_400_000);
  const inTwoMonths = new Date(Date.now() + 60 * 86_400_000);

  console.log('Skapar kampanjer …');
  const lunchkampanj = await prisma.campaign.create({
    data: {
      businessId: kajutan.id,
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
      startDate: new Date(),
      endDate: inTwoMonths,
      status: 'ACTIVE',
    },
  });

  await prisma.campaign.create({
    data: {
      businessId: kajutan.id,
      title: 'Smakmeny för matintresserade',
      brief:
        'Sexrättersmeny med dryckespaket för dig som gör innehåll om fine dining. Vi vill ha en längre film där du berättar om rätterna och köket.',
      categories: ['FINE_DINING', 'RESTAURANG'],
      platforms: ['YOUTUBE', 'INSTAGRAM'],
      deliverables: ['YOUTUBE_VIDEO', 'INSTAGRAM_POST'],
      compensationType: 'HYBRID',
      budgetPerCreator: kr(12_000),
      productValue: kr(2_400),
      slots: 1,
      city: 'Göteborg',
      minFollowers: 30_000,
      startDate: new Date(),
      endDate: inTwoMonths,
      status: 'ACTIVE',
    },
  });

  await prisma.campaign.create({
    data: {
      businessId: solrosen.id,
      title: 'Morgonbröd och kaffe i Linné',
      brief:
        'Vi vill nå studenter och folk som jobbar hemifrån. Kom förbi på förmiddagen, visa surdegen och våra sittplatser. Nämn att vi öppnar 07.',
      categories: ['BAGERI', 'CAFE'],
      platforms: ['TIKTOK', 'INSTAGRAM'],
      deliverables: ['TIKTOK_VIDEO'],
      compensationType: 'PRODUCT',
      budgetPerCreator: 0,
      productValue: kr(400),
      slots: 5,
      city: 'Göteborg',
      minFollowers: 3_000,
      startDate: new Date(),
      endDate: inTwoWeeks,
      status: 'ACTIVE',
    },
  });

  console.log('Skapar en färdig matchning …');
  const anna = influencerProfiles[0]!;
  await prisma.swipe.createMany({
    data: [
      { campaignId: lunchkampanj.id, influencerId: anna.id, actor: 'INFLUENCER', direction: 'LIKE' },
      { campaignId: lunchkampanj.id, influencerId: anna.id, actor: 'BUSINESS', direction: 'LIKE' },
    ],
  });
  await prisma.match.create({
    data: {
      campaignId: lunchkampanj.id,
      influencerId: anna.id,
      matchScore: 94,
      matchReason: 'Täcker alla nischer kampanjen efterfrågar',
      status: 'IN_CONVERSATION',
    },
  });

  console.log('Skapar ett avslutat samarbete med omdömen …');
  await seedCompletedCollaboration({
    business: solrosen,
    influencer: influencerProfiles[1]!,
  });

  console.log(
    `Klart: ${influencerProfiles.length} influencers, ${businessProfiles.length} restauranger, 3 kampanjer.`,
  );
}

/**
 * Ett samarbete som redan gått hela vägen till utbetalning, med omdömen från
 * båda parter. Utan det syns aldrig betygen i kortleken efter en seed.
 */
async function seedCompletedCollaboration(input: {
  business: { id: string; companyName: string; orgNumber: string; userId: string };
  influencer: { id: string; displayName: string; userId: string };
}): Promise<void> {
  const { business, influencer } = input;
  const completedAt = new Date(Date.now() - 5 * 86_400_000);
  const dueDate = new Date(Date.now() - 12 * 86_400_000);
  const fee = kr(3_500);

  const campaign = await prisma.campaign.create({
    data: {
      businessId: business.id,
      title: 'Fredagsfika med kanelbullar',
      brief:
        'Vi bakade extra inför fredagen och ville visa det. En kortare film från disken och en story när bullarna kommer ut ur ugnen.',
      categories: ['BAGERI', 'CAFE'],
      platforms: ['INSTAGRAM'],
      deliverables: ['INSTAGRAM_REEL'],
      compensationType: 'FIXED',
      budgetPerCreator: fee,
      slots: 1,
      city: 'Göteborg',
      minFollowers: 3_000,
      startDate: new Date(Date.now() - 30 * 86_400_000),
      endDate: dueDate,
      status: 'CLOSED',
    },
  });

  await prisma.swipe.createMany({
    data: [
      { campaignId: campaign.id, influencerId: influencer.id, actor: 'INFLUENCER', direction: 'LIKE' },
      { campaignId: campaign.id, influencerId: influencer.id, actor: 'BUSINESS', direction: 'LIKE' },
    ],
  });
  const match = await prisma.match.create({
    data: {
      campaignId: campaign.id,
      influencerId: influencer.id,
      matchScore: 88,
      matchReason: 'Finns på plats i Göteborg och gör mat i samma stil',
      status: 'CONTRACTED',
    },
  });

  const contract = await prisma.contract.create({
    data: {
      matchId: match.id,
      campaignId: campaign.id,
      influencerId: influencer.id,
      fee,
      deliverables: ['INSTAGRAM_REEL'],
      dueDate,
      status: 'COMPLETED',
      signedByInfluencerAt: new Date(Date.now() - 20 * 86_400_000),
      signedByBusinessAt: new Date(Date.now() - 20 * 86_400_000),
      deliveredAt: new Date(Date.now() - 7 * 86_400_000),
      completedAt,
      terms: renderContractTerms({
        contractId: 'seed-fredagsfika',
        businessName: business.companyName,
        businessOrgNumber: business.orgNumber,
        influencerName: influencer.displayName,
        influencerPersonalNumberMask: '19900101-****',
        campaignTitle: campaign.title,
        campaignBrief: campaign.brief,
        deliverables: ['INSTAGRAM_REEL'],
        fee,
        platformFeeBps: 1200,
        dueDate,
        reviewDays: 7,
        extraTerms: '',
      }),
    },
  });

  const breakdown = splitFee(fee, 1200);
  await prisma.payment.create({
    data: {
      contractId: contract.id,
      amount: breakdown.gross,
      platformFee: breakdown.platformFee,
      payout: breakdown.net,
      status: 'RELEASED',
      escrowedAt: new Date(Date.now() - 18 * 86_400_000),
      releasedAt: completedAt,
    },
  });

  // Båda skrev, alltså är omdömena publicerade.
  const publishedAt = new Date(completedAt.getTime() + 86_400_000);
  const visibleAt = reviewDeadline(completedAt);
  const fromBusiness = { communication: 5, asDescribed: 5, again: 4 };
  const fromInfluencer = { communication: 4, asDescribed: 5, again: 5 };

  await prisma.review.createMany({
    data: [
      {
        contractId: contract.id,
        authorRole: 'BUSINESS',
        authorId: business.userId,
        influencerId: influencer.id,
        businessId: business.id,
        rating: overallRating(fromBusiness),
        ...fromBusiness,
        comment:
          'Kom när vi kom överens om, förstod direkt vad vi ville visa och filmen låg uppe samma kväll. Vi fick fler bordsbokningar dagen efter.',
        createdAt: publishedAt,
        publishedAt,
        visibleAt,
      },
      {
        contractId: contract.id,
        authorRole: 'INFLUENCER',
        authorId: influencer.userId,
        influencerId: influencer.id,
        businessId: business.id,
        rating: overallRating(fromInfluencer),
        ...fromInfluencer,
        comment:
          'Tydlig brief och de hade förberett allt när jag kom. Betalningen låg spärrad från början, så jag behövde aldrig fundera på om pengarna skulle komma.',
        createdAt: publishedAt,
        publishedAt,
        visibleAt,
      },
    ],
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
