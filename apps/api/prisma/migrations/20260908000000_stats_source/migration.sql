-- CreateEnum
CREATE TYPE "StatsSource" AS ENUM ('PLATFORM', 'DEMO');

-- AlterTable
ALTER TABLE "SocialAccount" ADD COLUMN     "sampleSize" INTEGER,
ADD COLUMN     "statsSource" "StatsSource" NOT NULL DEFAULT 'DEMO';

