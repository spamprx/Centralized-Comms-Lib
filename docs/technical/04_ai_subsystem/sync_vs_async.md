# AI Subsystem — Sync vs. Async Path Selection

## Overview

All AI work in Comms-Library flows through one of two paths in the Intelligence Layer:

| Path | When | Response model | Timeout handling |
|------|------|----------------|-----------------|
| **Sync AI (fast path)** | Short, time-sensitive tasks | Awaited inline; user waits for response | Circuit opens after consecutive failures; 503 returned |
| **Async AI Worker** | Long-running, background jobs | Job ID returned immediately; result delivered later | Jobs survive server restarts via Outbox; dead-lettered after N retries |

---

## Decision Logic

The service layer decides which path to use based on:

1. **Expected duration:** Is the task expected to complete in < 3 seconds? → Sync. Otherwise → Async.
2. **User expectation:** Does the user expect an immediate response? → Sync. Does the user trigger-and-come-back? → Async.
3. **Resource intensity:** Does the task require processing the full document body (thousands of tokens)? → Async.

### Routing table

| Feature | Task type | Path | Rationale |
|---------|-----------|------|-----------|
| AI draft (short prompt) | `CONTENT_DRAFT_SHORT` | **Sync** | User expects near-instant result |
| AI draft (long outline) | `CONTENT_DRAFT_LONG` | **Async** | Multi-section generation; 10–60 s expected |
| Format validation (auto-approval) | `FORMAT_VALIDATE` | **Sync** | Run at submission time; must complete inline |
| AI screening | `AI_SCREENING` | **Async** | Full-document analysis; pre-attached to review |
| Plagiarism check | `PLAGIARISM_CHECK` | **Async** | Cross-corpus comparison; typically 20–120 s |
| Summarise (short content) | `SUMMARIZE_SHORT` | **Sync** | Small content; user is reading and wants summary now |
| Summarise (long content) | `SUMMARIZE_LONG` | **Async** | Long-form doc; show loading indicator |
| RAG query / AI Tutor | `RAG_ANSWER` | **Sync** | Conversational; user is waiting for answer |
| AI tag suggestion (quick) | `TAG_SUGGEST_QUICK` | **Sync** | 1–3 tags; near-instant |
| AI tag suggestion (full doc) | `TAG_SUGGEST_DEEP` | **Async** | Full semantic analysis |
| Template AI draft | `TEMPLATE_DRAFT` | **Async** | Always long-form; template generation is complex |
| Template channel convert | `TEMPLATE_CHANNEL_CONVERT` | **Async** | Cross-channel adaptation requires model inference |
| Content pipeline step (lightweight) | `PIPELINE_STEP_LIGHT` | **Sync** | Grammar check, tone check |
| Content pipeline step (deep) | `PIPELINE_STEP_DEEP` | **Async** | Compliance scan, factual analysis |
| AI content refresh | `CONTENT_REFRESH` | **Async** | Tracked-changes generation; full-document |
| AI analytics report | `ANALYTICS_REPORT` | **Async** | Corpus-wide analysis |
| AI anomaly detection | `ANOMALY_DETECT` | **Async** | Continuous background monitoring |
| Vector embedding | `EMBED_TEXT` | **Sync** | Called inline at content publish; must be fast |
| Vector reindex (nightly) | `VECTOR_REINDEX` | **Async** | Full corpus; scheduled job |

---

## Sync AI Path Details

**File:** `apps/api/src/intelligence/syncAi.ts`

```
Service Layer
    → runSyncAiTask({ taskType, payload })
        → POST EMBEDDING_SERVICE_URL/ai/task
            [wait for response]
        ← { result }
    → Service Layer processes result inline
    → HTTP response returned to client
```

**Failure handling:**
- If the external AI service returns an error or times out → `withCircuitBreaker` catches it
- Circuit breaker opens after N consecutive failures (configurable)
- While open: all Sync AI calls fail immediately with `CircuitOpenError` (caught and returned as 503)
- Half-open probe after recovery timeout (exponential back-off)

---

## Async AI Path Details

**File:** `apps/api/src/intelligence/asyncAiWorker.ts`

```
Service Layer
    → enqueueAsyncAiJob({ jobType, payload }, uow)
        → uow.withTransaction:
            [domain write]
            [OutboxEvent(AI_JOB.{jobType}, PENDING)]
        ← { jobId }
    → HTTP response returned immediately: { jobId, status: "QUEUED" }

... (time passes) ...

Outbox Worker (background)
    → fetchUnprocessedEvents()
    → withIdempotencyRetry(event.id):
        → dispatchAsyncAiJob(event.jobType, event.payload)
            → POST EMBEDDING_SERVICE_URL/ai/jobs
        ← job accepted by AI service
    → markProcessed(event.id)

AI service completes job
    → callback or polling endpoint provides result
    → Service Layer retrieves result and notifies user
```

**Job persistence:** Because the job is recorded in the `OutboxEvent` table before the HTTP response is sent, no job is ever lost even if:
- The API server crashes immediately after returning the response
- The AI service is temporarily unavailable
- The outbox worker is restarted

The job will be picked up on the next outbox poll and retried.

---

## Client Polling for Async Results

When an async job is returned to the client:

```json
{ "jobId": "uuid", "status": "QUEUED" }
```

The client polls:

```
GET /api/v1/content/:id/ai-job-status/:jobId
```

Possible responses:

```json
{ "status": "QUEUED" }
{ "status": "PROCESSING" }
{ "status": "COMPLETED", "result": { ... } }
{ "status": "FAILED", "error": "string" }
```

Results are stored in the `OutboxEvent.payload` (updated after AI completion callback) and served from there. Redis caches the result after first retrieval.

---

## Quota Enforcement Relationship

The AI quota (enforced by the Gateway Layer's `aiQuotaEnforcer`) applies to both paths:

- **Sync AI:** Quota is checked at the Gateway before the request reaches the service layer
- **Async AI:** Quota is checked at the Gateway when the `enqueueAsyncAiJob` request is made (before the outbox event is written)

This means quota limits are always enforced before any work is done and before any database writes are made, keeping the system consistent even when quotas change.
