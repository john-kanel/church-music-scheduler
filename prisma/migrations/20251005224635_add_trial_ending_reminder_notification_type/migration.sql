-- Add TRIAL_ENDING_REMINDER to NotificationType enum
-- This fixes the error where trial reminder emails fail to log because the enum value doesn't exist

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TRIAL_ENDING_REMINDER';

