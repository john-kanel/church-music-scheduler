-- CreateIndex
CREATE INDEX "communications_isScheduled_sentAt_scheduledFor_idx" ON "communications"("isScheduled", "sentAt", "scheduledFor");

-- CreateIndex
CREATE INDEX "communications_churchId_idx" ON "communications"("churchId");

-- CreateIndex
CREATE INDEX "communications_eventId_idx" ON "communications"("eventId");

-- CreateIndex
CREATE INDEX "email_schedules_sentAt_scheduledFor_attempts_idx" ON "email_schedules"("sentAt", "scheduledFor", "attempts");

-- CreateIndex
CREATE INDEX "email_schedules_churchId_idx" ON "email_schedules"("churchId");

-- CreateIndex
CREATE INDEX "email_schedules_scheduledFor_idx" ON "email_schedules"("scheduledFor");
