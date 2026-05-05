-- Add component category taxonomy for library filtering (F-TMP-008)
CREATE TYPE "ComponentCategory" AS ENUM ('CONTENT', 'MEDIA', 'CTA', 'LEGAL', 'OTHER');

ALTER TABLE "components"
ADD COLUMN "category" "ComponentCategory" NOT NULL DEFAULT 'OTHER';

-- Persist hyperlink integrity checks for assets (F-TMP-009)
CREATE TYPE "AssetLinkStatus" AS ENUM ('PENDING', 'VALID', 'BROKEN');

CREATE TABLE "asset_link_checks" (
  "id" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "status" "AssetLinkStatus" NOT NULL DEFAULT 'PENDING',
  "httpStatusCode" INTEGER,
  "errorMessage" TEXT,
  "checkedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "asset_link_checks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "asset_link_checks_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "asset_link_checks_assetId_url_key" ON "asset_link_checks"("assetId", "url");
CREATE INDEX "asset_link_checks_assetId_updatedAt_idx" ON "asset_link_checks"("assetId", "updatedAt");
CREATE INDEX "asset_link_checks_status_updatedAt_idx" ON "asset_link_checks"("status", "updatedAt");
