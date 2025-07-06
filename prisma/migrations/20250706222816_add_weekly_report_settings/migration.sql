-- AlterTable
ALTER TABLE "automation_settings" ADD COLUMN     "pastorWeeklyReportDay" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "pastorWeeklyReportEnabled" BOOLEAN NOT NULL DEFAULT false;
