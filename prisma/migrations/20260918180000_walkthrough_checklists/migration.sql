-- AlterTable
ALTER TABLE "Checklist" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "Checklist" ADD COLUMN "summary" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Checklist" ADD COLUMN "sourceMediaId" TEXT;

-- AlterTable
ALTER TABLE "ChecklistItem" ADD COLUMN "trade" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ChecklistItem" ADD COLUMN "notes" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ChecklistItem" ADD COLUMN "timestampMs" INTEGER;
ALTER TABLE "ChecklistItem" ADD COLUMN "screenshotMediaId" TEXT;

CREATE INDEX "Checklist_sourceMediaId_idx" ON "Checklist"("sourceMediaId");
CREATE INDEX "ChecklistItem_screenshotMediaId_idx" ON "ChecklistItem"("screenshotMediaId");
