import type { Client } from "@elastic/elasticsearch";
import { estypes } from "@elastic/elasticsearch";
import type { PrismaClient } from "@prisma/client";
import {
  CONTENT_INDEX_NAME,
  buildContentFacetAggregations,
  getElasticsearchClient,
} from "@comms-lib/db-elasticsearch";
import { buildContentIndexDocument, type ContentIndexDocument } from "./contentIndex.document";
import {
  assertValidQueryVector,
  engagementNorm,
  normalizeRankBlendWeights,
  type RankBlendWeights,
  recencyScore,
  rrfScore,
} from "./rankBlend";

export interface ContentSearchFilters {
  workspaceId?: string;
  lifecycleState?: string;
  visibility?: string;
  authorId?: string;
  templateId?: string;
  channelIds?: string[];
  tagIds?: string[];
  tagSlugs?: string[];
  aiGenerated?: boolean;
}

export interface ContentSearchRequest {
  q?: string;
  /** 384-dimensional embedding; must match TITLE_EMBEDDING_DIMS */
  queryVector?: unknown;
  filters?: ContentSearchFilters;
  weights?: Partial<RankBlendWeights>;
  from?: number;
  size?: number;
  /** Half-life in days for recency decay */
  recencyHalfLifeDays?: number;
  includeFacets?: boolean;
}

export interface FacetBucket {
  key: string | number | boolean;
  doc_count: number;
}

export interface ContentSearchHit {
  contentId: string;
  score: number;
  source: Record<string, unknown>;
}

export interface ContentSearchResponse {
  total: number;
  hits: ContentSearchHit[];
  facets?: Record<string, FacetBucket[]>;
}

function boolFilters(filters: ContentSearchFilters | undefined): estypes.QueryDslQueryContainer[] {
  const f: estypes.QueryDslQueryContainer[] = [];
  if (!filters) return f;
  if (filters.workspaceId) f.push({ term: { workspaceId: filters.workspaceId } });
  if (filters.lifecycleState) f.push({ term: { lifecycleState: filters.lifecycleState } });
  if (filters.visibility) f.push({ term: { visibility: filters.visibility } });
  if (filters.authorId) f.push({ term: { authorId: filters.authorId } });
  if (filters.templateId) f.push({ term: { templateId: filters.templateId } });
  if (filters.channelIds?.length) {
    f.push({ terms: { channelIds: filters.channelIds } });
  }
  if (filters.tagIds?.length) {
    f.push({ terms: { tagIds: filters.tagIds } });
  }
  if (filters.tagSlugs?.length) {
    f.push({ terms: { tagSlugs: filters.tagSlugs } });
  }
  if (filters.aiGenerated !== undefined) {
    f.push({ term: { aiGenerated: filters.aiGenerated } });
  }
  return f;
}

function normEsScore(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return raw / (raw + 1);
}

function parseFacetAggregations(aggs: Record<string, unknown> | undefined): Record<string, FacetBucket[]> {
  const out: Record<string, FacetBucket[]> = {};
  if (!aggs) return out;
  for (const [key, agg] of Object.entries(aggs)) {
    const buckets = (agg as { buckets?: FacetBucket[] })?.buckets;
    if (Array.isArray(buckets)) out[key] = buckets;
  }
  return out;
}

async function fetchFacets(
  client: Client,
  filterClauses: estypes.QueryDslQueryContainer[],
): Promise<Record<string, FacetBucket[]>> {
  const facetQuery: estypes.QueryDslQueryContainer =
    filterClauses.length > 0 ? { bool: { filter: filterClauses } } : { match_all: {} };
  const res = await client.search({
    index: CONTENT_INDEX_NAME,
    size: 0,
    query: facetQuery,
    aggregations: buildContentFacetAggregations() as Record<
      string,
      estypes.AggregationsAggregationContainer
    >,
  });
  return parseFacetAggregations(res.aggregations as Record<string, unknown>);
}

export async function ensureContentSearchIndex(client: Client): Promise<void> {
  const { buildContentIndexSettingsAndMappings } = await import("@comms-lib/db-elasticsearch");
  const exists = await client.indices.exists({ index: CONTENT_INDEX_NAME });
  if (!exists) {
    const def = buildContentIndexSettingsAndMappings() as {
      settings?: Record<string, unknown>;
      mappings?: Record<string, unknown>;
    };
    await client.indices.create({
      index: CONTENT_INDEX_NAME,
      settings: def.settings,
      mappings: def.mappings,
    });
  }
}

export async function indexContentDocument(
  client: Client,
  doc: ContentIndexDocument,
): Promise<void> {
  const { titleEmbedding, ...rest } = doc;
  const body: Record<string, unknown> = { ...rest };
  if (titleEmbedding && titleEmbedding.length > 0) body.titleEmbedding = titleEmbedding;
  await client.index({
    index: CONTENT_INDEX_NAME,
    id: doc.contentId,
    document: body,
    refresh: false,
  });
}

export async function deleteContentFromIndex(client: Client, contentId: string): Promise<void> {
  try {
    await client.delete({ index: CONTENT_INDEX_NAME, id: contentId, refresh: false });
  } catch (e: unknown) {
    const status = (e as { meta?: { statusCode?: number } })?.meta?.statusCode;
    if (status === 404) return;
    throw e;
  }
}

export async function syncContentIndexFromDb(prisma: PrismaClient, contentId: string): Promise<void> {
  const client = getElasticsearchClient();
  if (!client) return;
  await ensureContentSearchIndex(client);
  const doc = await buildContentIndexDocument(prisma, contentId);
  if (!doc) {
    await deleteContentFromIndex(client, contentId);
    return;
  }
  await indexContentDocument(client, doc);
}

export async function searchContent(req: ContentSearchRequest): Promise<ContentSearchResponse | null> {
  const client = getElasticsearchClient();
  if (!client) return null;

  await ensureContentSearchIndex(client);

  const weights = normalizeRankBlendWeights(req.weights);
  const filterClauses = boolFilters(req.filters);
  const q = req.q?.trim() || "";
  const queryVector = assertValidQueryVector(req.queryVector);
  const from = Math.max(0, req.from ?? 0);
  const size = Math.min(100, Math.max(1, req.size ?? 20));
  const halfLife = req.recencyHalfLifeDays ?? 30;
  const nowMs = Date.now();

  const facetsPromise =
    req.includeFacets !== false ? fetchFacets(client, filterClauses) : Promise.resolve(undefined);

  const browseQuery: estypes.QueryDslQueryContainer =
    filterClauses.length > 0 ? { bool: { filter: filterClauses } } : { match_all: {} };

  if (!q && !queryVector) {
    const [res, facets] = await Promise.all([
      client.search({
        index: CONTENT_INDEX_NAME,
        query: browseQuery,
        sort: [{ updatedAt: "desc" }],
        from,
        size,
      }),
      facetsPromise,
    ]);
    const total =
      typeof res.hits.total === "number" ? res.hits.total : res.hits.total?.value ?? 0;
    const hits: ContentSearchHit[] = (res.hits.hits ?? []).map((h: estypes.SearchHit) => ({
      contentId: String(h._id),
      score: typeof h._score === "number" ? h._score : 0,
      source: (h._source as Record<string, unknown>) ?? {},
    }));
    return { total, hits, facets };
  }

  const candidateSize = Math.min(80, Math.max(size, size * 2));

  const keywordPromise =
    q.length > 0
      ? client.search({
          index: CONTENT_INDEX_NAME,
          query: {
            bool: {
              filter: filterClauses.length > 0 ? filterClauses : undefined,
              must: [
                {
                  multi_match: {
                    query: q,
                    type: "best_fields",
                    fields: ["title^3", "summary^2", "bodyPlain", "body", "tags"],
                  },
                },
              ],
            },
          },
          size: candidateSize,
          _source: true,
        })
      : Promise.resolve(null);

  const knnFilter: estypes.QueryDslQueryContainer =
    filterClauses.length > 0 ? { bool: { filter: filterClauses } } : { match_all: {} };

  const knnPromise =
    queryVector != null
      ? client.search({
          index: CONTENT_INDEX_NAME,
          knn: {
            field: "titleEmbedding",
            query_vector: queryVector,
            k: candidateSize,
            num_candidates: Math.min(200, candidateSize * 4),
            filter: knnFilter,
          },
          size: candidateSize,
          _source: true,
        })
      : Promise.resolve(null);

  const [kwRes, knnRes, facets] = await Promise.all([keywordPromise, knnPromise, facetsPromise]);

  type Hit = { _id?: string; _score?: number | null; _source?: Record<string, unknown> };

  const kwHits = (kwRes?.hits?.hits ?? []) as Hit[];
  const knnHits = (knnRes?.hits?.hits ?? []) as Hit[];

  const byId = new Map<
    string,
    { source: Record<string, unknown>; kw?: number; kn?: number; kwRank?: number; knRank?: number }
  >();

  kwHits.forEach((h, i) => {
    const id = String(h._id ?? "");
    if (!id) return;
    const prev = byId.get(id) ?? { source: (h._source ?? {}) as Record<string, unknown> };
    prev.kw = typeof h._score === "number" ? h._score : 0;
    prev.kwRank = i;
    prev.source = { ...prev.source, ...(h._source ?? {}) };
    byId.set(id, prev);
  });

  knnHits.forEach((h, i) => {
    const id = String(h._id ?? "");
    if (!id) return;
    const prev = byId.get(id) ?? { source: (h._source ?? {}) as Record<string, unknown> };
    prev.kn = typeof h._score === "number" ? h._score : 0;
    prev.knRank = i;
    prev.source = { ...prev.source, ...(h._source ?? {}) };
    byId.set(id, prev);
  });

  const scored = [...byId.entries()].map(([contentId, v]) => {
    const src = v.source;
    const updatedAt = typeof src.updatedAt === "string" ? src.updatedAt : undefined;
    const eng = typeof src.engagementScore === "number" ? src.engagementScore : 0;

    const rrfKw = v.kwRank !== undefined ? rrfScore(v.kwRank) : 0;
    const rrfKn = v.knRank !== undefined ? rrfScore(v.knRank) : 0;

    const kwSignal =
      q.length > 0 ? weights.keyword * (0.6 * rrfKw + 0.4 * normEsScore(v.kw ?? 0)) : 0;
    const vecSignal =
      queryVector != null
        ? weights.vector * (0.6 * rrfKn + 0.4 * normEsScore(v.kn ?? 0))
        : 0;

    const blend =
      kwSignal +
      vecSignal +
      weights.recency * recencyScore(updatedAt, nowMs, halfLife) +
      weights.engagement * engagementNorm(eng);

    return { contentId, score: blend, source: src };
  });

  scored.sort((a, b) => b.score - a.score);
  const slice = scored.slice(from, from + size);

  const hits: ContentSearchHit[] = slice.map((s) => ({
    contentId: s.contentId,
    score: s.score,
    source: s.source,
  }));

  let total = scored.length;
  if (kwRes && typeof kwRes.hits?.total === "object" && kwRes.hits.total !== null) {
    total = Math.max(total, kwRes.hits.total.value ?? 0);
  }
  if (knnRes && typeof knnRes.hits?.total === "object" && knnRes.hits.total !== null) {
    total = Math.max(total, knnRes.hits.total.value ?? 0);
  }
  if (!kwRes && !knnRes) total = 0;

  return { total, hits, facets };
}
