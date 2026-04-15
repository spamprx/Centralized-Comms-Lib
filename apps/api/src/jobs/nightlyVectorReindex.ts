import "dotenv/config";
import {
  getElasticsearchClient,
  CONTENT_INDEX_NAME,
} from "@comms-lib/db-elasticsearch";
import { getPrismaClient } from "../repository";
import {
  ensureContentSearchIndex,
  syncContentIndexFromDb,
} from "../modules/search/contentSearch.service";
import { bumpSearchCacheEpoch } from "../shared/cache/redisClient";
import { refreshTitleEmbeddingForContent } from "../modules/search/contentEmbedding";

/**
 * Rebuilds Elasticsearch documents from Postgres, refreshes embeddings when
 * `EMBEDDING_SERVICE_URL` is set, and removes index rows with no backing content.
 *
 * Run on a schedule (cron / k8s CronJob):
 *   npm run job:vector-reindex --workspace=swe-backend
 */
export async function runNightlyVectorReindex(): Promise<{
  indexed: number;
  embeddings: number;
  pruned: number;
}> {
  const prisma = getPrismaClient();
  const es = getElasticsearchClient();

  const rows = await prisma.content.findMany({ select: { id: true } });
  const validIds = new Set(rows.map((r: { id: string }) => r.id));

  let indexed = 0;
  let embeddings = 0;

  if (es) {
    await ensureContentSearchIndex(es);
  }

  for (const row of rows) {
    await syncContentIndexFromDb(prisma, row.id);
    indexed += 1;
    if (process.env.EMBEDDING_SERVICE_URL?.trim()) {
      const ok = await refreshTitleEmbeddingForContent(prisma, row.id);
      if (ok) embeddings += 1;
    }
  }

  let pruned = 0;
  if (es) {
    await ensureContentSearchIndex(es);
    const scrollMs = "2m";
    const batch = 500;
    let res = await es.search({
      index: CONTENT_INDEX_NAME,
      scroll: scrollMs,
      size: batch,
      _source: false,
      query: { match_all: {} },
    });

    let scrollId = res._scroll_id;
    let hits = res.hits.hits;

    try {
      while (hits.length > 0) {
        for (const h of hits) {
          const id = String(h._id ?? "");
          if (id && !validIds.has(id)) {
            try {
              await es.delete({
                index: CONTENT_INDEX_NAME,
                id,
                refresh: false,
              });
              pruned += 1;
            } catch {
              /* ignore */
            }
          }
        }
        if (!scrollId) break;
        const next = await es.scroll({ scroll_id: scrollId, scroll: scrollMs });
        scrollId = next._scroll_id;
        hits = next.hits.hits;
      }
    } finally {
      if (scrollId) {
        await es.clearScroll({ scroll_id: [scrollId] }).catch(() => undefined);
      }
    }
  }

  await bumpSearchCacheEpoch();

  return { indexed, embeddings, pruned };
}

async function main(): Promise<void> {
  const out = await runNightlyVectorReindex();
  console.log(
    JSON.stringify({
      ok: true,
      ...out,
      at: new Date().toISOString(),
    }),
  );
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
