-- CreateEnum
CREATE TYPE "OwnershipTransferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED', 'COMPLETED');

-- CreateTable
CREATE TABLE "ownership_transfers" (
    "id" TEXT NOT NULL,
    "inviteeEmail" TEXT NOT NULL,
    "inviteeFirstName" TEXT,
    "inviteeLastName" TEXT,
    "inviteeRole" "UserRole" NOT NULL,
    "status" "OwnershipTransferStatus" NOT NULL DEFAULT 'PENDING',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "retireCurrentOwner" BOOLEAN NOT NULL DEFAULT false,
    "currentOwnerRetireAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "churchId" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "reminderSentAt" TIMESTAMP(3),

    CONSTRAINT "ownership_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ownership_transfers_token_key" ON "ownership_transfers"("token");

-- CreateIndex
CREATE UNIQUE INDEX "ownership_transfers_inviteeEmail_churchId_key" ON "ownership_transfers"("inviteeEmail", "churchId");

-- AddForeignKey
ALTER TABLE "ownership_transfers" ADD CONSTRAINT "ownership_transfers_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "parishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
