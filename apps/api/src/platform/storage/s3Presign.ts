import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { StorageEnv } from "../../config/storageEnv";

export function createS3ClientForEndpoint(
  cfg: Pick<
    StorageEnv,
    "region" | "accessKeyId" | "secretAccessKey"
  > & { endpoint: string },
): S3Client {
  return new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    forcePathStyle: true,
  });
}

export async function presignPut(
  client: S3Client,
  bucket: string,
  key: string,
  contentType: string,
  expiresIn: number,
): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, cmd, { expiresIn });
}

export async function presignGet(
  client: S3Client,
  bucket: string,
  key: string,
  expiresIn: number,
): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  return getSignedUrl(client, cmd, { expiresIn });
}

export async function headObject(
  client: S3Client,
  bucket: string,
  key: string,
): Promise<{ contentLength?: number; etag?: string }> {
  const out = await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: key }),
  );
  return {
    contentLength:
      typeof out.ContentLength === "number" ? out.ContentLength : undefined,
    etag: out.ETag?.replace(/"/g, ""),
  };
}

export async function deleteObject(
  client: S3Client,
  bucket: string,
  key: string,
): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
