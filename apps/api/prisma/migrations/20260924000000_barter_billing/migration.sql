-- AlterTable
ALTER TABLE "BusinessProfile" ADD COLUMN     "barterCancelsAt" TIMESTAMP(3),
ADD COLUMN     "barterPastDue" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "barterRenewsAt" TIMESTAMP(3),
ADD COLUMN     "stripeSubscriptionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BusinessProfile_stripeSubscriptionId_key" ON "BusinessProfile"("stripeSubscriptionId");
