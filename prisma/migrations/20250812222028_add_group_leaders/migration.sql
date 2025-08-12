-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "leaderIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
