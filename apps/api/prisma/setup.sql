-- InfluencerLink: skapar alla tabeller och lägger in demodata.
-- Klistra in allt i Supabase SQL Editor och tryck Run. Körs en gång.

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

INSERT INTO public."User" VALUES ('cmtnc1h0l00007drmef4r8uxa', 'INFLUENCER', 'e1f4bb327cafad910b748c9cf12ebd64aa1b1acd9cc9eb0145ec8d6e5f9a2d8a', '19920315-****', 'Anna Karlsson', NULL, NULL, '2026-09-04 19:14:04.003', true, '2026-09-04 19:14:04.005', '2026-09-04 19:14:04.005');
INSERT INTO public."User" VALUES ('cmtnc1h0s00047drmnw69zsq9', 'INFLUENCER', '835522d930a799e560a309e69664fbea2d0486f99395b786e64f580d04e018da', '19880722-****', 'Erik Lindberg', NULL, NULL, '2026-09-04 19:14:04.012', true, '2026-09-04 19:14:04.013', '2026-09-04 19:14:04.013');
INSERT INTO public."User" VALUES ('cmtnc1h0w00087drm18ehvtya', 'INFLUENCER', '58b5b012f8abc5b04cbeb098a81565318356249c55f2769fb22ecb5bde318d3b', '19991102-****', 'Sara Nyström', NULL, NULL, '2026-09-04 19:14:04.015', true, '2026-09-04 19:14:04.016', '2026-09-04 19:14:04.016');
INSERT INTO public."User" VALUES ('cmtnc1h0z000b7drmn1fy6ykp', 'INFLUENCER', '8b9905452bd869960bbdce102661f604b644d69b7aee456880b491e74b065aed', '19950530-****', 'Johan Bergqvist', NULL, NULL, '2026-09-04 19:14:04.019', true, '2026-09-04 19:14:04.02', '2026-09-04 19:14:04.02');
INSERT INTO public."User" VALUES ('cmtnc1h12000f7drmgfrl8qx3', 'INFLUENCER', '1140743a28b2460a95aa169ab4e46baf0d8a6532af2398578cea6e23530b7975', '19940117-****', 'Maja Öberg', NULL, NULL, '2026-09-04 19:14:04.022', true, '2026-09-04 19:14:04.023', '2026-09-04 19:14:04.023');
INSERT INTO public."User" VALUES ('cmtnc1h15000i7drmk8erycri', 'INFLUENCER', '6c6c36e462b1609aa7d507dfad899a619b1e950e22f35ae7bb4d46e9f1f1160e', '20010228-****', 'Oskar Holm', NULL, NULL, '2026-09-04 19:14:04.025', true, '2026-09-04 19:14:04.026', '2026-09-04 19:14:04.026');
INSERT INTO public."User" VALUES ('cmtnc1h18000l7drmaygd0wjw', 'BUSINESS', '9431d29729752576901b65e282f703b9c7487f864907c91883e2dda4af28a3f9', '19700101-****', 'Petra Sandell', NULL, NULL, '2026-09-04 19:14:04.028', true, '2026-09-04 19:14:04.029', '2026-09-04 19:14:04.029');
INSERT INTO public."User" VALUES ('cmtnc1h1b000n7drmbnles470', 'BUSINESS', 'c2e8cdd51c1076cac950300a2acc1a5df2c1a2034142e447252675157a06b1ce', '19801212-****', 'Ali Rahimi', NULL, NULL, '2026-09-04 19:14:04.031', true, '2026-09-04 19:14:04.032', '2026-09-04 19:14:04.032');



INSERT INTO public."BusinessProfile" VALUES ('cmtnc1h18000m7drm8vy9nwoe', 'cmtnc1h18000l7drmaygd0wjw', 'Restaurang Kajutan', '5560123456', 'Göteborg', 'Kungsportsavenyen 12, 411 36 Göteborg', 'Västkustkök med råvaror från Fiskhamnen. 60 sittplatser.', NULL, '{RESTAURANG,FINE_DINING}', NULL, '2026-09-04 19:14:04.029', '2026-09-04 19:14:04.029');
INSERT INTO public."BusinessProfile" VALUES ('cmtnc1h1b000o7drmtfw3df98', 'cmtnc1h1b000n7drmbnles470', 'Bageri Solrosen', '5569876543', 'Göteborg', 'Andra Långgatan 4, 413 03 Göteborg', 'Surdegsbageri och kafé i Linné. Öppnar 07 varje dag.', NULL, '{BAGERI,CAFE}', NULL, '2026-09-04 19:14:04.032', '2026-09-04 19:14:04.032');



INSERT INTO public."Campaign" VALUES ('cmtnc1h1e000q7drmk72tm4sx', 'cmtnc1h18000m7drm8vy9nwoe', 'Lansera vår nya lunchmeny', 'Vi byter till en ny lunchmeny med råvaror från Fiskhamnen. Du kommer förbi en vardag mellan 11 och 14, äter på vår bekostnad och gör innehåll som visar rätterna och stämningen i lokalen. Ta gärna med att lunchen kostar 145 kr inklusive kaffe.', '{RESTAURANG,MAT_OCH_DRYCK}', '{TIKTOK,INSTAGRAM}', '{TIKTOK_VIDEO,INSTAGRAM_STORY}', 'HYBRID', 400000, 30000, 3, 'Göteborg', 10000, '2026-09-04 19:14:04.034', '2026-11-03 19:14:04.033', 'ACTIVE', '2026-09-04 19:14:04.034', '2026-09-04 19:14:04.034');
INSERT INTO public."Campaign" VALUES ('cmtnc1h1h000s7drm9ikv0pgk', 'cmtnc1h18000m7drm8vy9nwoe', 'Smakmeny för matintresserade', 'Sexrättersmeny med dryckespaket för dig som gör innehåll om fine dining. Vi vill ha en längre film där du berättar om rätterna och köket.', '{FINE_DINING,RESTAURANG}', '{YOUTUBE,INSTAGRAM}', '{YOUTUBE_VIDEO,INSTAGRAM_POST}', 'HYBRID', 1200000, 240000, 1, 'Göteborg', 30000, '2026-09-04 19:14:04.037', '2026-11-03 19:14:04.033', 'ACTIVE', '2026-09-04 19:14:04.038', '2026-09-04 19:14:04.038');
INSERT INTO public."Campaign" VALUES ('cmtnc1h1j000u7drmaoo4ltvx', 'cmtnc1h1b000o7drmtfw3df98', 'Morgonbröd och kaffe i Linné', 'Vi vill nå studenter och folk som jobbar hemifrån. Kom förbi på förmiddagen, visa surdegen och våra sittplatser. Nämn att vi öppnar 07.', '{BAGERI,CAFE}', '{TIKTOK,INSTAGRAM}', '{TIKTOK_VIDEO}', 'PRODUCT', 0, 40000, 5, 'Göteborg', 3000, '2026-09-04 19:14:04.038', '2026-09-18 19:14:04.033', 'ACTIVE', '2026-09-04 19:14:04.039', '2026-09-04 19:14:04.039');
INSERT INTO public."Campaign" VALUES ('cmtnc1h1p00107drmngu00i0a', 'cmtnc1h1b000o7drmtfw3df98', 'Fredagsfika med kanelbullar', 'Vi bakade extra inför fredagen och ville visa det. En kortare film från disken och en story när bullarna kommer ut ur ugnen.', '{BAGERI,CAFE}', '{INSTAGRAM}', '{INSTAGRAM_REEL}', 'FIXED', 350000, 0, 1, 'Göteborg', 3000, '2026-08-05 19:14:04.044', '2026-08-23 19:14:04.044', 'CLOSED', '2026-09-04 19:14:04.045', '2026-09-04 19:14:04.045');



INSERT INTO public."InfluencerProfile" VALUES ('cmtnc1h0l00017drmgk03kxo8', 'cmtnc1h0l00007drmef4r8uxa', 'annaäter', 'Testar Göteborgs lunchställen varje vardag. Kort, snabbt, ärligt.', 'Göteborg', NULL, '{RESTAURANG,MAT_OCH_DRYCK,LIVSSTIL}', 200000, 450000, 'acct_demo_annaäter', true, '2026-09-04 19:14:04.005', '2026-09-04 19:14:04.005');
INSERT INTO public."InfluencerProfile" VALUES ('cmtnc1h0s00057drm5cfznkc1', 'cmtnc1h0s00047drmnw69zsq9', 'Kocken Erik', 'Utbildad kock som recenserar fine dining och nya öppningar.', 'Göteborg', NULL, '{FINE_DINING,RESTAURANG}', 500000, 1200000, 'acct_demo_Kocken Erik', true, '2026-09-04 19:14:04.013', '2026-09-04 19:14:04.013');
INSERT INTO public."InfluencerProfile" VALUES ('cmtnc1h0w00097drm2iggx81n', 'cmtnc1h0w00087drm18ehvtya', 'saraiskafferiet', 'Kaféhäng, bakverk och studieplatser med bra kaffe.', 'Göteborg', NULL, '{CAFE,BAGERI,LIVSSTIL}', 120000, 280000, 'acct_demo_saraiskafferiet', true, '2026-09-04 19:14:04.016', '2026-09-04 19:14:04.016');
INSERT INTO public."InfluencerProfile" VALUES ('cmtnc1h0z000c7drmulitlz48', 'cmtnc1h0z000b7drmn1fy6ykp', 'gbgstreetfood', 'Street food, food trucks och sena kvällsmackor.', 'Göteborg', NULL, '{STREET_FOOD,MAT_OCH_DRYCK}', 150000, 350000, 'acct_demo_gbgstreetfood', true, '2026-09-04 19:14:04.02', '2026-09-04 19:14:04.02');
INSERT INTO public."InfluencerProfile" VALUES ('cmtnc1h12000g7drm4s421lw4', 'cmtnc1h12000f7drmgfrl8qx3', 'majagront', 'Vegetariskt och veganskt i Stockholm. Recept och restaurangtips.', 'Stockholm', NULL, '{VEGETARISKT,MAT_OCH_DRYCK}', 300000, 700000, 'acct_demo_majagront', true, '2026-09-04 19:14:04.023', '2026-09-04 19:14:04.023');
INSERT INTO public."InfluencerProfile" VALUES ('cmtnc1h15000j7drm6onhdad5', 'cmtnc1h15000i7drmk8erycri', 'oskarpakrogen', 'Barer, cocktails och afterwork. 21+.', 'Göteborg', NULL, '{BAR,NOJE}', 250000, 550000, 'acct_demo_oskarpakrogen', true, '2026-09-04 19:14:04.026', '2026-09-04 19:14:04.026');












INSERT INTO public."Match" VALUES ('cmtnc1h1m000y7drmh0pllpfn', 'cmtnc1h1e000q7drmk72tm4sx', 'cmtnc1h0l00017drmgk03kxo8', 'IN_CONVERSATION', 94, 'Täcker alla nischer kampanjen efterfrågar', '2026-09-04 19:14:04.043', '2026-09-04 19:14:04.043');
INSERT INTO public."Match" VALUES ('cmtnc1h1s00147drmk6g5qaxj', 'cmtnc1h1p00107drmngu00i0a', 'cmtnc1h0s00057drm5cfznkc1', 'CONTRACTED', 88, 'Finns på plats i Göteborg och gör mat i samma stil', '2026-09-04 19:14:04.048', '2026-09-04 19:14:04.048');



INSERT INTO public."Contract" VALUES ('cmtnc1h1z00167drmhc6olick', 'cmtnc1h1s00147drmk6g5qaxj', 'cmtnc1h1p00107drmngu00i0a', 'cmtnc1h0s00057drm5cfznkc1', 350000, 1200, '{INSTAGRAM_REEL}', '2026-08-23 19:14:04.044', 7, '# Samarbetsavtal

**Avtalsnummer:** seed-fredagsfika

## 1. Parter

**Uppdragsgivare:** Bageri Solrosen, org.nr 556987-6543
**Uppdragstagare:** Kocken Erik, personnr 19900101-****

Avtalet ingås via InfluencerLink, som förmedlar uppdraget och hanterar betalningen.

## 2. Uppdraget

Kampanj: **Fredagsfika med kanelbullar**

Vi bakade extra inför fredagen och ville visa det. En kortare film från disken och en story när bullarna kommer ut ur ugnen.

Uppdragstagaren ska leverera:

1. en Instagram Reel (minst 15 sekunder)

Materialet ska vara publicerat senast **23 augusti 2026**.

## 3. Ersättning

| Post | Belopp |
| --- | --- |
| Arvode | 3 500 kr |
| Plattformsavgift (12.0 %) | −420 kr |
| **Utbetalas till uppdragstagaren** | **3 080 kr** |

Uppdragsgivaren betalar in hela arvodet till InfluencerLink när avtalet blir bindande. Beloppet hålls kvar och betalas ut till uppdragstagaren när leveransen godkänts. Uppdragsgivaren har 7 dagar på sig att granska leveransen; därefter godkänns den automatiskt och utbetalning sker.

Angivna belopp är exklusive mervärdesskatt. Uppdragstagaren ansvarar själv för skatt och eventuella sociala avgifter på ersättningen.

## 4. Marknadsföringsrättslig märkning

Uppdragstagaren ska tydligt märka allt material som reklam i enlighet med marknadsföringslagen (2008:486) och Konsumentverkets vägledning, till exempel med "Reklam för Bageri Solrosen" eller "Samarbete". Märkningen ska synas utan att mottagaren behöver klicka vidare.

## 5. Rättigheter till materialet

Uppdragstagaren behåller upphovsrätten till materialet. Uppdragsgivaren får en icke-exklusiv rätt att återpublicera materialet i sina egna kanaler i sex (6) månader från publiceringen, med angivande av uppdragstagarens användarnamn. All annan användning, inklusive betald annonsering, kräver skriftligt medgivande.

## 6. Ändring och avbokning

Avbokas uppdraget av uppdragsgivaren senare än 48 timmar före avtalad publicering utgår halva arvodet. Levererar uppdragstagaren inte i tid återbetalas hela beloppet till uppdragsgivaren, om parterna inte kommer överens om ett nytt datum.

## 7. Personuppgifter

Parterna behandlar personuppgifter enligt dataskyddsförordningen (EU) 2016/679. InfluencerLink är personuppgiftsansvarig för uppgifterna i plattformen.

## 8. Tvist

Svensk rätt tillämpas. Tvist avgörs av svensk allmän domstol med Stockholms tingsrätt som första instans.


Avtalet undertecknas av båda parter med svenskt BankID. Signaturerna loggas med tidsstämpel och avtalstextens kontrollsumma.', 'COMPLETED', '2026-08-15 19:14:04.049', '2026-08-15 19:14:04.049', '2026-08-28 19:14:04.049', '2026-08-30 19:14:04.044', '2026-09-04 19:14:04.056', '2026-09-04 19:14:04.056');









INSERT INTO public."Payment" VALUES ('cmtnc1h2300187drmqgpkqhat', 'cmtnc1h1z00167drmhc6olick', 350000, 42000, 308000, 'sek', NULL, NULL, 'RELEASED', '2026-08-17 19:14:04.058', '2026-08-30 19:14:04.044', NULL, '2026-09-04 19:14:04.059', '2026-09-04 19:14:04.059');






INSERT INTO public."Review" VALUES ('cmtnc1h2600197drmw6jit5q6', 'cmtnc1h1z00167drmhc6olick', 'BUSINESS', 'cmtnc1h1b000n7drmbnles470', 'cmtnc1h0s00057drm5cfznkc1', 'cmtnc1h1b000o7drmtfw3df98', 4.7, 5, 5, 4, 'Kom när vi kom överens om, förstod direkt vad vi ville visa och filmen låg uppe samma kväll. Vi fick fler bordsbokningar dagen efter.', '2026-08-31 19:14:04.044', '2026-08-31 19:14:04.044', '2026-09-13 19:14:04.044');
INSERT INTO public."Review" VALUES ('cmtnc1h26001a7drmnngytxkb', 'cmtnc1h1z00167drmhc6olick', 'INFLUENCER', 'cmtnc1h0s00047drmnw69zsq9', 'cmtnc1h0s00057drm5cfznkc1', 'cmtnc1h1b000o7drmtfw3df98', 4.7, 4, 5, 5, 'Tydlig brief och de hade förberett allt när jag kom. Betalningen låg spärrad från början, så jag behövde aldrig fundera på om pengarna skulle komma.', '2026-08-31 19:14:04.044', '2026-08-31 19:14:04.044', '2026-09-13 19:14:04.044');






INSERT INTO public."SocialAccount" VALUES ('cmtnc1h0l00027drmlkf06mwq', 'cmtnc1h0l00017drmgk03kxo8', 'TIKTOK', 'annaater', NULL, 48000, 39000, 0.071, false, NULL, NULL, NULL, '2026-09-04 19:14:04.003', '2026-09-04 19:14:04.005', '2026-09-04 19:14:04.005');
INSERT INTO public."SocialAccount" VALUES ('cmtnc1h0l00037drmzah35vy3', 'cmtnc1h0l00017drmgk03kxo8', 'INSTAGRAM', 'annaater', NULL, 21000, 9000, 0.048, false, NULL, NULL, NULL, '2026-09-04 19:14:04.003', '2026-09-04 19:14:04.005', '2026-09-04 19:14:04.005');
INSERT INTO public."SocialAccount" VALUES ('cmtnc1h0s00067drm1xlkwiqa', 'cmtnc1h0s00057drm5cfznkc1', 'INSTAGRAM', 'kockenerik', NULL, 96000, 41000, 0.032, true, NULL, NULL, NULL, '2026-09-04 19:14:04.012', '2026-09-04 19:14:04.013', '2026-09-04 19:14:04.013');
INSERT INTO public."SocialAccount" VALUES ('cmtnc1h0t00077drmwknq38sk', 'cmtnc1h0s00057drm5cfznkc1', 'YOUTUBE', 'kockenerik', NULL, 34000, 22000, 0.041, false, NULL, NULL, NULL, '2026-09-04 19:14:04.012', '2026-09-04 19:14:04.013', '2026-09-04 19:14:04.013');
INSERT INTO public."SocialAccount" VALUES ('cmtnc1h0w000a7drm7hc5o5l5', 'cmtnc1h0w00097drm2iggx81n', 'TIKTOK', 'saraiskafferiet', NULL, 14500, 18000, 0.093, false, NULL, NULL, NULL, '2026-09-04 19:14:04.015', '2026-09-04 19:14:04.016', '2026-09-04 19:14:04.016');
INSERT INTO public."SocialAccount" VALUES ('cmtnc1h0z000d7drmp21di518', 'cmtnc1h0z000c7drmulitlz48', 'TIKTOK', 'gbgstreetfood', NULL, 62000, 55000, 0.065, true, NULL, NULL, NULL, '2026-09-04 19:14:04.019', '2026-09-04 19:14:04.02', '2026-09-04 19:14:04.02');
INSERT INTO public."SocialAccount" VALUES ('cmtnc1h0z000e7drmekb2mt8r', 'cmtnc1h0z000c7drmulitlz48', 'INSTAGRAM', 'gbgstreetfood', NULL, 18000, 7500, 0.039, false, NULL, NULL, NULL, '2026-09-04 19:14:04.019', '2026-09-04 19:14:04.02', '2026-09-04 19:14:04.02');
INSERT INTO public."SocialAccount" VALUES ('cmtnc1h12000h7drmtekfgzsc', 'cmtnc1h12000g7drm4s421lw4', 'INSTAGRAM', 'majagront', NULL, 71000, 28000, 0.044, true, NULL, NULL, NULL, '2026-09-04 19:14:04.022', '2026-09-04 19:14:04.023', '2026-09-04 19:14:04.023');
INSERT INTO public."SocialAccount" VALUES ('cmtnc1h15000k7drmk77yxw5f', 'cmtnc1h15000j7drm6onhdad5', 'TIKTOK', 'oskarpakrogen', NULL, 29000, 24000, 0.058, false, NULL, NULL, NULL, '2026-09-04 19:14:04.025', '2026-09-04 19:14:04.026', '2026-09-04 19:14:04.026');



INSERT INTO public."Swipe" VALUES ('cmtnc1h1k000v7drmrnomvo5d', 'cmtnc1h1e000q7drmk72tm4sx', 'cmtnc1h0l00017drmgk03kxo8', 'INFLUENCER', 'LIKE', '2026-09-04 19:14:04.041');
INSERT INTO public."Swipe" VALUES ('cmtnc1h1k000w7drmqytvqleq', 'cmtnc1h1e000q7drmk72tm4sx', 'cmtnc1h0l00017drmgk03kxo8', 'BUSINESS', 'LIKE', '2026-09-04 19:14:04.041');
INSERT INTO public."Swipe" VALUES ('cmtnc1h1q00117drmaft7lu5m', 'cmtnc1h1p00107drmngu00i0a', 'cmtnc1h0s00057drm5cfznkc1', 'INFLUENCER', 'LIKE', '2026-09-04 19:14:04.047');
INSERT INTO public."Swipe" VALUES ('cmtnc1h1q00127drmp5vm3t73', 'cmtnc1h1p00107drmngu00i0a', 'cmtnc1h0s00057drm5cfznkc1', 'BUSINESS', 'LIKE', '2026-09-04 19:14:04.047');
