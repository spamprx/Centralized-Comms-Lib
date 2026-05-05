# Data Model — Vector Embeddings

Vector embeddings power the semantic search, AI Smart Ranking, and RAG retrieval features. Unlike the relational models in PostgreSQL, embeddings are stored in Elasticsearch as a dense vector field within the content search index.

---

## Embedding Schema (Elasticsearch)

**Index:** `comms-content` (configurable via `ELASTICSEARCH_CONTENT_INDEX`)

**Relevant field in the index mapping:**

```json
{
  "titleEmbedding": {
    "type": "dense_vector",
    "dims": 384,
    "index": true,
    "similarity": "cosine"
  }
}
```

**Dimensions:** 384 (output size of the embedding model served at `EMBEDDING_SERVICE_URL`)

**Similarity metric:** Cosine similarity. Values range from -1 (opposite) to 1 (identical). In practice, scores above 0.8 indicate strong semantic similarity.

**Content indexed per document:**

| Elasticsearch field | Source | Update frequency |
|--------------------|---------|--------------------|
| `id` | `Content.id` (PostgreSQL UUID) | On every content sync |
| `title` | `Content.title` | On every content change |
| `summary` | Content body excerpt | On every content change |
| `bodyPlain` | Plaintext extracted from TipTap JSON | On every content change |
| `tags` | `ContentTag` → `Tag.name` | On tag add/remove |
| `authorId` | `Content.authorId` | Rarely changes |
| `publishedAt` | `Content.updatedAt` (at publish) | On publication |
| `engagementScore` | Computed from view/like/reaction counts | On each engagement event |
| **`titleEmbedding`** | `embedText(title + " " + summary)` | Nightly (or on content change) |

---

## Embedding Generation

**File:** `apps/api/src/intelligence/syncAi.ts → embedText`

```typescript
async function embedText(text: string): Promise<number[]> {
  const response = await fetch(`${EMBEDDING_SERVICE_URL}/embed`, {
    method: 'POST',
    body: JSON.stringify({ text }),
    headers: { 'Content-Type': 'application/json' },
  });
  return response.json().embedding; // number[] of length 384
}
```

**Input:** Concatenation of `title` and `summary` (or just `title` for short items). The embedding captures the semantic meaning of the document's key identifiers.

**Circuit breaker:** Wrapped in `withCircuitBreaker('embedding-service')`. If the embedding service is unavailable, the content is indexed without a vector (text search still works; semantic ranking is skipped for that document).

---

## Embedding Update Cadence

### Incremental updates (triggered by content events)

When content is published or modified, `contentEmbedding.ts` is called synchronously within the request cycle:

```
content.service.ts → after state transition to PUBLISHED
    → contentEmbedding.updateEmbedding(contentId)
        → embedText(title + summary)
        → elasticsearch.update({ id: contentId, body: { titleEmbedding: vector } })
```

This ensures that the index is updated within the request cycle for most content changes. The 5-minute freshness requirement (SRS §4.4.8 REQ-2) is met by this synchronous path.

### Nightly full reindex (background job)

**File:** `apps/api/src/jobs/nightlyVectorReindex.ts`

Activated when `ENABLE_NIGHTLY_VECTOR_REINDEX=true`.

1. Fetches all `PUBLISHED` content items from PostgreSQL (paginated, 100 at a time)
2. For each item: calls `embedText(title + summary)`
3. Bulk-updates `titleEmbedding` in Elasticsearch using the bulk API
4. Also rebuilds `engagementScore` from the latest `ContentView`, `ContentLike`, and `ContentReaction` counts

This ensures stale embeddings (e.g. from when the embedding service was briefly unavailable) are always corrected within 24 hours. The nightly job satisfies SRS §4.9.4 REQ-2 ("vector index re-computed at least daily").

---

## Vector Search Query

When a user searches with `semanticRank=true`:

1. The search query text is embedded: `embedText(query)` → 384-dim vector
2. Elasticsearch performs a **hybrid KNN + BM25 search**:

```json
{
  "query": {
    "bool": {
      "must": { "multi_match": { "query": "user query", "fields": ["title^3", "summary^2", "bodyPlain"] } },
      "filter": [ { "term": { "status": "PUBLISHED" } } ]
    }
  },
  "knn": {
    "field": "titleEmbedding",
    "query_vector": [0.12, -0.34, ...],
    "k": 50,
    "num_candidates": 200
  }
}
```

3. `rankBlend.ts` combines scores:

```typescript
finalScore = (settings.semanticWeight * knnScore)
           + (settings.keywordWeight * bm25Score)
           + (0.05 * recencyScore)
           + (0.10 * log1p(engagementScore));
```

4. Results re-ordered by `finalScore` before returning to the client

---

## RAG Retrieval

For RAG queries (AI Tutor, RAG Q&A):

1. User question is embedded: `embedText(question)`
2. KNN search retrieves the top-K most semantically similar passages from the vector store
3. Retrieved passages are included as context in the prompt to the Sync AI model
4. The AI generates a grounded answer citing only the retrieved passages

The retrieval step uses a smaller K (typically 5–10 passages) compared to search (which may return up to 100 candidates) to keep the prompt context focused and avoid the AI hallucinating from too much contradictory context.

---

## Embedding Model Characteristics

| Property | Value |
|----------|-------|
| Output dimensions | 384 |
| Similarity metric used | Cosine |
| Input truncation | ~512 tokens (model-dependent) |
| Model location | External `EMBEDDING_SERVICE_URL` (not bundled in this repo) |
| Typical latency | 50–200 ms per call |

The specific embedding model (e.g. `all-MiniLM-L6-v2`, `text-embedding-3-small`) is configurable at the embedding service level. Changing the model requires a full index rebuild (run `POST /dev/reindex` or trigger the nightly job).
