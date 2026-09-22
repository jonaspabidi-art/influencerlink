-- CreateEnum
CREATE TYPE "BarterPlan" AS ENUM ('NONE', 'BASIC', 'MEDIUM', 'ADVANCED');

-- AlterTable
ALTER TABLE "BusinessProfile" ADD COLUMN     "barterPlan" "BarterPlan" NOT NULL DEFAULT 'NONE';
