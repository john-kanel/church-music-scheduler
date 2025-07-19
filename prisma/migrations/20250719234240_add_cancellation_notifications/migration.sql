-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'MUSICIAN_CANCELLATION';

-- CreateTable
CREATE TABLE "cancellation_notifications" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "roleName" TEXT,
    "cancelledBy" TEXT NOT NULL,
    "batchKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cancellation_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cancellation_notifications_batchKey_sentAt_idx" ON "cancellation_notifications"("batchKey", "sentAt");

-- AddForeignKey
ALTER TABLE "cancellation_notifications" ADD CONSTRAINT "cancellation_notifications_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cancellation_notifications" ADD CONSTRAINT "cancellation_notifications_cancelledBy_fkey" FOREIGN KEY ("cancelledBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
