import { z } from "zod";

export const uploadIntentBodySchema = z.object({
  filename: z.string().trim().min(1).max(500),
  mimeType: z.string().trim().min(1).max(200),
  category: z.enum(["image", "video", "document", "audio", "other"]),
  placement: z.enum(["MY_ASSETS", "LIBRARY"]).optional(),
  sizeBytes: z.number().int().positive().optional(),
});

export const shareLinkBodySchema = z
  .object({
    expiresInSeconds: z.number().int().positive().optional(),
    ttl: z.number().int().positive().optional(),
  })
  .strict();
