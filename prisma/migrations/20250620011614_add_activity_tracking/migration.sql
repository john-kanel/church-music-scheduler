/*
  Warnings:

  - You are about to drop the column `username` on the `admin_users` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('EVENT_CREATED', 'MUSICIAN_INVITED', 'MUSICIAN_SIGNED_UP', 'MESSAGE_SENT');

-- DropIndex
DROP INDEX "admin_users_username_key";

-- AlterTable
ALTER TABLE "admin_users" DROP COLUMN "username",
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'admin';

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parishId" TEXT NOT NULL,
    "userId" TEXT,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_parishId_fkey" FOREIGN KEY ("parishId") REFERENCES "parishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
