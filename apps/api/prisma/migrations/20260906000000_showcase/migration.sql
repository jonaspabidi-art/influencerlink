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
