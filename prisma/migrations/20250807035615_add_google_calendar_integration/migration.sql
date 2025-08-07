/*
  Warnings:

  - You are about to drop the column `officiant` on the `events` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "events" DROP COLUMN "officiant";

-- CreateTable
CREATE TABLE "google_calendar_integrations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "tokenType" TEXT NOT NULL DEFAULT 'Bearer',
    "expiryDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_calendar_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_calendar_events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "googleEventId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "google_calendar_integrations_userId_key" ON "google_calendar_integrations"("userId");

-- CreateIndex
CREATE INDEX "google_calendar_integrations_userId_idx" ON "google_calendar_integrations"("userId");

-- CreateIndex
CREATE INDEX "google_calendar_integrations_isActive_idx" ON "google_calendar_integrations"("isActive");

-- CreateIndex
CREATE INDEX "google_calendar_events_eventId_idx" ON "google_calendar_events"("eventId");

-- CreateIndex
CREATE INDEX "google_calendar_events_integrationId_idx" ON "google_calendar_events"("integrationId");

-- CreateIndex
CREATE INDEX "google_calendar_events_googleEventId_idx" ON "google_calendar_events"("googleEventId");

-- CreateIndex
CREATE UNIQUE INDEX "google_calendar_events_eventId_integrationId_key" ON "google_calendar_events"("eventId", "integrationId");

-- AddForeignKey
ALTER TABLE "google_calendar_integrations" ADD CONSTRAINT "google_calendar_integrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_calendar_events" ADD CONSTRAINT "google_calendar_events_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_calendar_events" ADD CONSTRAINT "google_calendar_events_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "google_calendar_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
