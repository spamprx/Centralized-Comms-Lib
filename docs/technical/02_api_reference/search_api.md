# API Reference — Search

**Base path:** `/api/v1/search`

All search endpoints are read-only and require authentication. Search results are filtered by the caller's visibility access — hidden content and private content outside the caller's groups is never returned.

---

## Full-Text Content Search

```
GET /api/v1/search/content
```

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Free-text search query |
| `tags` | string[] | Filter by one or more tag names (comma-separated) |
| `authorId` | uuid | Filter by author |
| `from` | ISO8601 | Published after this date |
| `to` | ISO8601 | Published before this date |
| `channelId` | uuid | Filter by distribution channel |
| `templateId` | uuid | Filter by template |
| `semanticRank` | boolean | If `true`, re-rank results using vector similarity (requires AI quota) |
| `page` | number | Page number (1-indexed, default: 1) |
| `limit` | number | Results per page (default: 20, max: 100) |

### Response

```json
{
  "total": 127,
  "page": 1,
  "limit": 20,
  "hits": [
    {
      "id": "uuid",
      "title": "string",
      "summary": "string",
      "highlights": [
        "The <em>policy</em> requires all students to…"
      ],
      "score": 0.93,
      "semanticScore": 0.87,
      "tags": ["policy", "academic-integrity"],
      "author": { "id": "uuid", "name": "string" },
      "publishedAt": "ISO8601",
      "channels": ["EMAIL", "MOODLE"]
    }
  ],
  "facets": {
    "tags": [
      { "value": "policy", "count": 45 },
      { "value": "announcement", "count": 38 }
    ],
    "authors": [
      { "value": "uuid", "label": "Priya Singh", "count": 22 }
    ],
    "channels": [
      { "value": "EMAIL", "count": 89 }
    ]
  }
}
```

### Caching

Results are cached in Redis using an epoch-based cache key. The cache epoch is incremented whenever any content is published or modified, effectively invalidating all cached search results. Repeated identical queries within the same epoch are served from Redis without hitting Elasticsearch.

---

## Content Check

```
GET /api/v1/search/content-check
```

Checks whether a specific piece of content exists, by title or excerpt. Used by authors to avoid duplicates before creating new content.

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `title` | string | Exact or partial title to check |
| `text` | string | Text excerpt to search for |

### Response

```json
{
  "exists": true,
  "matches": [
    {
      "id": "uuid",
      "title": "Examination Policy Update 2026",
      "state": "PUBLISHED",
      "publishedAt": "ISO8601"
    }
  ]
}
```

Returns 200 with `exists: false` and empty `matches` array if nothing is found. Does **not** expose hidden content.

---

## Tag Autocomplete

```
GET /api/v1/tags
```

Returns the full tag list for autocomplete. Used in the editor tag picker.

```
GET /api/v1/tags/:id
```

Returns a single tag with its content count.

---

## Elasticsearch Index Management (Admin/Dev)

```
POST /dev/reindex
```

Available in development mode only (`NODE_ENV !== production`). Triggers a full Elasticsearch sync from PostgreSQL via `syncContentIndexFromDb`. Returns the number of documents indexed.

---

## Vector Index Status

The nightly vector reindex job (`jobs/nightlyVectorReindex.ts`) runs when `ENABLE_NIGHTLY_VECTOR_REINDEX=true`. Status can be monitored via:

```
GET /api/v1/admin/monitoring/metrics
```

The response includes a `vectorIndexLastRebuilt` timestamp field indicating when the dense vector index was last fully refreshed.

---

## Ranking Algorithm Detail

When `semanticRank=true` is passed:

1. The search query is embedded via `intelligence/syncAi.ts → embedText` → 384-dim vector
2. Elasticsearch performs a **hybrid query**:
   - BM25 full-text score (standard keyword relevance)
   - KNN dense vector similarity search on `titleEmbedding` (cosine distance)
3. Results are collected from both
4. `rankBlend.ts` computes the final score:

```
finalScore = (semanticWeight × cosineSimilarity)
           + (keywordWeight × normalizedBM25)
           + (recencyDecay × daysSincePublished)
           + (engagementBonus × log(1 + engagementScore))
```

5. Results are re-ordered by `finalScore` and returned

**Admin configuration:** `semanticWeight` and `keywordWeight` are tunable via `PATCH /admin/settings`. The sum of both weights should equal 1.0.

---

## Error Codes

| HTTP Status | Code | Meaning |
|------------|------|---------|
| 400 | `INVALID_FILTER` | Filter parameter value is not valid |
| 429 | `AI_QUOTA_EXCEEDED` | `semanticRank=true` but AI quota exhausted |
| 503 | `SEARCH_UNAVAILABLE` | Elasticsearch unreachable (graceful degradation: returns empty results) |
