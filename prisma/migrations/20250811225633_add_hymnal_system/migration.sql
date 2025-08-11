-- CreateTable
CREATE TABLE "hymnals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "churchId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hymnals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hymnal_hymns" (
    "id" TEXT NOT NULL,
    "hymnalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "number" TEXT,
    "pageNumber" INTEGER,
    "composer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hymnal_hymns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hymnal_hymns_hymnalId_title_idx" ON "hymnal_hymns"("hymnalId", "title");

-- CreateIndex
CREATE INDEX "hymnal_hymns_hymnalId_number_idx" ON "hymnal_hymns"("hymnalId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "hymnal_hymns_hymnalId_number_key" ON "hymnal_hymns"("hymnalId", "number");

-- AddForeignKey
ALTER TABLE "hymnals" ADD CONSTRAINT "hymnals_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "parishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hymnals" ADD CONSTRAINT "hymnals_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hymnal_hymns" ADD CONSTRAINT "hymnal_hymns_hymnalId_fkey" FOREIGN KEY ("hymnalId") REFERENCES "hymnals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
