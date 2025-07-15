/*
  Warnings:

  - You are about to drop the column `templateId` on the `events` table. All the data in the column will be lost.
  - You are about to drop the `event_templates` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `template_hymns` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `template_roles` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "event_templates" DROP CONSTRAINT "event_templates_churchId_fkey";

-- DropForeignKey
ALTER TABLE "events" DROP CONSTRAINT "events_templateId_fkey";

-- DropForeignKey
ALTER TABLE "template_hymns" DROP CONSTRAINT "template_hymns_servicePartId_fkey";

-- DropForeignKey
ALTER TABLE "template_hymns" DROP CONSTRAINT "template_hymns_templateId_fkey";

-- DropForeignKey
ALTER TABLE "template_roles" DROP CONSTRAINT "template_roles_templateId_fkey";

-- AlterTable
ALTER TABLE "events" DROP COLUMN "templateId",
ADD COLUMN     "assignedGroups" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "generatedFrom" TEXT,
ADD COLUMN     "isRootEvent" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "event_templates";

-- DropTable
DROP TABLE "template_hymns";

-- DropTable
DROP TABLE "template_roles";

-- CreateIndex
CREATE INDEX "events_parentEventId_idx" ON "events"("parentEventId");

-- CreateIndex
CREATE INDEX "events_isRootEvent_churchId_idx" ON "events"("isRootEvent", "churchId");
