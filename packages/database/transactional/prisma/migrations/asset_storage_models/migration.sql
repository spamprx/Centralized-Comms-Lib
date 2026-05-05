-- CreateEnum
CREATE TYPE "AssetPlacement" AS ENUM ('MY_ASSETS', 'LIBRARY');

CREATE TYPE "AssetStatus" AS ENUM ('PENDING_UPLOAD', 'READY', 'FAILED', 'DELETED');

CREATE TYPE "AssetUsageTargetType" AS ENUM ('CONTENT', 'TEMPLATE', 'OTHER');

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "placement" "AssetPlacement" NOT NULL DEFAULT 'MY_ASSETS',
    "category" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalFilename" TEXT,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT,
    "etag" TEXT,
    "sha256" TEXT,
    "status" "AssetStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assets_bucket_objectKey_key" ON "assets"("bucket", "objectKey");

CREATE INDEX "assets_ownerUserId_placement_createdAt_idx" ON "assets"("ownerUserId", "placement", "createdAt");

CREATE INDEX "assets_placement_createdAt_idx" ON "assets"("placement", "createdAt");

ALTER TABLE "assets" ADD CONSTRAINT "assets_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assets" ADD CONSTRAINT "assets_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "asset_usages" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "targetType" "AssetUsageTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "fieldPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_usages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "asset_usages_assetId_idx" ON "asset_usages"("assetId");

CREATE INDEX "asset_usages_targetType_targetId_idx" ON "asset_usages"("targetType", "targetId");

ALTER TABLE "asset_usages" ADD CONSTRAINT "asset_usages_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
