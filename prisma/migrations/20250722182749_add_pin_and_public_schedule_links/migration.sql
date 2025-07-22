-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('CONFIRMED', 'TENTATIVE', 'CANCELLED');

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "status" "EventStatus" NOT NULL DEFAULT 'CONFIRMED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "pin" TEXT;

-- CreateTable
CREATE TABLE "public_schedule_links" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_schedule_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "public_schedule_links_token_key" ON "public_schedule_links"("token");

-- CreateIndex
CREATE INDEX "public_schedule_links_token_idx" ON "public_schedule_links"("token");

-- CreateIndex
CREATE INDEX "public_schedule_links_churchId_idx" ON "public_schedule_links"("churchId");

-- AddForeignKey
ALTER TABLE "public_schedule_links" ADD CONSTRAINT "public_schedule_links_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "parishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
