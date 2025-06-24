-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('MUSICIAN_EVENT_REMINDER', 'PASTOR_DAILY_DIGEST', 'PASTOR_MONTHLY_REPORT', 'EVENT_CANCELLED', 'EVENT_UPDATED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'AUTOMATED_NOTIFICATION_SENT';
ALTER TYPE "ActivityType" ADD VALUE 'AUTOMATION_SETTINGS_UPDATED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'America/Chicago';

-- CreateTable
CREATE TABLE "automation_settings" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "pastorEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pastorMonthlyReportDay" INTEGER NOT NULL DEFAULT 27,
    "pastorDailyDigestEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pastorDailyDigestTime" TEXT NOT NULL DEFAULT '08:00',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "musician_notifications" (
    "id" TEXT NOT NULL,
    "automationSettingsId" TEXT NOT NULL,
    "hoursBeforeEvent" INTEGER NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "musician_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pastor_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyDigestEnabled" BOOLEAN NOT NULL DEFAULT true,
    "monthlyReportEnabled" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'America/Chicago',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pastor_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "churchId" TEXT NOT NULL,
    "eventId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "content" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "metadata" JSONB,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "automation_settings_churchId_key" ON "automation_settings"("churchId");

-- CreateIndex
CREATE UNIQUE INDEX "pastor_settings_userId_key" ON "pastor_settings"("userId");

-- AddForeignKey
ALTER TABLE "automation_settings" ADD CONSTRAINT "automation_settings_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "parishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "musician_notifications" ADD CONSTRAINT "musician_notifications_automationSettingsId_fkey" FOREIGN KEY ("automationSettingsId") REFERENCES "automation_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pastor_settings" ADD CONSTRAINT "pastor_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "parishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
