import { createHash } from "crypto";
import type { Client } from "@elastic/elasticsearch";
import { estypes } from "@elastic/elasticsearch";
import type { PrismaClient } from "@prisma/client";
import {
  CONTENT_INDEX_NAME,
  buildContentFacetAggregations,
  getElasticsearchClient,
} from "@comms-lib/db-elasticsearch";
import {
  bumpSearchCacheEpoch,
  getSearchCacheEpoch,
  redisGet,
  redisSet,
} from "../../shared/cache/redisClient";
import {
  buildContentIndexDocument,
  type ContentIndexDocument,
} from "./contentIndex.document";
import {
  assertValidQueryVector,
  engagementNorm,
  normalizeRankBlendWeights,
  type RankBlendWeights,
  recencyScore,
  rrfScore,
} from "./rankBlend";
import { joinSnippet, sanitizeHighlightFragments } from "./searchSnippets";
import type {
  ContentCheckByTextRequest,
  ContentCheckByTextResponse,
  ContentCheckSearchRequest,
  ContentSearchFilters,
  ContentSearchHit,
  ContentSearchRequest,
  ContentSearchResponse,
  FacetBucket,
} from "./searchTypes";

export type {
  ContentCheckByTextRequest,
  ContentCheckByTextResponse,
  ContentCheckSearchRequest,
  ContentSearchFilters,
  ContentSearchRequest,
  ContentSearchResponse,
  ContentSearchHit,
  FacetBucket,
} from "./searchTypes";

function boolFilters(
  filters: ContentSearchFilters | undefined,
): estypes.QueryDslQueryContainer[] {
  const f: estypes.QueryDslQueryContainer[] = [];
  if (!filters) return f;
  if (filters.workspaceId)
    f.push({ term: { workspaceId: filters.workspaceId } });
  if (filters.lifecycleState)
    f.push({ term: { lifecycleState: filters.lifecycleState } });
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

function parseFacetAggregations(
  aggs: Record<string, unknown> | undefined,
): Record<string, FacetBucket[]> {
  const out: Record<string, FacetBucket[]> = {};
  if (!aggs) return out;
  for (const [key, agg] of Object.entries(aggs)) {
    const buckets = (agg as { buckets?: FacetBucket[] })?.buckets;
    if (Array.isArray(buckets)) out[key] = buckets;
  }
  return out;
}

function keywordHighlightConfig(): estypes.SearchRequest["highlight"] {
  return {
    pre_tags: ["<mark>"],
    post_tags: ["</mark>"],
    fragment_size: 180,
    number_of_fragments: 2,
    fields: {
      title: {},
      summary: {},
      bodyPlain: {},
      tags: {},
    },
  };
}

function keywordMustClause(q: string): estypes.QueryDslQueryContainer {
  return {
    bool: {
      should: [
        {
          multi_match: {
            query: q,
            type: "best_fields",
            fuzziness: "AUTO",
            prefix_length: 1,
            fields: [
              "title^4",
              "title.auto^2",
              "summary^2.5",
              "bodyPlain^1.2",
              "body^0.8",
              "tags^1.5",
            ],
          },
        },
        {
          multi_match: {
            query: q,
            type: "phrase",
            slop: 2,
            boost: 0.55,
            fields: ["title^3", "bodyPlain"],
          },
        },
      ],
      minimum_should_match: 1,
    },
  };
}

function mapHitWithHighlight(
  h: estypes.SearchHit,
  fallbackScore: number,
): ContentSearchHit {
  const src = (h._source as Record<string, unknown>) ?? {};
  const hl = h.highlight as Record<string, string[]> | undefined;
  const highlight: Record<string, string[]> = {};
  let snippetHtml: string | undefined;
  if (hl) {
    for (const [k, v] of Object.entries(hl)) {
      highlight[k] = sanitizeHighlightFragments(v);
    }
    const order = ["title", "summary", "bodyPlain", "tags"];
    for (const key of order) {
      const fr = highlight[key];
      if (fr?.length) {
        snippetHtml = joinSnippet(fr);
        break;
      }
    }
  }
  return {
    contentId: String(h._id),
    score: typeof h._score === "number" ? h._score : fallbackScore,
    source: src,
    highlight: Object.keys(highlight).length ? highlight : undefined,
    snippetHtml,
  };
}

async function fetchFacets(
  client: Client,
  filterClauses: estypes.QueryDslQueryContainer[],
): Promise<Record<string, FacetBucket[]>> {
  const facetQuery: estypes.QueryDslQueryContainer =
    filterClauses.length > 0
      ? { bool: { filter: filterClauses } }
      : { match_all: {} };
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
  const { buildContentIndexSettingsAndMappings } =
    await import("@comms-lib/db-elasticsearch");
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
  if (titleEmbedding && titleEmbedding.length > 0)
    body.titleEmbedding = titleEmbedding;
  await client.index({
    index: CONTENT_INDEX_NAME,
    id: doc.contentId,
    document: body,
    refresh: false,
  });
}

export async function deleteContentFromIndex(
  client: Client,
  contentId: string,
): Promise<void> {
  try {
    await client.delete({
      index: CONTENT_INDEX_NAME,
      id: contentId,
      refresh: false,
    });
  } catch (e: unknown) {
    const status = (e as { meta?: { statusCode?: number } })?.meta?.statusCode;
    if (status === 404) return;
    throw e;
  }
}

export async function syncContentIndexFromDb(
  prisma: PrismaClient,
  contentId: string,
): Promise<void> {
  const client = getElasticsearchClient();
  if (!client) return;
  await ensureContentSearchIndex(client);
  const doc = await buildContentIndexDocument(prisma, contentId);
  if (!doc) {
    await deleteContentFromIndex(client, contentId);
    await bumpSearchCacheEpoch();
    return;
  }
  await indexContentDocument(client, doc);
  await bumpSearchCacheEpoch();
}

function cacheKey(epoch: string, payload: string): string {
  const h = createHash("sha256").update(payload).digest("hex").slice(0, 48);
  return `comms:search:v2:${epoch}:${h}`;
}

export async function searchContentCached(
  req: ContentSearchRequest,
): Promise<ContentSearchResponse | null> {
  const q = req.q?.trim() || "";
  const hasVec = assertValidQueryVector(req.queryVector) != null;
  const useFacets = req.includeFacets !== false;
  const cacheable =
    !q &&
    !hasVec &&
    !useFacets &&
    (req.includeSnippets === undefined || req.includeSnippets === false);

  if (cacheable) {
    const epoch = await getSearchCacheEpoch();
    const key = cacheKey(
      epoch,
      JSON.stringify({
        f: req.filters ?? {},
        from: req.from ?? 0,
        size: req.size ?? 20,
        w: normalizeRankBlendWeights(req.weights),
        half: req.recencyHalfLifeDays ?? 30,
      }),
    );
    const cached = await redisGet(key);
    if (cached) {
      try {
        return JSON.parse(cached) as ContentSearchResponse;
      } catch {
        /* fall through */
      }
    }
    const fresh = await searchContent({ ...req, includeFacets: false });
    if (fresh) {
      const ttl = Math.min(
        300,
        Math.max(30, Number(process.env.SEARCH_CACHE_TTL_SEC) || 90),
      );
      await redisSet(key, JSON.stringify(fresh), ttl);
    }
    return fresh;
  }

  return searchContent(req);
}

export async function searchContent(
  req: ContentSearchRequest,
): Promise<ContentSearchResponse | null> {
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
  const withSnippets = req.includeSnippets === true;

  const facetsPromise =
    req.includeFacets !== false
      ? fetchFacets(client, filterClauses)
      : Promise.resolve(undefined);

  const browseQuery: estypes.QueryDslQueryContainer =
    filterClauses.length > 0
      ? { bool: { filter: filterClauses } }
      : { match_all: {} };

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
      typeof res.hits.total === "number"
        ? res.hits.total
        : (res.hits.total?.value ?? 0);
    const hits: ContentSearchHit[] = (res.hits.hits ?? []).map(
      (h: estypes.SearchHit) => ({
        contentId: String(h._id),
        score: typeof h._score === "number" ? h._score : 0,
        source: (h._source as Record<string, unknown>) ?? {},
      }),
    );
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
              must: [keywordMustClause(q)],
            },
          },
          size: candidateSize,
          _source: true,
          ...(withSnippets ? { highlight: keywordHighlightConfig() } : {}),
        })
      : Promise.resolve(null);

  const knnFilter: estypes.QueryDslQueryContainer =
    filterClauses.length > 0
      ? { bool: { filter: filterClauses } }
      : { match_all: {} };

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

  const [kwRes, knnRes, facets] = await Promise.all([
    keywordPromise,
    knnPromise,
    facetsPromise,
  ]);

  type Hit = {
    _id?: string;
    _score?: number | null;
    _source?: Record<string, unknown>;
    highlight?: unknown;
  };

  const kwHits = (kwRes?.hits?.hits ?? []) as Hit[];
  const knnHits = (knnRes?.hits?.hits ?? []) as Hit[];

  const byId = new Map<
    string,
    {
      source: Record<string, unknown>;
      kw?: number;
      kn?: number;
      kwRank?: number;
      knRank?: number;
      highlight?: Record<string, string[]>;
      snippetHtml?: string;
    }
  >();

  kwHits.forEach((h, i) => {
    const id = String(h._id ?? "");
    if (!id) return;
    const esScore = typeof h._score === "number" ? h._score : 0;
    const prev = byId.get(id) ?? {
      source: (h._source ?? {}) as Record<string, unknown>,
    };
    prev.kw = esScore;
    prev.kwRank = i;
    prev.source = { ...prev.source, ...(h._source ?? {}) };
    if (withSnippets) {
      const mapped = mapHitWithHighlight(h as estypes.SearchHit, esScore);
      prev.highlight = mapped.highlight;
      prev.snippetHtml = mapped.snippetHtml;
    }
    byId.set(id, prev);
  });

  knnHits.forEach((h, i) => {
    const id = String(h._id ?? "");
    if (!id) return;
    const prev = byId.get(id) ?? {
      source: (h._source ?? {}) as Record<string, unknown>,
    };
    prev.kn = typeof h._score === "number" ? h._score : 0;
    prev.knRank = i;
    prev.source = { ...prev.source, ...(h._source ?? {}) };
    byId.set(id, prev);
  });

  const scored = [...byId.entries()].map(([contentId, v]) => {
    const src = v.source;
    const updatedAt =
      typeof src.updatedAt === "string" ? src.updatedAt : undefined;
    const eng =
      typeof src.engagementScore === "number" ? src.engagementScore : 0;

    const rrfKw = v.kwRank !== undefined ? rrfScore(v.kwRank) : 0;
    const rrfKn = v.knRank !== undefined ? rrfScore(v.knRank) : 0;

    const kwSignal =
      q.length > 0
        ? weights.keyword * (0.6 * rrfKw + 0.4 * normEsScore(v.kw ?? 0))
        : 0;
    const vecSignal =
      queryVector != null
        ? weights.vector * (0.6 * rrfKn + 0.4 * normEsScore(v.kn ?? 0))
        : 0;

    const blend =
      kwSignal +
      vecSignal +
      weights.recency * recencyScore(updatedAt, nowMs, halfLife) +
      weights.engagement * engagementNorm(eng);

    return {
      contentId,
      score: blend,
      source: src,
      highlight: v.highlight,
      snippetHtml: v.snippetHtml,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const slice = scored.slice(from, from + size);

  const hits: ContentSearchHit[] = slice.map((s) => ({
    contentId: s.contentId,
    score: s.score,
    source: s.source,
    highlight: s.highlight,
    snippetHtml: s.snippetHtml,
  }));

  let total = scored.length;
  if (
    kwRes &&
    typeof kwRes.hits?.total === "object" &&
    kwRes.hits.total !== null
  ) {
    total = Math.max(total, kwRes.hits.total.value ?? 0);
  }
  if (
    knnRes &&
    typeof knnRes.hits?.total === "object" &&
    knnRes.hits.total !== null
  ) {
    total = Math.max(total, knnRes.hits.total.value ?? 0);
  }
  if (!kwRes && !knnRes) total = 0;

  return { total, hits, facets };
}

/** Similarity / duplicate-style check using `more_like_this` with tuned thresholds. */
export async function searchContentCheck(
  req: ContentCheckSearchRequest,
): Promise<ContentSearchResponse | null> {
  const client = getElasticsearchClient();
  if (!client) return null;
  await ensureContentSearchIndex(client);

  const filterClauses = boolFilters(req.filters);
  const size = Math.min(50, Math.max(1, req.size ?? 12));
  const minScore =
    req.minScore ??
    Math.min(
      25,
      Math.max(4, Number(process.env.CONTENT_CHECK_MIN_SCORE) || 10.5),
    );

  const res = await client.search({
    index: CONTENT_INDEX_NAME,
    size,
    min_score: minScore,
    query: {
      bool: {
        filter: filterClauses.length > 0 ? filterClauses : undefined,
        must_not: [{ term: { contentId: req.contentId } }],
        should: [
          {
            more_like_this: {
              fields: ["title", "summary", "bodyPlain"],
              like: [{ _index: CONTENT_INDEX_NAME, _id: req.contentId }],
              min_term_freq: 1,
              max_query_terms: 28,
              minimum_should_match: "38%",
              stop_words: [
                "the",
                "a",
                "an",
                "and",
                "or",
                "of",
                "to",
                "in",
                "for",
                "on",
                "with",
              ],
            },
          },
        ],
        minimum_should_match: 1,
      },
    },
    _source: true,
  });

  const total =
    typeof res.hits.total === "number"
      ? res.hits.total
      : (res.hits.total?.value ?? 0);
  const hits: ContentSearchHit[] = (res.hits.hits ?? []).map(
    (h: estypes.SearchHit) => ({
      contentId: String(h._id),
      score: typeof h._score === "number" ? h._score : 0,
      source: (h._source as Record<string, unknown>) ?? {},
    }),
  );

  return { total, hits };
}

const CONTENT_CHECK_BODY_MAX_CHARS = Math.max(
  500,
  Number(process.env.CONTENT_CHECK_BODY_MAX_CHARS) || 8000,
);
const CONTENT_CHECK_MIN_INPUT_LEN = Math.max(
  3,
  Number(process.env.CONTENT_CHECK_MIN_INPUT_LEN) || 12,
);
const MLT_STOP_WORDS = [
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "for",
  "on",
  "with",
  "is",
  "it",
  "that",
  "this",
  "was",
  "are",
  "be",
  "has",
];

export async function searchContentCheckByText(
  req: ContentCheckByTextRequest,
): Promise<ContentCheckByTextResponse | null> {
  const client = getElasticsearchClient();
  if (!client) return null;
  await ensureContentSearchIndex(client);

  const title = (req.title ?? "").trim();
  const summary = (req.summary ?? "").trim();
  let body = (req.body ?? "").trim();

  const combinedLen = title.length + summary.length + body.length;
  if (combinedLen < CONTENT_CHECK_MIN_INPUT_LEN) {
    return {
      total: 0,
      hits: [],
      inputTooShort: true,
      message: "Not enough information to check for similar content.",
    };
  }

  if (body.length > CONTENT_CHECK_BODY_MAX_CHARS) {
    body = body.slice(0, CONTENT_CHECK_BODY_MAX_CHARS);
  }

  const filterClauses = boolFilters(req.filters);
  const size = Math.min(50, Math.max(1, req.size ?? 10));
  const minScoreRaw =
    req.minScore ??
    Math.min(
      20,
      Math.max(2, Number(process.env.CONTENT_CHECK_TEXT_MIN_SCORE) || 5),
    );

  const mltClauses: estypes.QueryDslQueryContainer[] = [];

  if (title.length >= 3) {
    mltClauses.push({
      more_like_this: {
        fields: ["title", "title.auto"],
        like: title,
        min_term_freq: 1,
        max_query_terms: 20,
        minimum_should_match: "30%",
        boost: 3,
        stop_words: MLT_STOP_WORDS,
      },
    });
  }

  if (summary.length >= 3) {
    mltClauses.push({
      more_like_this: {
        fields: ["summary"],
        like: summary,
        min_term_freq: 1,
        max_query_terms: 25,
        minimum_should_match: "25%",
        boost: 2,
        stop_words: MLT_STOP_WORDS,
      },
    });
  }

  if (body.length >= 10) {
    mltClauses.push({
      more_like_this: {
        fields: ["bodyPlain", "body"],
        like: body,
        min_term_freq: 1,
        max_query_terms: 35,
        minimum_should_match: "20%",
        boost: 1,
        stop_words: MLT_STOP_WORDS,
      },
    });
  }

  if (mltClauses.length === 0) {
    return {
      total: 0,
      hits: [],
      inputTooShort: true,
      message: "Not enough information to check for similar content.",
    };
  }

  const res = await client.search({
    index: CONTENT_INDEX_NAME,
    size,
    min_score: minScoreRaw,
    query: {
      bool: {
        filter: filterClauses.length > 0 ? filterClauses : undefined,
        should: mltClauses,
        minimum_should_match: 1,
      },
    },
    highlight: {
      pre_tags: ["<mark>"],
      post_tags: ["</mark>"],
      fragment_size: 150,
      number_of_fragments: 1,
      fields: { title: {}, summary: {}, bodyPlain: {} },
    },
    _source: true,
  });

  const rawHits = res.hits.hits ?? [];

  const maxRaw = rawHits.reduce(
    (mx, h) => Math.max(mx, typeof h._score === "number" ? h._score : 0),
    0,
  );
  const k = Math.max(1, maxRaw * 0.35);

  const hits: ContentSearchHit[] = rawHits.map((h: estypes.SearchHit) => {
    const raw = typeof h._score === "number" ? h._score : 0;
    const similarity = raw / (raw + k);
    const mapped = mapHitWithHighlight(h, similarity);
    return {
      contentId: mapped.contentId,
      score: parseFloat(similarity.toFixed(4)),
      source: mapped.source,
      highlight: mapped.highlight,
      snippetHtml: mapped.snippetHtml,
    };
  });

  const total =
    typeof res.hits.total === "number"
      ? res.hits.total
      : (res.hits.total?.value ?? 0);

  return { total, hits };
}
