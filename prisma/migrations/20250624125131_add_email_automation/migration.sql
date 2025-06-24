-- CreateEnum
CREATE TYPE "EmailType" AS ENUM ('WELCOME', 'PAYMENT_CONFIRMATION', 'REFERRAL_PROMOTION');

-- AlterTable
ALTER TABLE "parishes" ADD COLUMN     "paymentEmailSentAt" TIMESTAMP(3),
ADD COLUMN     "referralEmailSentAt" TIMESTAMP(3),
ADD COLUMN     "welcomeEmailSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "email_schedules" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailType" "EmailType" NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastAttemptAt" TIMESTAMP(3),
    "errorReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_schedules_pkey" PRIMARY KEY ("id")
);
