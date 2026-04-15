import type { PrismaClient } from "@prisma/client";
import {
  CONTENT_INDEX_NAME,
  getElasticsearchClient,
  TITLE_EMBEDDING_DIMS,
} from "@comms-lib/db-elasticsearch";
import { buildContentIndexDocument } from "./contentIndex.document";

/**
 * Optional HTTP embedding service: `EMBEDDING_SERVICE_URL` base URL, POST JSON `{ "text": "..." }`
 * returning `{ "embedding": number[] }` with length `TITLE_EMBEDDING_DIMS` (384).
 */
export async function embedTextForIndex(
  text: string,
): Promise<number[] | null> {
  const base = process.env.EMBEDDING_SERVICE_URL?.trim();
  if (!base) return null;
  const path = process.env.EMBEDDING_SERVICE_PATH?.trim() || "/embed";
  const url = `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 8000) }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { embedding?: number[] };
    const emb = data.embedding;
    if (!Array.isArray(emb) || emb.length !== TITLE_EMBEDDING_DIMS) return null;
    return emb;
  } catch {
    return null;
  }
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
