# AI Subsystem — Feature-to-Path Map

A consolidated reference showing which AI features use which path, what data they consume, and what they produce.

---

## Authors

| Feature ID | Feature name | AI path | Input | Output | Sprint |
|-----------|-------------|---------|-------|--------|--------|
| F-AUT-006 | AI — Create Drafts (short) | Sync AI `CONTENT_DRAFT_SHORT` | Author prompt + template structure | TipTap JSON draft | Sprint 2 |
| F-AUT-006 | AI — Create Drafts (long-form) | Async AI `CONTENT_DRAFT_LONG` | Author outline + template structure | TipTap JSON draft | Sprint 2 |
| F-AUT-009 | AI — Update Old Templates / Drafts | Async AI `CONTENT_REFRESH` | Full document body + Vector Store comparison | Tracked-changes diff | Sprint 5 |
| F-AUT-010 | AI — Content Pipeline (light step) | Sync AI `PIPELINE_STEP_LIGHT` | Document body + step config | Pass/fail + feedback | Sprint 5 |
| F-AUT-010 | AI — Content Pipeline (deep step) | Async AI `PIPELINE_STEP_DEEP` | Document body + step config | Pass/fail + detailed report | Sprint 5 |
| F-AUT-012 | AI — Auto Tag | Async AI `TAG_SUGGEST_DEEP` | Document body | Suggested tag names | Sprint 2 (stretch) |

---

## Reviewers

| Feature ID | Feature name | AI path | Input | Output | Sprint |
|-----------|-------------|---------|-------|--------|--------|
| F-REV-005 | AI — Automate Approval | Sync AI `FORMAT_VALIDATE` | Document body + format rules | Pass/fail per rule | Sprint 2 |
| F-REV-008 | Plagiarism Check | Async AI `PLAGIARISM_CHECK` | Document body + Vector Store corpus | Similarity report (%) | Sprint 5 |
| F-REV-009 | AI — Screening | Async AI `AI_SCREENING` | Document body + policy rules | Violations + warnings list | Sprint 5 |
| F-REV-010 | AI — Content Contradiction | Async AI `CONTRADICTION_CHECK` | Document body + related library content | Contradiction pairs + confidence | Sprint 2 (stretch) |
| F-REV-011 | AI — Comment to Action List | Async AI `COMMENT_ACTION_LIST` | All comment threads + document body | Prioritised action list | Sprint 3 (stretch) |

---

## Audience

| Feature ID | Feature name | AI path | Input | Output | Sprint |
|-----------|-------------|---------|-------|--------|--------|
| F-AUD-006 | AI — Summarize (short) | Sync AI `SUMMARIZE_SHORT` | Document body + length preset | Summary text | Sprint 4 |
| F-AUD-006 | AI — Summarize (long) | Async AI `SUMMARIZE_LONG` | Document body + length preset | Summary text | Sprint 4 |
| F-AUD-007 | AI — Clustering | Async AI `TOPIC_CLUSTER` | All content embeddings (Vector Store) | Cluster assignments + labels | Sprint 5 |
| F-AUD-008 | AI — RAG | Sync AI `RAG_ANSWER` | Question + retrieved passages (Vector Store + ES) | Answer + citations | Sprint 5 |
| F-AUD-011 | AI — AI Tutor | Sync AI `RAG_ANSWER` | Question + session history + retrieved passages | Answer + citations + sessionId | Sprint 5 |
| F-AUD-014 | AI — Convert Content Template | Async AI `CONTENT_TEMPLATE_CONVERT` | Content body + source + target templates | Reformatted content | Sprint 5 (stretch) |

---

## Admin

| Feature ID | Feature name | AI path | Input | Output | Sprint |
|-----------|-------------|---------|-------|--------|--------|
| F-ADM-006 | AI — Monitor | Async AI `ANOMALY_DETECT` | Analytics metrics timeseries | Anomaly events + suggested actions | Sprint 5 |
| F-ADM-009 | AI — Analyse | Async AI `ANALYTICS_REPORT` | Content corpus + engagement data | Readability scores + engagement report | Sprint 5 |

---

## Templates

| Feature ID | Feature name | AI path | Input | Output | Sprint |
|-----------|-------------|---------|-------|--------|--------|
| F-TMP-007 | AI — Draft First Version | Async AI `TEMPLATE_DRAFT` | Natural language description + channel | Draft template layout (JSON) | Sprint 3 |
| F-TMP-011 | AI — Convert Between Channel Templates | Async AI `TEMPLATE_CHANNEL_CONVERT` | Source template + target channel | Adapted template layout (JSON) | Sprint 5 |

---

## Search

| Feature ID | Feature name | AI path | Input | Output | Sprint |
|-----------|-------------|---------|-------|--------|--------|
| F-SRC-004 | AI — Smart Ranking | Sync AI (embed) `EMBED_TEXT` | Search query | 384-dim query vector | Sprint 3 |

---

## System-Initiated (No User Quota)

| Task | AI path | Trigger | Cadence |
|------|---------|---------|---------|
| Content embedding on publish | Sync AI `EMBED_TEXT` | Content published | Per event |
| Nightly vector reindex | Async AI `VECTOR_REINDEX` | Scheduled job | Nightly |
| AI screening on review submission | Async AI `AI_SCREENING` | Content submitted to review | Per submission |

---

## AI Service Endpoint Summary

All AI paths ultimately communicate with one external service URL (`EMBEDDING_SERVICE_URL`):

| Endpoint | Used by |
|----------|---------|
| `POST /embed` | All `embedText` calls (Sync AI) |
| `POST /ai/task` | All Sync AI task calls (`runSyncAiTask`) |
| `POST /ai/jobs` | All Async AI job dispatches (`dispatchAsyncAiJob`) |

The external AI service is responsible for:
- Routing tasks to the appropriate model
- Managing model loading and inference
- Returning structured results in the expected format

The Comms-Library API treats the AI service as a black box accessible via HTTP. The specific models used (LLM, embedding model) are configured at the AI service level and can be changed without modifying the API codebase.
