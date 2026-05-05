# Intelligence Layer

## Purpose

The Intelligence Layer handles all AI and search work in isolation from the main API request path. By running AI workloads in a dedicated layer, the system prevents heavy AI computation from introducing latency into regular content CRUD operations.

The layer exposes two primary paths:

| Path | When used | Response time |
|------|-----------|--------------|
| **Sync AI (fast path)** | Short prompts, format validation, query embedding, RAG answers | Near-instant (< 2 s) |
| **Async AI Worker** | Template generation, plagiarism checks, content pipeline runs, nightly reindex | Background (seconds to minutes) |

---

## Code Location

```
apps/api/src/intelligence/
├── syncAi.ts         ← runSyncAiTask, embedText
├── asyncAiWorker.ts  ← enqueueAsyncAiJob, dispatchAsyncAiJob, processAiJobOutbox
└── index.ts          ← re-exports
```

---

## Sync AI (Fast Path)

**File:** `apps/api/src/intelligence/syncAi.ts`

### `embedText(text: string): Promise<number[]>`

Sends a POST request to `EMBEDDING_SERVICE_URL/embed` with the text payload. Returns a 384-dimensional float vector. Used for:
- Indexing new content into the Elasticsearch vector store
- Embedding search queries before vector similarity scoring
- Comparing passages for plagiarism checking (when used inline)

Wrapped in `withCircuitBreaker('embedding-service')`. If the circuit is open, returns a graceful error rather than hanging.

### `runSyncAiTask(task: SyncAiTask): Promise<SyncAiResult>`

Sends a POST request to `EMBEDDING_SERVICE_URL/ai/task` with a structured task payload. Returns the AI response synchronously within the request cycle.

**Task types routed through Sync AI:**
- `FORMAT_VALIDATE` — checks content against format rules for auto-approval
- `SUMMARIZE_SHORT` — generates a concise summary of short content
- `RAG_ANSWER` — generates a grounded answer using retrieved context passages
- `TAG_SUGGEST_QUICK` — suggests 1–3 tags for short content

The calling service awaits the result before responding to the client. Circuit breaker applies — if the AI service is unavailable, the service returns a 503 with a retry suggestion rather than hanging.

---

## Async AI Worker

**File:** `apps/api/src/intelligence/asyncAiWorker.ts`

Long-running AI jobs are queued via the Outbox Pattern rather than called directly.

### `enqueueAsyncAiJob(jobType, payload, uow)`

1. Writes an `OutboxEvent` with `eventType: KnownEventType.AI_JOB.*` to the database **in the same transaction as the triggering domain write**
2. Returns immediately with a job ID — the HTTP response is sent before the job runs
3. The `processAiJobOutbox` worker picks up the event on the next poll

### `dispatchAsyncAiJob(jobType, payload): Promise<void>`

Sends the job to the external AI worker service via `POST /ai/jobs`. Called by `processAiJobOutbox` after the event has been dequeued.

Wrapped in `withCircuitBreaker('async-ai-worker')`. Failed dispatches are retried via `withIdempotencyRetry`.

### `processAiJobOutbox()`

Polls the `OutboxEvent` table for unprocessed `AI_JOB.*` events. For each:
1. Reads the job payload
2. Calls `dispatchAsyncAiJob`
3. On success: marks the event as processed
4. On failure: increments retry count; moves to dead-letter queue after max retries

**Background worker activation:** Enabled by `ENABLE_OUTBOX_WORKER=true` environment variable. The `server.ts` entrypoint starts the outbox worker on a polling interval when this flag is set.

### Job Types

| Job type | Triggered by | Output |
|----------|-------------|--------|
| `TEMPLATE_DRAFT` | Template AI generation | Generated template layout |
| `CONTENT_DRAFT_LONG` | AI draft creation (long-form) | Draft TipTap JSON |
| `PLAGIARISM_CHECK` | Reviewer initiates plagiarism check | Similarity report |
| `AI_SCREENING` | Content submission to review queue | Pre-screening findings |
| `CONTENT_PIPELINE_STEP` | Author triggers pipeline run | Pass/fail per step |
| `CONTENT_REFRESH` | AI update old templates/drafts | Tracked-changes diff |
| `TEMPLATE_CHANNEL_CONVERT` | Template channel conversion | Converted template draft |
| `ANALYTICS_REPORT` | Admin analytics request | Readability/engagement report |
| `VECTOR_REINDEX` | Nightly reindex job | Updated Elasticsearch vectors |

---

## Search Integration

The Intelligence Layer also encompasses the content search subsystem, though it lives in the `modules/search/` directory for co-location with the search routes.

### Content Embedding (`contentEmbedding.ts`)

Generates and updates the `titleEmbedding` field in Elasticsearch for each published content item. Called:
- After every content publication (incremental update)
- By the nightly reindex job (full refresh)

### Rank Blending (`rankBlend.ts`)

Combines multiple ranking signals into a final relevance score:

```
finalScore = (semanticWeight × vectorSimilarity)
           + (keywordWeight × bm25Score)
           + (recencyBonus × recencyScore)
           + (engagementBonus × engagementScore)
```

Weights are configurable by admins via `PATCH /admin/settings`.

---

## External AI Services

The Intelligence Layer communicates with two external services:

| Service | URL env var | Used for |
|---------|------------|---------|
| Embedding service | `EMBEDDING_SERVICE_URL` | Text embedding (`/embed`), sync AI tasks (`/ai/task`) |
| Async AI worker | (same service, different endpoint) | Long-running AI jobs (`/ai/jobs`) |

Both services are external HTTP APIs. The actual AI model implementation (LLM, embedding model) is outside the scope of this codebase and can be swapped independently of the API server.

---

## Nightly Vector Reindex Job

**File:** `apps/api/src/jobs/nightlyVectorReindex.ts`

Activated by `ENABLE_NIGHTLY_VECTOR_REINDEX=true`. Runs once per day (scheduled in `server.ts`).

1. Fetches all published content from Prisma (paginated)
2. For each item: calls `embedText(title + summary)`
3. Updates the `titleEmbedding` dense vector in Elasticsearch
4. Ensures the vector index is always < 24 hours stale

This satisfies the requirement that the vector index is re-computed at least daily (SRS §4.9.4 REQ-2).
