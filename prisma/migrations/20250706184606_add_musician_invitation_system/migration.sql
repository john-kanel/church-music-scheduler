-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'MUSICIAN_JOINED_VIA_LINK';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "invitedVia" TEXT;

-- CreateTable
CREATE TABLE "musician_invite_links" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "musician_invite_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invite_page_views" (
    "id" TEXT NOT NULL,
    "inviteLinkId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "invite_page_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "musician_invite_links_churchId_key" ON "musician_invite_links"("churchId");

-- CreateIndex
CREATE UNIQUE INDEX "musician_invite_links_slug_key" ON "musician_invite_links"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "invite_page_views_inviteLinkId_visitorId_key" ON "invite_page_views"("inviteLinkId", "visitorId");

-- AddForeignKey
ALTER TABLE "musician_invite_links" ADD CONSTRAINT "musician_invite_links_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "parishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_page_views" ADD CONSTRAINT "invite_page_views_inviteLinkId_fkey" FOREIGN KEY ("inviteLinkId") REFERENCES "musician_invite_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
