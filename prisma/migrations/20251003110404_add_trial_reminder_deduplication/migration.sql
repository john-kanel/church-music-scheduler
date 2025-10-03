-- Add trial reminder deduplication fields to email_schedules table
-- This prevents duplicate trial reminder emails from being sent

-- Add new columns for better trial reminder tracking
ALTER TABLE "email_schedules" ADD COLUMN "reminderType" TEXT;
ALTER TABLE "email_schedules" ADD COLUMN "reminderOffset" INTEGER;

-- Add unique constraint to prevent duplicate trial reminders
-- This ensures only one trial reminder per user per offset (7, 1, or 0 days)
CREATE UNIQUE INDEX "unique_trial_reminder_per_user" ON "email_schedules"("churchId", "userId", "reminderType", "reminderOffset") 
WHERE "reminderType" IS NOT NULL AND "reminderOffset" IS NOT NULL;
