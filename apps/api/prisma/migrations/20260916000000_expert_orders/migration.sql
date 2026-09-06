-- "Låt en Pacta-expert skapa kampanjen": beställning, kö och leverans.
CREATE TYPE "ExpertOrderStatus" AS ENUM ('REQUESTED', 'IN_PROGRESS', 'DELIVERED', 'APPROVED', 'CANCELLED');

CREATE TABLE "ExpertOrder" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "status" "ExpertOrderStatus" NOT NULL DEFAULT 'REQUESTED',
    "goal" TEXT NOT NULL,
    "timing" TEXT NOT NULL,
    "budget" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "campaignId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "stripePaymentIntentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpertOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExpertOrder_campaignId_key" ON "ExpertOrder"("campaignId");
CREATE UNIQUE INDEX "ExpertOrder_stripePaymentIntentId_key" ON "ExpertOrder"("stripePaymentIntentId");
CREATE INDEX "ExpertOrder_status_idx" ON "ExpertOrder"("status");

ALTER TABLE "ExpertOrder" ADD CONSTRAINT "ExpertOrder_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpertOrder" ADD CONSTRAINT "ExpertOrder_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
