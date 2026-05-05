/**
 * Repository Layer — Asset Repository interface (SRS §3.4.8)
 *
 * All reads and writes for the Asset aggregate go through this interface.
 * Implementations hide the persistence technology (Prisma/PostgreSQL) and
 * expose only the domain-relevant operations used by assets.service.ts and
 * linkIntegrity.service.ts.
 */

import type {
  AssetPlacement,
  AssetStatus,
  AssetUsageTargetType,
} from "@prisma/client";

export interface AssetRow {
  id: string;
  ownerUserId: string;
  workspaceId: string | null;
  placement: AssetPlacement;
  category: string;
  bucket: string;
  objectKey: string;
  originalFilename: string | null;
  mimeType: string;
  sizeBytes: bigint | null;
  etag: string | null;
  sha256: string | null;
  status: AssetStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface AssetUsageRow {
  id: string;
  assetId: string;
  targetType: AssetUsageTargetType;
  targetId: string;
  fieldPath: string | null;
  createdAt: Date;
}

export interface CreateAssetInput {
  ownerUserId: string;
  workspaceId: string | null;
  placement: AssetPlacement;
  category: string;
  bucket: string;
  objectKey: string;
  originalFilename: string;
  mimeType: string;
  status: AssetStatus;
}

export interface ListAssetsFilter {
  placement?: AssetPlacement;
  category?: string;
  ownerUserId?: string;
  status?: AssetStatus;
  limit: number;
  offset: number;
}

export interface AssetRepository {
  create(input: CreateAssetInput): Promise<AssetRow>;
  findById(id: string): Promise<AssetRow | null>;
  findByIdForOwner(userId: string, id: string): Promise<AssetRow | null>;
  list(filter: ListAssetsFilter): Promise<{ items: AssetRow[]; total: number }>;
  update(
    id: string,
    data: {
      status?: AssetStatus;
      sizeBytes?: bigint | null;
      etag?: string | null;
      deletedAt?: Date | null;
    },
  ): Promise<AssetRow>;
  softDelete(id: string): Promise<void>;

  registerUsage(data: {
    assetId: string;
    targetType: AssetUsageTargetType;
    targetId: string;
    fieldPath?: string | null;
  }): Promise<AssetUsageRow>;

  listUsageByAsset(assetId: string): Promise<AssetUsageRow[]>;
}
