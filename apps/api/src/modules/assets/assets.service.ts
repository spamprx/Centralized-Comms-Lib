import { randomUUID } from "node:crypto";

import {
  AssetPlacement,
  AssetStatus,
  AssetUsageTargetType,
  Prisma,
} from "@prisma/client";

import { getStorageEnv } from "../../config/storageEnv";
import { getPrismaClient } from "../../repository";
import {
  createS3ClientForEndpoint,
  deleteObject,
  headObject,
  presignGet,
  presignPut,
} from "../../platform/storage/s3Presign";

import type { AssetCategory, AssetPlacementDto } from "./assets.types";
import { checkResourceAccess } from "../../shared/authorization";

const MIME_BY_CATEGORY: Record<AssetCategory, RegExp[]> = {
  image: [/^image\/(jpeg|png|webp|gif)$/i],
  video: [/^video\/(mp4|quicktime|webm)$/i],
  document: [
    /^application\/pdf$/i,
    /^application\/vnd\.openxmlformats-officedocument\./i,
    /^application\/msword$/i,
    /^text\/plain$/i,
  ],
  audio: [/^audio\/(mpeg|wav|ogg|webm)$/i],
  other: [/.+/],
};

function categoryFromMime(mime: string): AssetCategory | null {
  const m = mime.trim().toLowerCase();
  if (MIME_BY_CATEGORY.image.some((r) => r.test(m))) return "image";
  if (MIME_BY_CATEGORY.video.some((r) => r.test(m))) return "video";
  if (MIME_BY_CATEGORY.audio.some((r) => r.test(m))) return "audio";
  if (MIME_BY_CATEGORY.document.some((r) => r.test(m))) return "document";
  return null;
}

function bucketForCategory(
  cfg: NonNullable<ReturnType<typeof getStorageEnv>>,
  category: AssetCategory,
): string {
  if (category === "image") return cfg.buckets.images;
  if (category === "video") return cfg.buckets.videos;
  return cfg.buckets.documents;
}

function safeFilename(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160);
  return base.length > 0 ? base : "file";
}

function placementEnum(p: AssetPlacementDto): AssetPlacement {
  return p === "LIBRARY" ? AssetPlacement.LIBRARY : AssetPlacement.MY_ASSETS;
}

export type UploadIntentInput = {
  filename: string;
  mimeType: string;
  category: AssetCategory;
  placement: AssetPlacementDto;
  sizeBytes?: number;
};

export type SerializedAsset = Record<string, unknown>;

function serializeAsset(row: {
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
}): SerializedAsset {
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
    sizeBytes:
      row.sizeBytes !== null && row.sizeBytes !== undefined
        ? row.sizeBytes.toString()
        : null,
    etag: row.etag,
    sha256: row.sha256,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

async function resolveDefaultWorkspaceId(): Promise<string | null> {
  const slug = process.env.DEFAULT_WORKSPACE_SLUG?.trim();
  if (!slug) return null;
  const ws = await getPrismaClient().workspace.findUnique({
    where: { slug },
    select: { id: true },
  });
  return ws?.id ?? null;
}

export const assetsService = {
  /**
   * Object-level asset access (S2): MY_ASSETS = owner/admin; LIBRARY = any authenticated user may read.
   */
  async getAssetIfAllowed(
    userId: string,
    isAdmin: boolean,
    assetId: string,
    action: "read" | "write" | "delete",
  ) {
    const gate = await checkResourceAccess(userId, "asset", assetId, action, {
      isAdmin,
    });
    if (!gate.allowed) return null;
    const row = await getPrismaClient().asset.findFirst({
      where: { id: assetId, deletedAt: null },
    });
    return row ?? null;
  },

  async createUploadIntent(
    ownerUserId: string,
    input: UploadIntentInput,
  ): Promise<{
    asset: SerializedAsset;
    uploadUrl: string;
    expiresIn: number;
    headers: { "Content-Type": string };
  }> {
    const cfg = getStorageEnv();
    if (!cfg) {
      throw Object.assign(new Error("Object storage is not configured"), {
        status: 503,
      });
    }

    if (input.category !== "other") {
      const inferred = categoryFromMime(input.mimeType);
      if (!inferred || inferred !== input.category) {
        throw Object.assign(
          new Error(
            "MIME type does not match category or is not allowed for uploads",
          ),
          { status: 400 },
        );
      }
    }

    if (!MIME_BY_CATEGORY[input.category].some((r) => r.test(input.mimeType))) {
      throw Object.assign(new Error("MIME type not allowed for this category"), {
        status: 400,
      });
    }

    const maxBytes = cfg.maxUploadBytes[input.category];
    if (input.sizeBytes !== undefined && input.sizeBytes > maxBytes) {
      throw Object.assign(new Error("File exceeds maximum size for category"), {
        status: 400,
      });
    }

    const bucket = bucketForCategory(cfg, input.category);
    const placement = placementEnum(input.placement);
    const prefix =
      placement === AssetPlacement.LIBRARY ? "library" : `my-assets/${ownerUserId}`;
    const objectKey = `${prefix}/${randomUUID()}-${safeFilename(input.filename)}`;

    const workspaceId = await resolveDefaultWorkspaceId();

    const publicClient = createS3ClientForEndpoint({
      region: cfg.region,
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
      endpoint: cfg.endpointPublic,
    });

    const row = await getPrismaClient().asset.create({
      data: {
        ownerUserId,
        workspaceId,
        placement,
        category: input.category,
        bucket,
        objectKey,
        originalFilename: input.filename,
        mimeType: input.mimeType,
        status: AssetStatus.PENDING_UPLOAD,
      },
    });

    const uploadUrl = await presignPut(
      publicClient,
      bucket,
      objectKey,
      input.mimeType,
      cfg.presignPutExpiresSec,
    );

    return {
      asset: serializeAsset(row),
      uploadUrl,
      expiresIn: cfg.presignPutExpiresSec,
      headers: { "Content-Type": input.mimeType },
    };
  },

  async finalizeUpload(
    ownerUserId: string,
    assetId: string,
    opts?: { isAdmin?: boolean },
  ): Promise<{ asset: SerializedAsset }> {
    const cfg = getStorageEnv();
    if (!cfg) {
      throw Object.assign(new Error("Object storage is not configured"), {
        status: 503,
      });
    }

    const row = await this.getAssetIfAllowed(
      ownerUserId,
      opts?.isAdmin ?? false,
      assetId,
      "write",
    );
    if (!row) {
      throw Object.assign(new Error("Asset not found"), { status: 404 });
    }
    if (row.status !== AssetStatus.PENDING_UPLOAD) {
      throw Object.assign(new Error("Asset is not pending upload"), {
        status: 409,
      });
    }

    const internal = createS3ClientForEndpoint({
      region: cfg.region,
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
      endpoint: cfg.endpointInternal,
    });

    let meta: { contentLength?: number; etag?: string };
    try {
      meta = await headObject(internal, row.bucket, row.objectKey);
    } catch {
      throw Object.assign(new Error("Object not found in storage"), {
        status: 400,
      });
    }

    const updated = await getPrismaClient().asset.update({
      where: { id: row.id },
      data: {
        status: AssetStatus.READY,
        sizeBytes:
          meta.contentLength !== undefined
            ? BigInt(meta.contentLength)
            : null,
        etag: meta.etag ?? null,
      },
    });

    return { asset: serializeAsset(updated) };
  },

  async listAssets(
    userId: string,
    query: {
      placement?: AssetPlacementDto;
      category?: AssetCategory;
      limit: number;
      offset: number;
    },
  ): Promise<{ items: SerializedAsset[]; total: number }> {
    const placementFilter =
      query.placement === "LIBRARY"
        ? AssetPlacement.LIBRARY
        : query.placement === "MY_ASSETS"
          ? AssetPlacement.MY_ASSETS
          : undefined;

    const where: Prisma.AssetWhereInput = {
      deletedAt: null,
      status: AssetStatus.READY,
      ...(query.category ? { category: query.category } : {}),
      ...(placementFilter
        ? { placement: placementFilter }
        : {
            OR: [
              { placement: AssetPlacement.MY_ASSETS, ownerUserId: userId },
              { placement: AssetPlacement.LIBRARY },
            ],
          }),
    };

    if (placementFilter === AssetPlacement.MY_ASSETS) {
      where.ownerUserId = userId;
    }

    const prisma = getPrismaClient();
    const [rows, total] = await prisma.$transaction([
      prisma.asset.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: query.limit,
        skip: query.offset,
      }),
      prisma.asset.count({ where }),
    ]);

    return {
      items: rows.map(serializeAsset),
      total,
    };
  },

  async getViewLink(
    userId: string,
    assetId: string,
    expiresInSeconds?: number,
    opts?: { isAdmin?: boolean },
  ): Promise<{ url: string; expiresIn: number; expiresAt: string }> {
    const cfg = getStorageEnv();
    if (!cfg) {
      throw Object.assign(new Error("Object storage is not configured"), {
        status: 503,
      });
    }

    const row = await this.getAssetIfAllowed(
      userId,
      opts?.isAdmin ?? false,
      assetId,
      "read",
    );
    if (!row) {
      throw Object.assign(new Error("Asset not found"), { status: 404 });
    }
    if (row.status !== AssetStatus.READY) {
      throw Object.assign(new Error("Asset is not ready"), { status: 409 });
    }

    const ttl = Math.min(
      expiresInSeconds ?? 3600,
      cfg.presignGetMaxExpiresSec,
    );
    const publicClient = createS3ClientForEndpoint({
      region: cfg.region,
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
      endpoint: cfg.endpointPublic,
    });

    const url = await presignGet(publicClient, row.bucket, row.objectKey, ttl);
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    return { url, expiresIn: ttl, expiresAt };
  },

  async shareLibraryLink(
    _userId: string,
    assetId: string,
    expiresInSeconds?: number,
  ): Promise<{ url: string; expiresIn: number; expiresAt: string }> {
    const cfg = getStorageEnv();
    if (!cfg) {
      throw Object.assign(new Error("Object storage is not configured"), {
        status: 503,
      });
    }

    const row = await getPrismaClient().asset.findFirst({
      where: { id: assetId, deletedAt: null },
    });
    if (!row) {
      throw Object.assign(new Error("Asset not found"), { status: 404 });
    }
    if (row.placement !== AssetPlacement.LIBRARY) {
      throw Object.assign(
        new Error("Share links are only available for library assets"),
        { status: 400 },
      );
    }
    if (row.status !== AssetStatus.READY) {
      throw Object.assign(new Error("Asset is not ready"), { status: 409 });
    }

    const ttl = Math.min(
      expiresInSeconds ?? cfg.shareLinkDefaultExpiresSec,
      cfg.presignGetMaxExpiresSec,
    );
    const publicClient = createS3ClientForEndpoint({
      region: cfg.region,
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
      endpoint: cfg.endpointPublic,
    });

    const url = await presignGet(publicClient, row.bucket, row.objectKey, ttl);
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    return { url, expiresIn: ttl, expiresAt };
  },

  async deleteAsset(
    ownerUserId: string,
    assetId: string,
    opts?: { isAdmin?: boolean },
  ): Promise<void> {
    const cfg = getStorageEnv();
    const row = await this.getAssetIfAllowed(
      ownerUserId,
      opts?.isAdmin ?? false,
      assetId,
      "delete",
    );
    if (!row) {
      throw Object.assign(new Error("Asset not found"), { status: 404 });
    }

    if (cfg) {
      const internal = createS3ClientForEndpoint({
        region: cfg.region,
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
        endpoint: cfg.endpointInternal,
      });
      try {
        await deleteObject(internal, row.bucket, row.objectKey);
      } catch {
        /* ignore missing object */
      }
    }

    await getPrismaClient().asset.update({
      where: { id: assetId },
      data: {
        status: AssetStatus.DELETED,
        deletedAt: new Date(),
      },
    });
  },

  async registerUsage(
    actorUserId: string,
    assetId: string,
    body: {
      targetType: AssetUsageTargetType;
      targetId: string;
      fieldPath?: string | null;
    },
    opts?: { isAdmin?: boolean },
  ): Promise<{ id: string }> {
    const row = await this.getAssetIfAllowed(
      actorUserId,
      opts?.isAdmin ?? false,
      assetId,
      "read",
    );
    if (!row) {
      throw Object.assign(new Error("Asset not found"), { status: 404 });
    }
    if (row.status !== AssetStatus.READY) {
      throw Object.assign(new Error("Asset is not ready"), { status: 409 });
    }

    const usage = await getPrismaClient().assetUsage.create({
      data: {
        assetId,
        targetType: body.targetType,
        targetId: body.targetId,
        fieldPath: body.fieldPath ?? null,
      },
    });
    return { id: usage.id };
  },
};
