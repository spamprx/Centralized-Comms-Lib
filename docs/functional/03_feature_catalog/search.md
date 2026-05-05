# Feature Catalog — Search

The search module provides full-text, faceted, and AI-powered semantic discovery of published content. It is backed by Elasticsearch for text search and a 384-dimensional dense vector index for semantic similarity.

---

## F-SRC-001 — Content Check `[Must Have]`

Users can quickly verify whether a specific piece of content exists in the library before creating a duplicate.

- Searches across titles, summaries, and body text
- Returns matching results within 500 ms for typical queries
- Returns "No results found" clearly if nothing matches (does not expose hidden content to unauthorised users)
- Available to Authors before creating a new draft — prevents duplicate effort

**Implementation status:** Fully implemented. `GET /api/v1/search/content-check`. `searchContentCheck` and `searchContentCheckByText` exported from `search/index.ts`. Elasticsearch query across `title`, `summary`, `bodyPlain` fields.

---

## F-SRC-002 — Filtering `[Must Have]`

Users apply faceted filters to narrow search results.

**Available filters:**
- Tags (multi-select)
- Author identity
- Date range (published, created, modified)
- Distribution channel
- Content status (published only for audience; all states for authors/admins)

**Behaviour:**
- Filters are combinable (AND between filter types, OR within a multi-value filter)
- The active filter count is always displayed
- Filter state is reflected in the URL as query parameters — links are shareable and back-navigation preserves the filter state
- Cache (Redis) serves repeated identical filter queries (epoch-based cache invalidation on content update)

**Implementation status:** Fully implemented. `GET /api/v1/search/content?tags=...&authorId=...&from=...&to=...`. Elasticsearch faceted queries with aggregations. Redis epoch cache in `contentSearch.service.ts`.

---

## F-SRC-003 — Full Text Search `[Must Have]`

Full-text search across all published content with relevance ranking.

**Search features:**
- Stemming (e.g. "announcement" matches "announce", "announcing")
- Synonym expansion (configurable synonym list in Elasticsearch settings)
- Typo tolerance (edge-ngram analyzer for fuzzy matching)
- Highlighted match snippets in results
- Index updated within 5 minutes of content publication or modification

**Elasticsearch index configuration** (`comms-content-index.json`):
- `title` — text with stemmer + edge_ngram
- `summary` — text with stemmer
- `bodyPlain` — text with stemmer + synonym_graph
- `tags` — keyword facets
- `titleEmbedding` — dense_vector, 384 dims, cosine similarity (for semantic layer)

**Implementation status:** Fully implemented. `contentSearch.service.ts → searchContentCached`. Elasticsearch queries with `multi_match` and highlight. `syncContentIndexFromDb` syncs content to ES. Nightly reindex via `jobs/nightlyVectorReindex`.

---

## F-SRC-004 — AI — Smart Ranking `[Must Have]`

AI re-ranks search results using semantic understanding, engagement signals, and link analysis to surface the most relevant content.

**Ranking signals (blended):**
- Vector-based semantic similarity score (cosine distance in `titleEmbedding` vector space)
- BM25 keyword relevance score from Elasticsearch
- Recency (publication date)
- Engagement signals: view count, reaction count, like count (`engagementScore` field in ES index)
- Link density (how many other items link to this one)

**Configuration:** Admins can tune the relative weights of semantic vs. keyword scores via admin settings. The vector index is re-computed at least daily (nightly vector reindex job).

**Implementation status:** Fully implemented. `rankBlend.ts` in the search module blends scores. `embedText` from `intelligence/syncAi.ts` generates query embeddings for vector similarity. `contentEmbedding.ts` manages document embedding updates. `jobs/nightlyVectorReindex.ts` keeps the vector index fresh.
