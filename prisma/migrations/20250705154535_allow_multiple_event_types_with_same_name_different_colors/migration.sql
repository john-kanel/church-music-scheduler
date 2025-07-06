/*
  Warnings:

  - A unique constraint covering the columns `[name,color,churchId]` on the table `event_types` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "event_types_name_churchId_key";

-- CreateIndex
CREATE UNIQUE INDEX "event_types_name_color_churchId_key" ON "event_types"("name", "color", "churchId");
