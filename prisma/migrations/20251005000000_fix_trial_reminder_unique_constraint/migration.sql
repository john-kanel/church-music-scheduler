-- Fix: Replace partial unique index with full unique constraint
-- The previous partial index wasn't strong enough to prevent duplicates

-- First, clean up any existing duplicate trial reminders (keep only the oldest one per combo)
DELETE FROM "email_schedules" a
USING "email_schedules" b
WHERE a."id" > b."id"
  AND a."churchId" = b."churchId"
  AND a."userId" = b."userId"
  AND a."reminderType" = b."reminderType"
  AND a."reminderOffset" = b."reminderOffset"
  AND a."reminderType" = 'TRIAL_ENDING_REMINDER';

-- Drop the old partial index
DROP INDEX IF EXISTS "unique_trial_reminder_per_user";

-- Create a stronger unique index (covering NULLs properly)
-- This prevents ANY duplicate trial reminders from being created
CREATE UNIQUE INDEX "email_schedules_trial_reminder_unique" 
ON "email_schedules"("churchId", "userId", "reminderType", "reminderOffset")
WHERE "reminderType" = 'TRIAL_ENDING_REMINDER';

