-- AlterTable
ALTER TABLE "events" ADD COLUMN     "isModified" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "events_generatedFrom_isModified_idx" ON "events"("generatedFrom", "isModified");
