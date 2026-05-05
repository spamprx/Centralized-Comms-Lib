# Sprint 5 — Implementation Notes

**Focus:** Advanced AI, Review Automation & Admin

**Committed features (15):** F-AUD-007, F-AUD-008, F-AUD-009, F-AUD-010, F-AUD-011, F-REV-006, F-REV-007, F-REV-008, F-REV-009, F-ADM-006, F-ADM-007, F-ADM-008, F-ADM-009, F-AUT-009, F-AUT-010

**Stretch goals (2):** F-AUD-014 (AI Convert Content Template), F-COL-003 (Q&A)

---

## What Was Built / Planned

### AI RAG and AI Tutor (F-AUD-008, F-AUD-011)

**Key design decision — RAG retrieval scope:**
The AI Tutor (F-AUD-011) uses item-scoped retrieval (passages from a single content item only). The RAG Q&A (F-AUD-008) uses library-wide retrieval. This scope difference is enforced by an Elasticsearch filter, not by a different code path — both features use the same `runSyncAiTask('RAG_ANSWER')` path with different retrieval context.

**Multi-turn conversation (AI Tutor):**
- Session stored in Redis with a 24-hour sliding TTL
- Context window management: oldest turns dropped when the assembled prompt exceeds ~3 000 tokens
- Turn count is capped at 20 per session to prevent runaway token usage against the AI service

**Citation verification:**
- After the AI generates an answer, each citation is verified by querying `ContentRepository.verifyPassageExists`
- Unverified citations are flagged (not removed) — the answer is still useful; the user is just warned
- Verification is O(citations) with indexed lookups; typically < 10 ms for 3–5 citations

**RAG freshness:**
- The Elasticsearch vector index is updated on every content publication (synchronous incremental update)
- The nightly reindex ensures no document is > 24 hours stale in the vector space

### AI Clustering (F-AUD-007)

**Decision:** Cluster computation is entirely async (Async AI Worker). Cluster results are cached and served from Redis.

**Clustering flow:**
1. `enqueueAsyncAiJob({ jobType: 'TOPIC_CLUSTER' })` dispatched by a scheduled job (similar to nightly reindex)
2. AI Worker fetches all content embeddings from Elasticsearch
3. Runs K-means or HDBSCAN clustering on the 384-dim vectors
4. Returns cluster assignments + computed cluster labels
5. Results stored in Redis: `clusters:all` with 24-hour TTL
6. `GET /api/v1/content/clusters` serves from Redis cache

**Cluster label generation:** The AI worker generates a human-readable label for each cluster by summarising the most representative documents in that cluster.

### Review Assignment Rules (F-REV-006)

**Decision:** Rules evaluated eagerly at submission time (not lazy at assignment query time).

**Implementation:**
- `ReviewPolicy.conditions` stores rule predicates as JSON (`{ tags: [...], channels: [...], ... }`)
- `businessRules/index.ts → evaluateBusinessRule('AUTO_ASSIGN_REVIEWERS')` evaluates all active policies
- Matching reviewer groups/users are collected, deduplicated, and assigned
- Rule evaluation is O(policies × conditions); for typical deployments (< 50 policies) this is < 5 ms

**Edge case:** If auto-assignment rules result in zero reviewers being assigned and no manual reviewers are set, the submission is blocked with: "No reviewers could be assigned by the active review policies. Please assign reviewers manually."

### Review Version Comparison (F-REV-007)

**Implementation:** Reuses `compareSnapshotsWordDiff` from Sprint 3 (F-AUT-011). The reviewer version comparison UI (`VersionHistoryLayout.tsx`) allows selecting any two snapshots from the content's history, not just consecutive versions. This is more useful during review — reviewers often want to compare "what was submitted" vs "what is here now after author revisions".

### AI Screening (F-REV-009)

**Decision:** Screening is triggered automatically on every submission to review (not opt-in). Results are advisory.

**Implementation:**
- On `transitionState(contentId, 'IN_REVIEW')`: an `AI_SCREENING` job is enqueued
- Results returned by the AI worker are stored in `ReviewRequest.screeningResults` JSON field
- Frontend review panel shows screening warnings pre-attached when the reviewer opens the item
- Screening does **not** block the review or auto-deny the submission — human reviewers always have final authority

**Why advisory and not blocking:** False positives from AI screening would create friction and erode trust. Reviewers seeing warnings (not blocks) builds trust in the AI gradually.

### Content Pipeline (F-AUT-010)

**Decision:** Pipeline steps are configured by admins; each step maps to a specific AI task type.

**Step types supported:**
- `GRAMMAR_CHECK` → Sync AI (fast, inline)
- `TONE_CHECK` → Sync AI
- `POLICY_COMPLIANCE` → Async AI (deep analysis)
- `FORMATTING_CHECK` → Sync AI (rule-based, not AI)
- `SCHEDULED_PUBLISH` → sets a publish-at timestamp (no AI)

**Pipeline run flow:**
1. `POST /workflows/pipeline-run { contentId, pipelineId }` 
2. For each step in order:
   - Lightweight steps: `runSyncAiTask` inline
   - Heavy steps: `enqueueAsyncAiJob`; wait for result before proceeding to next step (sequential)
3. Aggregate results returned as a pipeline run report
4. Report stored in `AuditLog` with action `PIPELINE_RUN`

### Content Invalidation (F-ADM-008)

**Decision:** Soft delete pattern (not hard delete) with immediate search index removal.

**Implementation:**
- `Content.invalidated = true` set atomically with the `CONTENT.INVALIDATED` outbox event
- Elasticsearch update: `{ doc: { status: 'INVALIDATED' } }` — filtered out of all search queries
- Author notified via outbox → notification dispatcher
- Bulk invalidation: `POST /admin/content/bulk-invalidate` processes up to 100 items per request in a batch transaction

### Admin AI Monitor (F-ADM-006)

**Decision:** The anomaly detection model is stateless — it computes anomaly scores from the latest metrics window, not from trained baseline models. This makes it simpler to deploy and configure but less precise than ML-based anomaly detection.

**Algorithm:**
- Fetch metrics for the last 60 minutes (content creation count, review denial rate, login failure count)
- Compare against the trailing 7-day average for the same time-of-day window
- If metric > N × trailing average: emit anomaly alert
- N is configurable per metric (default: 3× for content creation, 2× for denial rate)

**Alert delivery:** `NOTIFICATION:ANOMALY_ALERT` outbox event → `notificationDispatcher` → admin in-app notification + email via Notify API.

### AI Content Refresh (F-AUT-009)

**Decision:** Tracked changes presentation, not inline auto-apply.

**Implementation:**
- `enqueueAsyncAiJob({ jobType: 'CONTENT_REFRESH', payload: { contentId } })`
- AI worker identifies outdated sections using semantic similarity against the Vector Store
- Returns a change-set: `{ operations: [{ type: 'REPLACE', from: string, to: string, reason: string }] }`
- Frontend presents this as a TipTap tracked-changes view (additions/deletions highlighted)
- Author accepts or rejects each suggested change individually
- Accepted changes applied as a new `ContentVersion`; rejected changes discarded

---

## Architecture Observations After Sprint 5

### What Worked Well

1. **Outbox Pattern for reliability:** Zero cases of lost notifications or events across all sprints. The pattern paid off — even when the Notify API was temporarily unavailable, notifications were queued and delivered when the service recovered.

2. **Intelligence Layer isolation:** Adding new AI features in Sprint 5 required no changes to the Gateway, Application, or Repository layers. All AI work is isolated to `intelligence/` + the outbox worker.

3. **Component propagation:** The async propagation approach scales well. A test with 500 linked content items showed propagation completing in ~8 seconds with the default polling interval.

### Known Limitations Post-Sprint 5

1. **Async job result retrieval:** Still using `OutboxEvent.metadata` for job results. A dedicated `AiJobResult` table is needed before going to production.

2. **AI screening quality:** The screening model identifies obvious policy violations but has low recall for subtle compliance issues. Model quality will improve over time with feedback loops.

3. **Collaboration features (F-COL-*):** All three collaboration features are not yet implemented (Nice to Have). The `Workspace` model and `group.routes.ts` provide the structural foundation for future implementation.

4. **Conditional render (F-TMP-012):** The `waPlaceholderManifest.ts` supports basic placeholder substitution for WhatsApp but full conditional rendering (section visibility by role/group) is not yet implemented in the template engine.
