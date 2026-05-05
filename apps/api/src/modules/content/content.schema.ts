/**
 * Zod schemas for content API payloads (S1 — validation at the edge).
 */
import { z } from "zod";

const tiptapDocumentSchema: z.ZodType<Record<string, unknown>> = z
  .object({
    type: z.literal("doc"),
    content: z.array(z.unknown()),
  })
  .passthrough();

export const createContentDraftBodySchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "title is required")
    .max(500, "title is too long"),
  body: tiptapDocumentSchema.optional().nullable(),
  aiGenerated: z.boolean().optional(),
  templateId: z.string().uuid().optional().nullable(),
  channelId: z.string().uuid().optional().nullable(),
  contentType: z
    .enum(["ARTICLE", "VIDEO", "PODCAST", "DOCUMENT"])
    .optional(),
});

export type CreateContentDraftBody = z.infer<typeof createContentDraftBodySchema>;
