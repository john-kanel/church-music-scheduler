-- CreateEnum
CREATE TYPE "CalendarFilterType" AS ENUM ('ALL', 'GROUPS', 'EVENT_TYPES');

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "calendarNeedsUpdate" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "calendar_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionToken" TEXT NOT NULL,
    "filterType" "CalendarFilterType" NOT NULL DEFAULT 'ALL',
    "groupIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "eventTypeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "feedUrl" TEXT,
    "needsUpdate" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "calendar_subscriptions_subscriptionToken_key" ON "calendar_subscriptions"("subscriptionToken");

-- CreateIndex
CREATE INDEX "calendar_subscriptions_needsUpdate_idx" ON "calendar_subscriptions"("needsUpdate");

-- CreateIndex
CREATE INDEX "calendar_subscriptions_subscriptionToken_idx" ON "calendar_subscriptions"("subscriptionToken");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_subscriptions_userId_key" ON "calendar_subscriptions"("userId");

-- CreateIndex
CREATE INDEX "events_calendarNeedsUpdate_idx" ON "events"("calendarNeedsUpdate");

-- AddForeignKey
ALTER TABLE "calendar_subscriptions" ADD CONSTRAINT "calendar_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
