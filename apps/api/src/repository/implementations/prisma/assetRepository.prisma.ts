/**
 * Repository Layer — Prisma implementation of AssetRepository (SRS §3.4.8)
 *
 * Encapsulates all Prisma calls for the Asset aggregate so assets.service.ts
 * no longer calls `getPrismaClient()` directly, matching the pattern of every
 * other repository in this codebase.
 */

import { AssetPlacement, AssetStatus, AssetUsageTargetType, Prisma } from "@prisma/client";
import type { AssetRepository, AssetRow, AssetUsageRow, CreateAssetInput, ListAssetsFilter } from "../../interfaces/assetRepository";
import type { PrismaDb } from "./prismaTypes";

function toAssetRow(row: {
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
}): AssetRow {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    workspaceId: row.workspaceId,
    placement: row.placement,
    category: row.category,
    bucket: row.bucket,
    objectKey: row.objectKey,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    etag: row.etag,
    sha256: row.sha256,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

function toUsageRow(row: {
  id: string;
  assetId: string;
  targetType: AssetUsageTargetType;
  targetId: string;
  fieldPath: string | null;
  createdAt: Date;
}): AssetUsageRow {
  return {
    id: row.id,
    assetId: row.assetId,
    targetType: row.targetType,
    targetId: row.targetId,
    fieldPath: row.fieldPath,
    createdAt: row.createdAt,
  };
}

export class PrismaAssetRepository implements AssetRepository {
  public constructor(private readonly db: PrismaDb) {}

  async create(input: CreateAssetInput): Promise<AssetRow> {
    const row = await this.db.asset.create({
      data: {
        ownerUserId: input.ownerUserId,
        workspaceId: input.workspaceId,
        placement: input.placement,
        category: input.category,
        bucket: input.bucket,
        objectKey: input.objectKey,
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
        status: input.status,
      },
    });
    return toAssetRow(row);
  }

  async findById(id: string): Promise<AssetRow | null> {
    const row = await this.db.asset.findFirst({
      where: { id, deletedAt: null },
    });
    return row ? toAssetRow(row) : null;
  }

  async findByIdForOwner(userId: string, id: string): Promise<AssetRow | null> {
    const row = await this.db.asset.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) return null;
    if (row.ownerUserId !== userId && row.placement !== AssetPlacement.LIBRARY) {
      return null;
    }
    return toAssetRow(row);
  }

  async list(
    filter: ListAssetsFilter,
  ): Promise<{ items: AssetRow[]; total: number }> {
    const where: Prisma.AssetWhereInput = {
      deletedAt: null,
      status: filter.status ?? AssetStatus.READY,
      ...(filter.category ? { category: filter.category } : {}),
      ...(filter.placement
        ? { placement: filter.placement }
        : filter.ownerUserId
          ? {
              OR: [
                {
                  placement: AssetPlacement.MY_ASSETS,
                  ownerUserId: filter.ownerUserId,
                },
                { placement: AssetPlacement.LIBRARY },
              ],
            }
          : {}),
    };

    if (
      filter.placement === AssetPlacement.MY_ASSETS &&
      filter.ownerUserId
    ) {
      where.ownerUserId = filter.ownerUserId;
    }

    const [rows, total] = await Promise.all([
      this.db.asset.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: filter.limit,
        skip: filter.offset,
      }),
      this.db.asset.count({ where }),
    ]);

    return { items: rows.map(toAssetRow), total };
  }

  async update(
    id: string,
    data: {
      status?: AssetStatus;
      sizeBytes?: bigint | null;
      etag?: string | null;
      deletedAt?: Date | null;
    },
  ): Promise<AssetRow> {
    const row = await this.db.asset.update({
      where: { id },
      data,
    });
    return toAssetRow(row);
  }

  async softDelete(id: string): Promise<void> {
    await this.db.asset.update({
      where: { id },
      data: {
        status: AssetStatus.DELETED,
        deletedAt: new Date(),
      },
    });
  }

  async registerUsage(data: {
    assetId: string;
    targetType: AssetUsageTargetType;
    targetId: string;
    fieldPath?: string | null;
  }): Promise<AssetUsageRow> {
    const row = await this.db.assetUsage.create({
      data: {
        assetId: data.assetId,
        targetType: data.targetType,
        targetId: data.targetId,
        fieldPath: data.fieldPath ?? null,
      },
    });
    return toUsageRow(row);
  }

  async listUsageByAsset(assetId: string): Promise<AssetUsageRow[]> {
    const rows = await this.db.assetUsage.findMany({
      where: { assetId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toUsageRow);
  }
}
