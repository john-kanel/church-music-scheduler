-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "instruments" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "skillLevel" "SkillLevel" NOT NULL DEFAULT 'INTERMEDIATE',
ADD COLUMN     "yearsExperience" INTEGER;
