/*
  Warnings:

  - A unique constraint covering the columns `[eventId,userId]` on the table `event_assignments` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "event_assignments_userId_idx" ON "event_assignments"("userId");

-- CreateIndex
CREATE INDEX "event_assignments_status_idx" ON "event_assignments"("status");

-- CreateIndex
CREATE INDEX "event_assignments_userId_status_idx" ON "event_assignments"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "event_assignments_eventId_userId_key" ON "event_assignments"("eventId", "userId");

-- CreateIndex
CREATE INDEX "events_churchId_idx" ON "events"("churchId");

-- CreateIndex
CREATE INDEX "events_startTime_idx" ON "events"("startTime");

-- CreateIndex
CREATE INDEX "events_churchId_startTime_idx" ON "events"("churchId", "startTime");

-- CreateIndex
CREATE INDEX "invitations_churchId_idx" ON "invitations"("churchId");

-- CreateIndex
CREATE INDEX "invitations_status_idx" ON "invitations"("status");

-- CreateIndex
CREATE INDEX "invitations_churchId_status_idx" ON "invitations"("churchId", "status");

-- CreateIndex
CREATE INDEX "invitations_email_idx" ON "invitations"("email");

-- CreateIndex
CREATE INDEX "users_churchId_idx" ON "users"("churchId");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");
