-- AlterTable: add naming and filters to public schedule links
ALTER TABLE "public_schedule_links"
ADD COLUMN IF NOT EXISTS "name" TEXT,
ADD COLUMN IF NOT EXISTS "filterType" "CalendarFilterType" NOT NULL DEFAULT 'ALL',
ADD COLUMN IF NOT EXISTS "groupIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "eventTypeIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Indexes are optional; existing token and churchId indexes remain

