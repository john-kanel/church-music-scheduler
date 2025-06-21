/*
  Warnings:

  - Added the required column `referralCode` to the `referrals` table without a default value. This is not possible if the table is not empty.
  - Added the required column `referredPersonName` to the `referrals` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "parishes" ADD COLUMN     "referralRewardsEarned" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "referralRewardsSaved" DECIMAL(65,30) NOT NULL DEFAULT 0.00;

-- AlterTable
ALTER TABLE "referrals" ADD COLUMN     "referralCode" TEXT NOT NULL,
ADD COLUMN     "referredChurchId" TEXT,
ADD COLUMN     "referredPersonName" TEXT NOT NULL,
ADD COLUMN     "rewardProcessed" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referredChurchId_fkey" FOREIGN KEY ("referredChurchId") REFERENCES "parishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
