-- CreateEnum
CREATE TYPE "RetainerStatus" AS ENUM ('REQUESTED', 'DECLINED', 'ACTIVE', 'CANCELLING', 'ENDED');

-- CreateEnum
CREATE TYPE "RetainerPeriodStatus" AS ENUM ('AWAITING_PAYMENT', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "RetainerPostStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'PUBLISHED');

-- AlterTable
ALTER TABLE "InfluencerProfile" ADD COLUMN     "acceptsRetainers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retainerBaseRate" INTEGER,
ADD COLUMN     "retainerSlots" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Retainer" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "videosPerMonth" INTEGER NOT NULL,
    "listRate" INTEGER NOT NULL,
    "monthlyRate" INTEGER NOT NULL,
    "prepaidMonths" INTEGER NOT NULL DEFAULT 1,
    "businessFeeBps" INTEGER NOT NULL DEFAULT 1000,
    "creatorFeeBps" INTEGER NOT NULL DEFAULT 1000,
    "status" "RetainerStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestNote" TEXT NOT NULL DEFAULT '',
    "terms" TEXT NOT NULL DEFAULT '',
    "accessGrantedAt" TIMESTAMP(3),
    "accessRevokedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Retainer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetainerPeriod" (
    "id" TEXT NOT NULL,
    "retainerId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "videosAgreed" INTEGER NOT NULL,
    "grossAmount" INTEGER NOT NULL,
    "chargeAmount" INTEGER NOT NULL,
    "releasedAmount" INTEGER NOT NULL DEFAULT 0,
    "refundedAmount" INTEGER NOT NULL DEFAULT 0,
    "platformFee" INTEGER NOT NULL DEFAULT 0,
    "status" "RetainerPeriodStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "stripePaymentIntentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "RetainerPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetainerPost" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL DEFAULT '',
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "caption" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "status" "RetainerPostStatus" NOT NULL DEFAULT 'PENDING',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "reviewNote" TEXT NOT NULL DEFAULT '',
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publishedUrl" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetainerPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Retainer_businessId_status_idx" ON "Retainer"("businessId", "status");

-- CreateIndex
CREATE INDEX "Retainer_influencerId_status_idx" ON "Retainer"("influencerId", "status");

-- CreateIndex
CREATE INDEX "RetainerPeriod_status_endsAt_idx" ON "RetainerPeriod"("status", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "RetainerPeriod_retainerId_index_key" ON "RetainerPeriod"("retainerId", "index");

-- CreateIndex
CREATE INDEX "RetainerPost_periodId_status_idx" ON "RetainerPost"("periodId", "status");

-- CreateIndex
CREATE INDEX "InfluencerProfile_acceptsRetainers_idx" ON "InfluencerProfile"("acceptsRetainers");

-- AddForeignKey
ALTER TABLE "Retainer" ADD CONSTRAINT "Retainer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Retainer" ADD CONSTRAINT "Retainer_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "InfluencerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetainerPeriod" ADD CONSTRAINT "RetainerPeriod_retainerId_fkey" FOREIGN KEY ("retainerId") REFERENCES "Retainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetainerPost" ADD CONSTRAINT "RetainerPost_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "RetainerPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
