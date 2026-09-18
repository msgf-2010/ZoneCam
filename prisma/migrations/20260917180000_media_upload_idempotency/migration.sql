-- CreateTable
-- Phase 3: idempotent client uploads and upload status (files remain in object storage).

ALTER TABLE "Media" ADD COLUMN "clientUploadId" TEXT;
ALTER TABLE "Media" ADD COLUMN "uploadStatus" TEXT NOT NULL DEFAULT 'stored';
ALTER TABLE "Media" ADD COLUMN "deviceInfo" TEXT;

CREATE UNIQUE INDEX "Media_companyId_clientUploadId_key" ON "Media"("companyId", "clientUploadId");
