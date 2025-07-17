-- AlterTable
ALTER TABLE "users" ADD COLUMN     "calendarLink" TEXT;

-- CreateTable
CREATE TABLE "musician_unavailabilities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "dayOfWeek" INTEGER,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "musician_unavailabilities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "musician_unavailabilities_userId_idx" ON "musician_unavailabilities"("userId");

-- CreateIndex
CREATE INDEX "musician_unavailabilities_startDate_endDate_idx" ON "musician_unavailabilities"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "musician_unavailabilities_dayOfWeek_idx" ON "musician_unavailabilities"("dayOfWeek");

-- AddForeignKey
ALTER TABLE "musician_unavailabilities" ADD CONSTRAINT "musician_unavailabilities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
