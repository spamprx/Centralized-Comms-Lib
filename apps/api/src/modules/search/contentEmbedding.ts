import type { PrismaClient } from "@prisma/client";
import {
  CONTENT_INDEX_NAME,
  getElasticsearchClient,
  TITLE_EMBEDDING_DIMS,
} from "@comms-lib/db-elasticsearch";
import { buildContentIndexDocument } from "./contentIndex.document";
import { embedText } from "../../intelligence/syncAi";

/**
 * Generate a vector embedding for the given text via the Intelligence Layer
 * (SRS §3.4.7 — Sync AI fast path).  Falls back to null when the embedding
 * service is not configured or returns an unexpected dimension.
 */
export async function embedTextForIndex(
  text: string,
): Promise<number[] | null> {
  const result = await embedText(text);
  if (!result || !result.ok) return null;
  if (result.embedding.length !== TITLE_EMBEDDING_DIMS) return null;
  return result.embedding;
}

export async function refreshTitleEmbeddingForContent(
  prisma: PrismaClient,
  contentId: string,
): Promise<boolean> {
  const client = getElasticsearchClient();
  if (!client) return false;

  const doc = await buildContentIndexDocument(prisma, contentId);
  if (!doc) return false;

  const text = [doc.title, doc.summary].filter(Boolean).join("\n").trim();
  if (!text) return false;

  const embedding = await embedTextForIndex(text);
  if (!embedding) return false;

  try {
    await client.update({
      index: CONTENT_INDEX_NAME,
      id: contentId,
      doc: {
        titleEmbedding: embedding,
        indexedAt: new Date().toISOString(),
      },
      refresh: false,
    });
    return true;
  } catch {
    return false;
  }
}
