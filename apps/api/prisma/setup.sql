-- Pacta: skapar alla tabeller och lägger in demodata.
-- Klistra in allt i Supabase SQL Editor och tryck Run. Körs en gång.
-- Genererad av build-setup.mjs – ändra inte för hand.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- === 20260904000000_init ===

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('INFLUENCER', 'BUSINESS', 'ADMIN');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('TIKTOK', 'INSTAGRAM', 'YOUTUBE');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('RESTAURANG', 'CAFE', 'BAR', 'STREET_FOOD', 'FINE_DINING', 'BAGERI', 'VEGETARISKT', 'MAT_OCH_DRYCK', 'LIVSSTIL', 'RESA', 'FAMILJ', 'TRANING', 'NOJE');

-- CreateEnum
CREATE TYPE "CompensationType" AS ENUM ('FIXED', 'PRODUCT', 'HYBRID');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SwipeDirection" AS ENUM ('LIKE', 'PASS');

-- CreateEnum
CREATE TYPE "SwipeActor" AS ENUM ('INFLUENCER', 'BUSINESS');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('NEW', 'IN_CONVERSATION', 'CONTRACTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_SIGNED', 'ACTIVE', 'DELIVERED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'ESCROWED', 'RELEASED', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "DeliverableKind" AS ENUM ('TIKTOK_VIDEO', 'INSTAGRAM_REEL', 'INSTAGRAM_POST', 'INSTAGRAM_STORY', 'YOUTUBE_SHORT', 'YOUTUBE_VIDEO');

-- CreateEnum
CREATE TYPE "BankIdPurpose" AS ENUM ('LOGIN', 'SIGN');

-- CreateEnum
CREATE TYPE "BankIdStatus" AS ENUM ('PENDING', 'COMPLETE', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "personalNumberHash" TEXT,
    "personalNumberMask" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "bankIdVerifiedAt" TIMESTAMP(3),
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfluencerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "categories" "Category"[],
    "priceMin" INTEGER NOT NULL DEFAULT 0,
    "priceTarget" INTEGER NOT NULL DEFAULT 0,
    "stripeAccountId" TEXT,
    "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfluencerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialAccount" (
    "id" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "handle" TEXT NOT NULL,
    "externalId" TEXT,
    "followers" INTEGER NOT NULL DEFAULT 0,
    "avgViews" INTEGER NOT NULL DEFAULT 0,
    "engagementRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "accessTokenEnc" TEXT,
    "refreshTokenEnc" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "orgNumber" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT,
    "categories" "Category"[],
    "stripeCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "categories" "Category"[],
    "platforms" "Platform"[],
    "deliverables" "DeliverableKind"[],
    "compensationType" "CompensationType" NOT NULL,
    "budgetPerCreator" INTEGER NOT NULL,
    "productValue" INTEGER NOT NULL DEFAULT 0,
    "slots" INTEGER NOT NULL DEFAULT 1,
    "city" TEXT NOT NULL,
    "minFollowers" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Swipe" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "actor" "SwipeActor" NOT NULL,
    "direction" "SwipeDirection" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Swipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'NEW',
    "matchScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "matchReason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "pitch" TEXT NOT NULL,
    "proposedFee" INTEGER,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "matchId" TEXT,
    "campaignId" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "fee" INTEGER NOT NULL,
    "platformFeeBps" INTEGER NOT NULL DEFAULT 1200,
    "deliverables" "DeliverableKind"[],
    "dueDate" TIMESTAMP(3) NOT NULL,
    "reviewDays" INTEGER NOT NULL DEFAULT 7,
    "terms" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "signedByInfluencerAt" TIMESTAMP(3),
    "signedByBusinessAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signature" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bankIdOrderRef" TEXT NOT NULL,
    "signatureBlob" TEXT NOT NULL,
    "ocspResponse" TEXT NOT NULL,
    "termsHash" TEXT NOT NULL,
    "ipAddress" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Signature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "urls" TEXT[],
    "note" TEXT NOT NULL DEFAULT '',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "autoApproved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "platformFee" INTEGER NOT NULL,
    "payout" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'sek',
    "stripePaymentIntentId" TEXT,
    "stripeTransferId" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "escrowedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankIdSession" (
    "id" TEXT NOT NULL,
    "orderRef" TEXT NOT NULL,
    "autoStartToken" TEXT NOT NULL,
    "qrStartToken" TEXT NOT NULL,
    "qrStartSecret" TEXT NOT NULL,
    "purpose" "BankIdPurpose" NOT NULL,
    "status" "BankIdStatus" NOT NULL DEFAULT 'PENDING',
    "hintCode" TEXT,
    "requestedRole" "Role",
    "userId" TEXT,
    "contractId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BankIdSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "authorRole" "Role" NOT NULL,
    "authorId" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "communication" INTEGER NOT NULL,
    "asDescribed" INTEGER NOT NULL,
    "again" INTEGER NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "visibleAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedWebhook" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_personalNumberHash_key" ON "User"("personalNumberHash");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "InfluencerProfile_userId_key" ON "InfluencerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InfluencerProfile_stripeAccountId_key" ON "InfluencerProfile"("stripeAccountId");

-- CreateIndex
CREATE INDEX "InfluencerProfile_city_idx" ON "InfluencerProfile"("city");

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccount_influencerId_platform_key" ON "SocialAccount"("influencerId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessProfile_userId_key" ON "BusinessProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessProfile_orgNumber_key" ON "BusinessProfile"("orgNumber");

-- CreateIndex
CREATE INDEX "BusinessProfile_city_idx" ON "BusinessProfile"("city");

-- CreateIndex
CREATE INDEX "Campaign_status_city_idx" ON "Campaign"("status", "city");

-- CreateIndex
CREATE INDEX "Swipe_influencerId_actor_idx" ON "Swipe"("influencerId", "actor");

-- CreateIndex
CREATE UNIQUE INDEX "Swipe_campaignId_influencerId_actor_key" ON "Swipe"("campaignId", "influencerId", "actor");

-- CreateIndex
CREATE UNIQUE INDEX "Match_campaignId_influencerId_key" ON "Match"("campaignId", "influencerId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_campaignId_influencerId_key" ON "Application"("campaignId", "influencerId");

-- CreateIndex
CREATE INDEX "Message_matchId_createdAt_idx" ON "Message"("matchId", "createdAt");

-- CreateIndex
CREATE INDEX "Contract_status_idx" ON "Contract"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Signature_contractId_userId_key" ON "Signature"("contractId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_contractId_key" ON "Delivery"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_contractId_key" ON "Payment"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripePaymentIntentId_key" ON "Payment"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "BankIdSession_orderRef_key" ON "BankIdSession"("orderRef");

-- CreateIndex
CREATE INDEX "BankIdSession_status_startedAt_idx" ON "BankIdSession"("status", "startedAt");

-- CreateIndex
CREATE INDEX "Review_influencerId_publishedAt_idx" ON "Review"("influencerId", "publishedAt");

-- CreateIndex
CREATE INDEX "Review_businessId_publishedAt_idx" ON "Review"("businessId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_contractId_authorRole_key" ON "Review"("contractId", "authorRole");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "InfluencerProfile" ADD CONSTRAINT "InfluencerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "InfluencerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessProfile" ADD CONSTRAINT "BusinessProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Swipe" ADD CONSTRAINT "Swipe_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Swipe" ADD CONSTRAINT "Swipe_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "InfluencerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "InfluencerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "InfluencerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "InfluencerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signature" ADD CONSTRAINT "Signature_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signature" ADD CONSTRAINT "Signature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankIdSession" ADD CONSTRAINT "BankIdSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "InfluencerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- === 20260905000000_password_login ===

ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;

-- === 20260906000000_showcase ===

-- CreateTable
CREATE TABLE "ShowcaseItem" (
    "id" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "url" TEXT NOT NULL,
    "postId" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "authorName" TEXT NOT NULL DEFAULT '',
    "thumbnailUrl" TEXT,
    "thumbnailWidth" INTEGER,
    "thumbnailHeight" INTEGER,
    "refreshedAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShowcaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShowcaseItem_influencerId_url_key" ON "ShowcaseItem"("influencerId", "url");

-- CreateIndex
CREATE INDEX "ShowcaseItem_influencerId_position_idx" ON "ShowcaseItem"("influencerId", "position");

-- AddForeignKey
ALTER TABLE "ShowcaseItem" ADD CONSTRAINT "ShowcaseItem_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "InfluencerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- === 20260907000000_media ===

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "imageUrl" TEXT;

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "mimeType" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaAsset_ownerId_idx" ON "MediaAsset"("ownerId");

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- === 20260908000000_stats_source ===

-- CreateEnum
CREATE TYPE "StatsSource" AS ENUM ('PLATFORM', 'DEMO');

-- AlterTable
ALTER TABLE "SocialAccount" ADD COLUMN     "sampleSize" INTEGER,
ADD COLUMN     "statsSource" "StatsSource" NOT NULL DEFAULT 'DEMO';

-- === 20260909000000_showcase_views ===

-- AlterTable
ALTER TABLE "ShowcaseItem" ADD COLUMN     "views" INTEGER;

-- === 20260910000000_drafts ===

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED');

-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL DEFAULT '',
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "status" "DraftStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT NOT NULL DEFAULT '',
    "reviewedAt" TIMESTAMP(3),
    "autoApproved" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Draft_contractId_status_idx" ON "Draft"("contractId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Draft_contractId_version_key" ON "Draft"("contractId", "version");

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- === 20260911000000_venue_photos ===

-- AlterTable
ALTER TABLE "BusinessProfile" ADD COLUMN     "photos" TEXT[];

-- === 20260912000000_post_metrics ===

-- CreateTable
CREATE TABLE "PostMetric" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "url" TEXT NOT NULL,
    "postId" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "final" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PostMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostMetric_contractId_idx" ON "PostMetric"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "PostMetric_contractId_url_key" ON "PostMetric"("contractId", "url");

-- AddForeignKey
ALTER TABLE "PostMetric" ADD CONSTRAINT "PostMetric_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- === 20260913000000_business_links ===

-- AlterTable
ALTER TABLE "BusinessProfile" ADD COLUMN     "websiteUrl" TEXT;

-- CreateTable
CREATE TABLE "BusinessSocial" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "handle" TEXT NOT NULL,

    CONSTRAINT "BusinessSocial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessSocial_businessId_platform_key" ON "BusinessSocial"("businessId", "platform");

-- AddForeignKey
ALTER TABLE "BusinessSocial" ADD CONSTRAINT "BusinessSocial_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- === 20260914000000_split_fee ===

-- Delad förmedlingsavgift: företaget betalar sin del ovanpå arvodet,
-- kreatören får sin dragen vid utbetalning.
ALTER TABLE "Contract" ADD COLUMN     "businessFeeBps" INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE "Contract" ADD COLUMN     "creatorFeeBps" INTEGER NOT NULL DEFAULT 1000;

-- Avtal tecknade före ändringen lade hela avgiften på kreatören. De ska
-- fortsätta räknas precis som när de signerades.
UPDATE "Contract" SET "businessFeeBps" = 0, "creatorFeeBps" = "platformFeeBps";

ALTER TABLE "Contract" DROP COLUMN "platformFeeBps";

-- Prismas egen bokföring. Utan den försöker servern skapa tabellerna en
-- gång till vid start och kraschar på att de redan finns.
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    id                      VARCHAR(36) PRIMARY KEY NOT NULL,
    checksum                VARCHAR(64) NOT NULL,
    finished_at             TIMESTAMPTZ,
    migration_name          VARCHAR(255) NOT NULL,
    logs                    TEXT,
    rolled_back_at          TIMESTAMPTZ,
    started_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    applied_steps_count     INTEGER NOT NULL DEFAULT 0
);

INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
VALUES (gen_random_uuid()::text,
        '753caefbbf49159ac5562f88a37633b9a25a2491ec666306def9504e7e3ef3c9',
        now(), '20260904000000_init', now(), 1);

INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
VALUES (gen_random_uuid()::text,
        'ac0e330cf07bc0c8ef1d2d44121777ae9da92a28f1fa61e32e7bb1f5b8c123e3',
        now(), '20260905000000_password_login', now(), 1);

INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
VALUES (gen_random_uuid()::text,
        'b4b466e0c1c3874fb965c092575d4ec2fcd3d1c90f5323c7ff77ea157f55467a',
        now(), '20260906000000_showcase', now(), 1);

INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
VALUES (gen_random_uuid()::text,
        'd53365460e1257cc0fc8eac91de7aadb31ff107bb9e2049bb27a2ef1e06d867c',
        now(), '20260907000000_media', now(), 1);

INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
VALUES (gen_random_uuid()::text,
        '9ff5f34f91ef4ecede7275fa104a2f8a65ae057c7db7bd3be202c79a1a51e1ac',
        now(), '20260908000000_stats_source', now(), 1);

INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
VALUES (gen_random_uuid()::text,
        'fc6072e31c3212309c2e9883f66b906ec453570a77c368afc41ccd1f54b5cc9e',
        now(), '20260909000000_showcase_views', now(), 1);

INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
VALUES (gen_random_uuid()::text,
        '3eab023380fc3b3d0a14c0303db0efc1b571ec9225a8dc6d34498dc036058aed',
        now(), '20260910000000_drafts', now(), 1);

INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
VALUES (gen_random_uuid()::text,
        '2126e23b70ba33b743f08ed7ad57f237ceb540ffacd27df3662c60339a10d0f1',
        now(), '20260911000000_venue_photos', now(), 1);

INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
VALUES (gen_random_uuid()::text,
        '9d7695829a0802f4887168fba5f93f99c158d9a5ff328f93fd8f20ae91f05548',
        now(), '20260912000000_post_metrics', now(), 1);

INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
VALUES (gen_random_uuid()::text,
        'f8fb445ce26336eb99eb0d1f6ec2e235a20d6ad279c8e0bf42d61b11da6da31f',
        now(), '20260913000000_business_links', now(), 1);

INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
VALUES (gen_random_uuid()::text,
        '25c2701859669cf2fc01d376b73c6c34385d0981641e9d45fcd54ee096f9acae',
        now(), '20260914000000_split_fee', now(), 1);

-- === Demodata ===

-- Demodata för Pacta.
-- Klistra in i Supabase SQL Editor EFTER att Railway skapat tabellerna.
-- 6 influencers, 2 företag, 3 kampanjer, en färdig matchning och ett
-- avslutat samarbete med omdömen från båda parter.
--
-- Genererad med: npm run db:seed && pg_dump --data-only --column-inserts
-- Kolumnnamnen står utskrivna med flit: en framtida migration som ändrar
-- kolumnordningen ska inte tyst lägga värdena i fel fält.

INSERT INTO public."User" (id, role, "personalNumberHash", "personalNumberMask", name, email, phone, "bankIdVerifiedAt", "onboardingComplete", "createdAt", "updatedAt", "passwordHash") VALUES ('cmtpk4ykb00007dpraq1pvyzy', 'INFLUENCER', 'd1415d1f9b9de74c91cb503202419e99ef2925204dd11c5fa56019fc2b294650', '19920315-****', 'Anna Karlsson', NULL, NULL, '2026-09-06 08:36:15.993', true, '2026-09-06 08:36:15.995', '2026-09-06 08:36:15.995', NULL);
INSERT INTO public."User" (id, role, "personalNumberHash", "personalNumberMask", name, email, phone, "bankIdVerifiedAt", "onboardingComplete", "createdAt", "updatedAt", "passwordHash") VALUES ('cmtpk4ykk00047dprctirj8ji', 'INFLUENCER', 'fbe5d59845ab3dbefd535a6ad8d277dbc51c41b279edb6fa2d69036dfbc96a77', '19880722-****', 'Erik Lindberg', NULL, NULL, '2026-09-06 08:36:16.004', true, '2026-09-06 08:36:16.005', '2026-09-06 08:36:16.005', NULL);
INSERT INTO public."User" (id, role, "personalNumberHash", "personalNumberMask", name, email, phone, "bankIdVerifiedAt", "onboardingComplete", "createdAt", "updatedAt", "passwordHash") VALUES ('cmtpk4ykn00087dprlzd8j4rr', 'INFLUENCER', 'e3e3d78d03f7a1bcbbeb8628db5bab2757b1fe896a0ca8aeac8315a464ee2bc5', '19991102-****', 'Sara Nyström', NULL, NULL, '2026-09-06 08:36:16.007', true, '2026-09-06 08:36:16.008', '2026-09-06 08:36:16.008', NULL);
INSERT INTO public."User" (id, role, "personalNumberHash", "personalNumberMask", name, email, phone, "bankIdVerifiedAt", "onboardingComplete", "createdAt", "updatedAt", "passwordHash") VALUES ('cmtpk4ykq000b7dpr5v21f1nt', 'INFLUENCER', '98c4b5ad746f76e3c91047685e4042ff7b2e5cf6d16b4e2eb9059bd4dab66fcb', '19950530-****', 'Johan Bergqvist', NULL, NULL, '2026-09-06 08:36:16.01', true, '2026-09-06 08:36:16.011', '2026-09-06 08:36:16.011', NULL);
INSERT INTO public."User" (id, role, "personalNumberHash", "personalNumberMask", name, email, phone, "bankIdVerifiedAt", "onboardingComplete", "createdAt", "updatedAt", "passwordHash") VALUES ('cmtpk4ykt000f7dprdjtdvmdx', 'INFLUENCER', 'fc00a4daf08b87d7ce500ecac9db61c8c4f22b355fccc545b9b1bcaa7ac91253', '19940117-****', 'Maja Öberg', NULL, NULL, '2026-09-06 08:36:16.013', true, '2026-09-06 08:36:16.014', '2026-09-06 08:36:16.014', NULL);
INSERT INTO public."User" (id, role, "personalNumberHash", "personalNumberMask", name, email, phone, "bankIdVerifiedAt", "onboardingComplete", "createdAt", "updatedAt", "passwordHash") VALUES ('cmtpk4ykw000i7dpr2nwz7v4z', 'INFLUENCER', 'af7d618375505ed80e186886730b5232f29f71a9695d1cacafb2e69b6658ce69', '20010228-****', 'Oskar Holm', NULL, NULL, '2026-09-06 08:36:16.015', true, '2026-09-06 08:36:16.016', '2026-09-06 08:36:16.016', NULL);
INSERT INTO public."User" (id, role, "personalNumberHash", "personalNumberMask", name, email, phone, "bankIdVerifiedAt", "onboardingComplete", "createdAt", "updatedAt", "passwordHash") VALUES ('cmtpk4ykz000l7dprwh4mit9q', 'BUSINESS', 'e0b86ab140d123587dfa44df8c4ac6a7c20db09f37c772c069d8f63c6afee469', '19700101-****', 'Petra Sandell', NULL, NULL, '2026-09-06 08:36:16.018', true, '2026-09-06 08:36:16.019', '2026-09-06 08:36:16.019', NULL);
INSERT INTO public."User" (id, role, "personalNumberHash", "personalNumberMask", name, email, phone, "bankIdVerifiedAt", "onboardingComplete", "createdAt", "updatedAt", "passwordHash") VALUES ('cmtpk4yl2000p7dpryll7o4d2', 'BUSINESS', 'b51e78d5971fa780685aeb1ed0b9d0eebdb04815a7744a14528b500ed77cea1d', '19801212-****', 'Ali Rahimi', NULL, NULL, '2026-09-06 08:36:16.022', true, '2026-09-06 08:36:16.023', '2026-09-06 08:36:16.023', NULL);
INSERT INTO public."BusinessProfile" (id, "userId", "companyName", "orgNumber", city, address, description, "logoUrl", categories, "stripeCustomerId", "createdAt", "updatedAt", photos, "websiteUrl") VALUES ('cmtpk4ykz000m7dpr084b7qkj', 'cmtpk4ykz000l7dprwh4mit9q', 'Restaurang Kajutan', '5560123456', 'Göteborg', 'Kungsportsavenyen 12, 411 36 Göteborg', 'Västkustkök med råvaror från Fiskhamnen. 60 sittplatser.', NULL, '{RESTAURANG,FINE_DINING}', NULL, '2026-09-06 08:36:16.019', '2026-09-06 08:36:16.019', NULL, 'https://kajutan.se');
INSERT INTO public."BusinessProfile" (id, "userId", "companyName", "orgNumber", city, address, description, "logoUrl", categories, "stripeCustomerId", "createdAt", "updatedAt", photos, "websiteUrl") VALUES ('cmtpk4yl2000q7dprv51a57qe', 'cmtpk4yl2000p7dpryll7o4d2', 'Bageri Solrosen', '5569876543', 'Göteborg', 'Andra Långgatan 4, 413 03 Göteborg', 'Surdegsbageri och kafé i Linné. Öppnar 07 varje dag.', NULL, '{BAGERI,CAFE}', NULL, '2026-09-06 08:36:16.023', '2026-09-06 08:36:16.023', NULL, 'https://bagerisolrosen.se');
INSERT INTO public."Campaign" (id, "businessId", title, brief, categories, platforms, deliverables, "compensationType", "budgetPerCreator", "productValue", slots, city, "minFollowers", "startDate", "endDate", status, "createdAt", "updatedAt", "imageUrl") VALUES ('cmtpk4yl5000t7dpr9at5k1pg', 'cmtpk4ykz000m7dpr084b7qkj', 'Lansera vår nya lunchmeny', 'Vi byter till en ny lunchmeny med råvaror från Fiskhamnen. Du kommer förbi en vardag mellan 11 och 14, äter på vår bekostnad och gör innehåll som visar rätterna och stämningen i lokalen. Ta gärna med att lunchen kostar 145 kr inklusive kaffe.', '{RESTAURANG,MAT_OCH_DRYCK}', '{TIKTOK,INSTAGRAM}', '{TIKTOK_VIDEO,INSTAGRAM_STORY}', 'HYBRID', 400000, 30000, 3, 'Göteborg', 10000, '2026-09-06 08:36:16.025', '2026-11-05 08:36:16.025', 'ACTIVE', '2026-09-06 08:36:16.026', '2026-09-06 08:36:16.026', NULL);
INSERT INTO public."Campaign" (id, "businessId", title, brief, categories, platforms, deliverables, "compensationType", "budgetPerCreator", "productValue", slots, city, "minFollowers", "startDate", "endDate", status, "createdAt", "updatedAt", "imageUrl") VALUES ('cmtpk4yl8000v7dprhxrt8fac', 'cmtpk4ykz000m7dpr084b7qkj', 'Smakmeny för matintresserade', 'Sexrättersmeny med dryckespaket för dig som gör innehåll om fine dining. Vi vill ha en längre film där du berättar om rätterna och köket.', '{FINE_DINING,RESTAURANG}', '{YOUTUBE,INSTAGRAM}', '{YOUTUBE_VIDEO,INSTAGRAM_POST}', 'HYBRID', 1200000, 240000, 1, 'Göteborg', 30000, '2026-09-06 08:36:16.028', '2026-11-05 08:36:16.025', 'ACTIVE', '2026-09-06 08:36:16.028', '2026-09-06 08:36:16.028', NULL);
INSERT INTO public."Campaign" (id, "businessId", title, brief, categories, platforms, deliverables, "compensationType", "budgetPerCreator", "productValue", slots, city, "minFollowers", "startDate", "endDate", status, "createdAt", "updatedAt", "imageUrl") VALUES ('cmtpk4yla000x7dpr5mpmt7s6', 'cmtpk4yl2000q7dprv51a57qe', 'Morgonbröd och kaffe i Linné', 'Vi vill nå studenter och folk som jobbar hemifrån. Kom förbi på förmiddagen, visa surdegen och våra sittplatser. Nämn att vi öppnar 07.', '{BAGERI,CAFE}', '{TIKTOK,INSTAGRAM}', '{TIKTOK_VIDEO}', 'PRODUCT', 0, 40000, 5, 'Göteborg', 3000, '2026-09-06 08:36:16.029', '2026-09-20 08:36:16.024', 'ACTIVE', '2026-09-06 08:36:16.03', '2026-09-06 08:36:16.03', NULL);
INSERT INTO public."Campaign" (id, "businessId", title, brief, categories, platforms, deliverables, "compensationType", "budgetPerCreator", "productValue", slots, city, "minFollowers", "startDate", "endDate", status, "createdAt", "updatedAt", "imageUrl") VALUES ('cmtpk4ylf00137dpr54qdkxxj', 'cmtpk4yl2000q7dprv51a57qe', 'Fredagsfika med kanelbullar', 'Vi bakade extra inför fredagen och ville visa det. En kortare film från disken och en story när bullarna kommer ut ur ugnen.', '{BAGERI,CAFE}', '{INSTAGRAM}', '{INSTAGRAM_REEL}', 'FIXED', 350000, 0, 1, 'Göteborg', 3000, '2026-08-07 08:36:16.034', '2026-08-25 08:36:16.034', 'CLOSED', '2026-09-06 08:36:16.035', '2026-09-06 08:36:16.035', NULL);
INSERT INTO public."InfluencerProfile" (id, "userId", "displayName", bio, city, "avatarUrl", categories, "priceMin", "priceTarget", "stripeAccountId", "payoutsEnabled", "createdAt", "updatedAt") VALUES ('cmtpk4ykb00017dprpf8yxg70', 'cmtpk4ykb00007dpraq1pvyzy', 'annaäter', 'Testar Göteborgs lunchställen varje vardag. Kort, snabbt, ärligt.', 'Göteborg', NULL, '{RESTAURANG,MAT_OCH_DRYCK,LIVSSTIL}', 200000, 450000, 'acct_demo_annaäter', true, '2026-09-06 08:36:15.995', '2026-09-06 08:36:15.995');
INSERT INTO public."InfluencerProfile" (id, "userId", "displayName", bio, city, "avatarUrl", categories, "priceMin", "priceTarget", "stripeAccountId", "payoutsEnabled", "createdAt", "updatedAt") VALUES ('cmtpk4ykk00057dprux4e9li1', 'cmtpk4ykk00047dprctirj8ji', 'Kocken Erik', 'Utbildad kock som recenserar fine dining och nya öppningar.', 'Göteborg', NULL, '{FINE_DINING,RESTAURANG}', 500000, 1200000, 'acct_demo_Kocken Erik', true, '2026-09-06 08:36:16.005', '2026-09-06 08:36:16.005');
INSERT INTO public."InfluencerProfile" (id, "userId", "displayName", bio, city, "avatarUrl", categories, "priceMin", "priceTarget", "stripeAccountId", "payoutsEnabled", "createdAt", "updatedAt") VALUES ('cmtpk4ykn00097dprtjsrki9p', 'cmtpk4ykn00087dprlzd8j4rr', 'saraiskafferiet', 'Kaféhäng, bakverk och studieplatser med bra kaffe.', 'Göteborg', NULL, '{CAFE,BAGERI,LIVSSTIL}', 120000, 280000, 'acct_demo_saraiskafferiet', true, '2026-09-06 08:36:16.008', '2026-09-06 08:36:16.008');
INSERT INTO public."InfluencerProfile" (id, "userId", "displayName", bio, city, "avatarUrl", categories, "priceMin", "priceTarget", "stripeAccountId", "payoutsEnabled", "createdAt", "updatedAt") VALUES ('cmtpk4ykq000c7dprwy3t3v7g', 'cmtpk4ykq000b7dpr5v21f1nt', 'gbgstreetfood', 'Street food, food trucks och sena kvällsmackor.', 'Göteborg', NULL, '{STREET_FOOD,MAT_OCH_DRYCK}', 150000, 350000, 'acct_demo_gbgstreetfood', true, '2026-09-06 08:36:16.011', '2026-09-06 08:36:16.011');
INSERT INTO public."InfluencerProfile" (id, "userId", "displayName", bio, city, "avatarUrl", categories, "priceMin", "priceTarget", "stripeAccountId", "payoutsEnabled", "createdAt", "updatedAt") VALUES ('cmtpk4ykt000g7dprk3k7ovcm', 'cmtpk4ykt000f7dprdjtdvmdx', 'majagront', 'Vegetariskt och veganskt i Stockholm. Recept och restaurangtips.', 'Stockholm', NULL, '{VEGETARISKT,MAT_OCH_DRYCK}', 300000, 700000, 'acct_demo_majagront', true, '2026-09-06 08:36:16.014', '2026-09-06 08:36:16.014');
INSERT INTO public."InfluencerProfile" (id, "userId", "displayName", bio, city, "avatarUrl", categories, "priceMin", "priceTarget", "stripeAccountId", "payoutsEnabled", "createdAt", "updatedAt") VALUES ('cmtpk4ykw000j7dprtnl0lc9j', 'cmtpk4ykw000i7dpr2nwz7v4z', 'oskarpakrogen', 'Barer, cocktails och afterwork. 21+.', 'Göteborg', NULL, '{BAR,NOJE}', 250000, 550000, 'acct_demo_oskarpakrogen', true, '2026-09-06 08:36:16.016', '2026-09-06 08:36:16.016');
INSERT INTO public."BusinessSocial" (id, "businessId", platform, handle) VALUES ('cmtpk4ykz000n7dpryg0puhgt', 'cmtpk4ykz000m7dpr084b7qkj', 'TIKTOK', 'restaurangkajutan');
INSERT INTO public."BusinessSocial" (id, "businessId", platform, handle) VALUES ('cmtpk4ykz000o7dprtzcyvajs', 'cmtpk4ykz000m7dpr084b7qkj', 'INSTAGRAM', 'kajutan_gbg');
INSERT INTO public."BusinessSocial" (id, "businessId", platform, handle) VALUES ('cmtpk4yl2000r7dpr7tygpq5z', 'cmtpk4yl2000q7dprv51a57qe', 'INSTAGRAM', 'bagerisolrosen');
INSERT INTO public."Match" (id, "campaignId", "influencerId", status, "matchScore", "matchReason", "createdAt", "updatedAt") VALUES ('cmtpk4yld00117dpr69bfsnmq', 'cmtpk4yl5000t7dpr9at5k1pg', 'cmtpk4ykb00017dprpf8yxg70', 'IN_CONVERSATION', 94, 'Täcker alla nischer kampanjen efterfrågar', '2026-09-06 08:36:16.033', '2026-09-06 08:36:16.033');
INSERT INTO public."Match" (id, "campaignId", "influencerId", status, "matchScore", "matchReason", "createdAt", "updatedAt") VALUES ('cmtpk4ylh00177dpr2i11ltm2', 'cmtpk4ylf00137dpr54qdkxxj', 'cmtpk4ykk00057dprux4e9li1', 'CONTRACTED', 88, 'Finns på plats i Göteborg och gör mat i samma stil', '2026-09-06 08:36:16.038', '2026-09-06 08:36:16.038');
INSERT INTO public."Contract" (id, "matchId", "campaignId", "influencerId", fee, deliverables, "dueDate", "reviewDays", terms, status, "signedByInfluencerAt", "signedByBusinessAt", "deliveredAt", "completedAt", "createdAt", "updatedAt", "businessFeeBps", "creatorFeeBps") VALUES ('cmtpk4yln00197dpr4fefg4j0', 'cmtpk4ylh00177dpr2i11ltm2', 'cmtpk4ylf00137dpr54qdkxxj', 'cmtpk4ykk00057dprux4e9li1', 350000, '{INSTAGRAM_REEL}', '2026-08-25 08:36:16.034', 7, '# Samarbetsavtal

**Avtalsnummer:** seed-fredagsfika

## 1. Parter

**Uppdragsgivare:** Bageri Solrosen, org.nr 556987-6543
**Uppdragstagare:** Kocken Erik, personnr 19900101-****

Avtalet ingås via Pacta, som förmedlar uppdraget och hanterar betalningen.

## 2. Uppdraget

Kampanj: **Fredagsfika med kanelbullar**

Vi bakade extra inför fredagen och ville visa det. En kortare film från disken och en story när bullarna kommer ut ur ugnen.

Uppdragstagaren ska leverera:

1. en Instagram Reel (minst 15 sekunder)

Innan publicering lämnar uppdragstagaren materialet för godkännande i Pacta. Uppdragsgivaren har 7 dagar på sig att godkänna eller begära ändring; svarar uppdragsgivaren inte inom den tiden räknas materialet som godkänt och får publiceras.

Materialet ska vara publicerat senast **25 augusti 2026**.

## 3. Ersättning

| Post | Belopp |
| --- | --- |
| Arvode | 3 500 kr |
| Förmedlingsavgift, uppdragsgivaren (10,0 %) | +350 kr |
| **Uppdragsgivaren betalar in** | **3 850 kr** |
| Förmedlingsavgift, uppdragstagaren (10,0 %) | −350 kr |
| **Utbetalas till uppdragstagaren** | **3 150 kr** |

Uppdragsgivaren betalar in arvodet och sin del av förmedlingsavgiften till Pacta när avtalet blir bindande. Beloppet hålls kvar och betalas ut till uppdragstagaren när leveransen godkänts. Uppdragsgivaren har 7 dagar på sig att granska leveransen; därefter godkänns den automatiskt och utbetalning sker.

Angivna belopp är exklusive mervärdesskatt. Uppdragstagaren ansvarar själv för skatt och eventuella sociala avgifter på ersättningen.

## 4. Marknadsföringsrättslig märkning

Uppdragstagaren ska tydligt märka allt material som reklam i enlighet med marknadsföringslagen (2008:486) och Konsumentverkets vägledning, till exempel med "Reklam för Bageri Solrosen" eller "Samarbete". Märkningen ska synas utan att mottagaren behöver klicka vidare.

## 5. Rättigheter till materialet

Uppdragstagaren behåller upphovsrätten till materialet. Uppdragsgivaren får en icke-exklusiv rätt att återpublicera materialet i sina egna kanaler i sex (6) månader från publiceringen, med angivande av uppdragstagarens användarnamn. All annan användning, inklusive betald annonsering, kräver skriftligt medgivande.

Rätten omfattar även den filmfil uppdragstagaren lämnat för godkännande, i samma omfattning och under samma tid. Uppdragsgivaren får inte vidarelicensiera materialet, sälja det, eller ändra det på ett sätt som förvanskar innehållet eller uppdragstagarens medverkan.

Medverkar någon annan person i materialet ansvarar uppdragstagaren för att ha deras samtycke till den användning som anges här.

## 6. Ändring och avbokning

Avbokas uppdraget av uppdragsgivaren senare än 48 timmar före avtalad publicering utgår halva arvodet. Levererar uppdragstagaren inte i tid återbetalas hela beloppet till uppdragsgivaren, om parterna inte kommer överens om ett nytt datum.

## 7. Personuppgifter

Parterna behandlar personuppgifter enligt dataskyddsförordningen (EU) 2016/679. Pacta är personuppgiftsansvarig för uppgifterna i plattformen.

## 8. Tvist

Svensk rätt tillämpas. Tvist avgörs av svensk allmän domstol med Stockholms tingsrätt som första instans.

---

Avtalet undertecknas av båda parter med svenskt BankID. Signaturerna loggas med tidsstämpel och avtalstextens kontrollsumma.', 'COMPLETED', '2026-08-17 08:36:16.038', '2026-08-17 08:36:16.038', '2026-08-30 08:36:16.038', '2026-09-01 08:36:16.034', '2026-09-06 08:36:16.043', '2026-09-06 08:36:16.043', 1000, 1000);
INSERT INTO public."Payment" (id, "contractId", amount, "platformFee", payout, currency, "stripePaymentIntentId", "stripeTransferId", status, "escrowedAt", "releasedAt", "failureReason", "createdAt", "updatedAt") VALUES ('cmtpk4ylq001b7dprgilb28bl', 'cmtpk4yln00197dpr4fefg4j0', 385000, 70000, 315000, 'sek', NULL, NULL, 'RELEASED', '2026-08-19 08:36:16.045', '2026-09-01 08:36:16.034', NULL, '2026-09-06 08:36:16.046', '2026-09-06 08:36:16.046');
INSERT INTO public."Review" (id, "contractId", "authorRole", "authorId", "influencerId", "businessId", rating, communication, "asDescribed", again, comment, "createdAt", "publishedAt", "visibleAt") VALUES ('cmtpk4yls001c7dpr5eu9bji5', 'cmtpk4yln00197dpr4fefg4j0', 'BUSINESS', 'cmtpk4yl2000p7dpryll7o4d2', 'cmtpk4ykk00057dprux4e9li1', 'cmtpk4yl2000q7dprv51a57qe', 4.7, 5, 5, 4, 'Kom när vi kom överens om, förstod direkt vad vi ville visa och filmen låg uppe samma kväll. Vi fick fler bordsbokningar dagen efter.', '2026-09-02 08:36:16.034', '2026-09-02 08:36:16.034', '2026-09-15 08:36:16.034');
INSERT INTO public."Review" (id, "contractId", "authorRole", "authorId", "influencerId", "businessId", rating, communication, "asDescribed", again, comment, "createdAt", "publishedAt", "visibleAt") VALUES ('cmtpk4yls001d7dpro27xzzkv', 'cmtpk4yln00197dpr4fefg4j0', 'INFLUENCER', 'cmtpk4ykk00047dprctirj8ji', 'cmtpk4ykk00057dprux4e9li1', 'cmtpk4yl2000q7dprv51a57qe', 4.7, 4, 5, 5, 'Tydlig brief och de hade förberett allt när jag kom. Betalningen låg spärrad från början, så jag behövde aldrig fundera på om pengarna skulle komma.', '2026-09-02 08:36:16.034', '2026-09-02 08:36:16.034', '2026-09-15 08:36:16.034');
INSERT INTO public."SocialAccount" (id, "influencerId", platform, handle, "externalId", followers, "avgViews", "engagementRate", verified, "accessTokenEnc", "refreshTokenEnc", "tokenExpiresAt", "lastSyncedAt", "createdAt", "updatedAt", "sampleSize", "statsSource") VALUES ('cmtpk4ykb00027dpr755embss', 'cmtpk4ykb00017dprpf8yxg70', 'TIKTOK', 'annaater', NULL, 48000, 39000, 0.071, false, NULL, NULL, NULL, '2026-09-06 08:36:15.993', '2026-09-06 08:36:15.995', '2026-09-06 08:36:15.995', NULL, 'DEMO');
INSERT INTO public."SocialAccount" (id, "influencerId", platform, handle, "externalId", followers, "avgViews", "engagementRate", verified, "accessTokenEnc", "refreshTokenEnc", "tokenExpiresAt", "lastSyncedAt", "createdAt", "updatedAt", "sampleSize", "statsSource") VALUES ('cmtpk4ykb00037dprr30pg9e6', 'cmtpk4ykb00017dprpf8yxg70', 'INSTAGRAM', 'annaater', NULL, 21000, 9000, 0.048, false, NULL, NULL, NULL, '2026-09-06 08:36:15.993', '2026-09-06 08:36:15.995', '2026-09-06 08:36:15.995', NULL, 'DEMO');
INSERT INTO public."SocialAccount" (id, "influencerId", platform, handle, "externalId", followers, "avgViews", "engagementRate", verified, "accessTokenEnc", "refreshTokenEnc", "tokenExpiresAt", "lastSyncedAt", "createdAt", "updatedAt", "sampleSize", "statsSource") VALUES ('cmtpk4ykk00067dpr7qeoy40e', 'cmtpk4ykk00057dprux4e9li1', 'INSTAGRAM', 'kockenerik', NULL, 96000, 41000, 0.032, true, NULL, NULL, NULL, '2026-09-06 08:36:16.004', '2026-09-06 08:36:16.005', '2026-09-06 08:36:16.005', NULL, 'DEMO');
INSERT INTO public."SocialAccount" (id, "influencerId", platform, handle, "externalId", followers, "avgViews", "engagementRate", verified, "accessTokenEnc", "refreshTokenEnc", "tokenExpiresAt", "lastSyncedAt", "createdAt", "updatedAt", "sampleSize", "statsSource") VALUES ('cmtpk4ykl00077dprsk9z91ft', 'cmtpk4ykk00057dprux4e9li1', 'YOUTUBE', 'kockenerik', NULL, 34000, 22000, 0.041, false, NULL, NULL, NULL, '2026-09-06 08:36:16.004', '2026-09-06 08:36:16.005', '2026-09-06 08:36:16.005', NULL, 'DEMO');
INSERT INTO public."SocialAccount" (id, "influencerId", platform, handle, "externalId", followers, "avgViews", "engagementRate", verified, "accessTokenEnc", "refreshTokenEnc", "tokenExpiresAt", "lastSyncedAt", "createdAt", "updatedAt", "sampleSize", "statsSource") VALUES ('cmtpk4yko000a7dpr3zrpv916', 'cmtpk4ykn00097dprtjsrki9p', 'TIKTOK', 'saraiskafferiet', NULL, 14500, 18000, 0.093, false, NULL, NULL, NULL, '2026-09-06 08:36:16.007', '2026-09-06 08:36:16.008', '2026-09-06 08:36:16.008', NULL, 'DEMO');
INSERT INTO public."SocialAccount" (id, "influencerId", platform, handle, "externalId", followers, "avgViews", "engagementRate", verified, "accessTokenEnc", "refreshTokenEnc", "tokenExpiresAt", "lastSyncedAt", "createdAt", "updatedAt", "sampleSize", "statsSource") VALUES ('cmtpk4ykq000d7dpriajzusnr', 'cmtpk4ykq000c7dprwy3t3v7g', 'TIKTOK', 'gbgstreetfood', NULL, 62000, 55000, 0.065, true, NULL, NULL, NULL, '2026-09-06 08:36:16.01', '2026-09-06 08:36:16.011', '2026-09-06 08:36:16.011', NULL, 'DEMO');
INSERT INTO public."SocialAccount" (id, "influencerId", platform, handle, "externalId", followers, "avgViews", "engagementRate", verified, "accessTokenEnc", "refreshTokenEnc", "tokenExpiresAt", "lastSyncedAt", "createdAt", "updatedAt", "sampleSize", "statsSource") VALUES ('cmtpk4ykr000e7dprrzi7j7or', 'cmtpk4ykq000c7dprwy3t3v7g', 'INSTAGRAM', 'gbgstreetfood', NULL, 18000, 7500, 0.039, false, NULL, NULL, NULL, '2026-09-06 08:36:16.01', '2026-09-06 08:36:16.011', '2026-09-06 08:36:16.011', NULL, 'DEMO');
INSERT INTO public."SocialAccount" (id, "influencerId", platform, handle, "externalId", followers, "avgViews", "engagementRate", verified, "accessTokenEnc", "refreshTokenEnc", "tokenExpiresAt", "lastSyncedAt", "createdAt", "updatedAt", "sampleSize", "statsSource") VALUES ('cmtpk4ykt000h7dprtptckstl', 'cmtpk4ykt000g7dprk3k7ovcm', 'INSTAGRAM', 'majagront', NULL, 71000, 28000, 0.044, true, NULL, NULL, NULL, '2026-09-06 08:36:16.013', '2026-09-06 08:36:16.014', '2026-09-06 08:36:16.014', NULL, 'DEMO');
INSERT INTO public."SocialAccount" (id, "influencerId", platform, handle, "externalId", followers, "avgViews", "engagementRate", verified, "accessTokenEnc", "refreshTokenEnc", "tokenExpiresAt", "lastSyncedAt", "createdAt", "updatedAt", "sampleSize", "statsSource") VALUES ('cmtpk4ykw000k7dpr3swqtuuh', 'cmtpk4ykw000j7dprtnl0lc9j', 'TIKTOK', 'oskarpakrogen', NULL, 29000, 24000, 0.058, false, NULL, NULL, NULL, '2026-09-06 08:36:16.015', '2026-09-06 08:36:16.016', '2026-09-06 08:36:16.016', NULL, 'DEMO');
INSERT INTO public."Swipe" (id, "campaignId", "influencerId", actor, direction, "createdAt") VALUES ('cmtpk4ylb000y7dprdmp2uq5o', 'cmtpk4yl5000t7dpr9at5k1pg', 'cmtpk4ykb00017dprpf8yxg70', 'INFLUENCER', 'LIKE', '2026-09-06 08:36:16.031');
INSERT INTO public."Swipe" (id, "campaignId", "influencerId", actor, direction, "createdAt") VALUES ('cmtpk4ylb000z7dprksg6giaw', 'cmtpk4yl5000t7dpr9at5k1pg', 'cmtpk4ykb00017dprpf8yxg70', 'BUSINESS', 'LIKE', '2026-09-06 08:36:16.031');
INSERT INTO public."Swipe" (id, "campaignId", "influencerId", actor, direction, "createdAt") VALUES ('cmtpk4ylg00147dprcwl85prk', 'cmtpk4ylf00137dpr54qdkxxj', 'cmtpk4ykk00057dprux4e9li1', 'INFLUENCER', 'LIKE', '2026-09-06 08:36:16.037');
INSERT INTO public."Swipe" (id, "campaignId", "influencerId", actor, direction, "createdAt") VALUES ('cmtpk4ylg00157dprzx4iv6cy', 'cmtpk4ylf00137dpr54qdkxxj', 'cmtpk4ykk00057dprux4e9li1', 'BUSINESS', 'LIKE', '2026-09-06 08:36:16.037');
