-- Tillägg om annonsering: rätten att köra materialet som betald annons.
CREATE TYPE "UsageRightsStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'DECLINED');

CREATE TABLE "UsageRights" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "status" "UsageRightsStatus" NOT NULL DEFAULT 'REQUESTED',
    "months" INTEGER NOT NULL DEFAULT 12,
    "amount" INTEGER NOT NULL,
    "creatorShare" INTEGER NOT NULL,
    "platformShare" INTEGER NOT NULL,
    "terms" TEXT NOT NULL,
    "termsHash" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "stripePaymentIntentId" TEXT,
    "stripeTransferId" TEXT,
    "escrowedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageRights_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UsageRights_contractId_key" ON "UsageRights"("contractId");
CREATE UNIQUE INDEX "UsageRights_stripePaymentIntentId_key" ON "UsageRights"("stripePaymentIntentId");

ALTER TABLE "UsageRights" ADD CONSTRAINT "UsageRights_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
