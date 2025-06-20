/*
  Parish to Church rename migration - Safe data-preserving version
  This migration renames parishId columns to churchId without losing data
*/

-- Step 1: Rename columns to preserve data
ALTER TABLE "users" RENAME COLUMN "parishId" TO "churchId";
ALTER TABLE "custom_roles" RENAME COLUMN "parishId" TO "churchId";
ALTER TABLE "event_types" RENAME COLUMN "parishId" TO "churchId";
ALTER TABLE "events" RENAME COLUMN "parishId" TO "churchId";
ALTER TABLE "groups" RENAME COLUMN "parishId" TO "churchId";
ALTER TABLE "invitations" RENAME COLUMN "parishId" TO "churchId";
ALTER TABLE "communications" RENAME COLUMN "parishId" TO "churchId";
ALTER TABLE "communication_templates" RENAME COLUMN "parishId" TO "churchId";
ALTER TABLE "referrals" RENAME COLUMN "referringParishId" TO "referringChurchId";
ALTER TABLE "activities" RENAME COLUMN "parishId" TO "churchId";

-- Step 2: Drop old constraints
ALTER TABLE "users" DROP CONSTRAINT "users_parishId_fkey";
ALTER TABLE "custom_roles" DROP CONSTRAINT "custom_roles_parishId_fkey";
ALTER TABLE "event_types" DROP CONSTRAINT "event_types_parishId_fkey";
ALTER TABLE "events" DROP CONSTRAINT "events_parishId_fkey";
ALTER TABLE "groups" DROP CONSTRAINT "groups_parishId_fkey";
ALTER TABLE "invitations" DROP CONSTRAINT "invitations_parishId_fkey";
ALTER TABLE "communications" DROP CONSTRAINT "communications_parishId_fkey";
ALTER TABLE "referrals" DROP CONSTRAINT "referrals_referringParishId_fkey";
ALTER TABLE "activities" DROP CONSTRAINT "activities_parishId_fkey";

-- Step 3: Drop old unique indexes
DROP INDEX IF EXISTS "custom_roles_name_parishId_key";
DROP INDEX IF EXISTS "event_types_name_parishId_key";
DROP INDEX IF EXISTS "groups_name_parishId_key";
DROP INDEX IF EXISTS "invitations_email_parishId_key";

-- Step 4: Create new unique indexes
CREATE UNIQUE INDEX "custom_roles_name_churchId_key" ON "custom_roles"("name", "churchId");
CREATE UNIQUE INDEX "event_types_name_churchId_key" ON "event_types"("name", "churchId");
CREATE UNIQUE INDEX "groups_name_churchId_key" ON "groups"("name", "churchId");
CREATE UNIQUE INDEX "invitations_email_churchId_key" ON "invitations"("email", "churchId");

-- Step 5: Add new foreign key constraints
ALTER TABLE "users" ADD CONSTRAINT "users_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "parishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "custom_roles" ADD CONSTRAINT "custom_roles_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "parishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_types" ADD CONSTRAINT "event_types_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "parishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "parishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "groups" ADD CONSTRAINT "groups_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "parishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "parishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "communications" ADD CONSTRAINT "communications_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "parishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referringChurchId_fkey" FOREIGN KEY ("referringChurchId") REFERENCES "parishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activities" ADD CONSTRAINT "activities_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "parishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
