/**
 * S3-compatible object storage (MinIO / AWS S3) — env-driven configuration.
 * Presigned URLs must use an endpoint reachable from the browser (`MINIO_PUBLIC_ENDPOINT`).
 * Server-side verification uses `MINIO_ENDPOINT` (Docker service hostname inside the compose network).
 */

export type StorageBuckets = {
  images: string;
  documents: string;
  videos: string;
};

export type StorageEnv = {
  region: string;
  endpointInternal: string;
  endpointPublic: string;
  accessKeyId: string;
  secretAccessKey: string;
  buckets: StorageBuckets;
  presignPutExpiresSec: number;
  presignGetMaxExpiresSec: number;
  shareLinkDefaultExpiresSec: number;
  maxUploadBytes: Record<"image" | "video" | "document" | "audio" | "other", number>;
};

function parseBytes(mb: string | undefined, fallbackMb: number): number {
  const n = Number(mb);
  const mbVal = Number.isFinite(n) && n > 0 ? n : fallbackMb;
  return Math.floor(mbVal * 1024 * 1024);
}

export function getStorageEnv(): StorageEnv | null {
  const accessKeyId =
    process.env.MINIO_ACCESS_KEY?.trim() ||
    process.env.MINIO_ROOT_USER?.trim() ||
    "";
  const secretAccessKey =
    process.env.MINIO_SECRET_KEY?.trim() ||
    process.env.MINIO_ROOT_PASSWORD?.trim() ||
    "";

  if (!accessKeyId || !secretAccessKey) {
    return null;
  }

  const endpointInternal =
    process.env.MINIO_ENDPOINT?.trim() || "http://127.0.0.1:9000";
  const endpointPublic =
    process.env.MINIO_PUBLIC_ENDPOINT?.trim() || endpointInternal;

  return {
    region: process.env.MINIO_REGION?.trim() || "us-east-1",
    endpointInternal,
    endpointPublic,
    accessKeyId,
    secretAccessKey,
    buckets: {
      images: process.env.MINIO_BUCKET_IMAGES?.trim() || "images",
      documents: process.env.MINIO_BUCKET_DOCUMENTS?.trim() || "documents",
      videos: process.env.MINIO_BUCKET_VIDEOS?.trim() || "videos",
    },
    presignPutExpiresSec: Math.min(
      Number(process.env.MINIO_PRESIGN_PUT_EXPIRES_SEC ?? 900) || 900,
      3600 * 24,
    ),
    presignGetMaxExpiresSec: Math.min(
      Number(process.env.MINIO_PRESIGN_GET_MAX_EXPIRES_SEC ?? 604800) || 604800,
      3600 * 24 * 7,
    ),
    shareLinkDefaultExpiresSec: Math.min(
      Number(process.env.MINIO_SHARE_LINK_EXPIRES_SEC ?? 86400) || 86400,
      3600 * 24 * 7,
    ),
    maxUploadBytes: {
      image: parseBytes(process.env.ASSET_MAX_IMAGE_MB, 25),
      video: parseBytes(process.env.ASSET_MAX_VIDEO_MB, 500),
      document: parseBytes(process.env.ASSET_MAX_DOCUMENT_MB, 100),
      audio: parseBytes(process.env.ASSET_MAX_AUDIO_MB, 50),
      other: parseBytes(process.env.ASSET_MAX_OTHER_MB, 50),
    },
  };
}
