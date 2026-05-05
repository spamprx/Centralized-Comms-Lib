/**
 * Intelligence Layer (SRS §3.4.7)
 *
 * Two sub-components:
 *   I1 — Sync AI (fast path): short, inline AI tasks with circuit-breaker protection
 *   I2 — Async AI Worker: long-running jobs enqueued via Transactional Outbox
 *
 * Domain services reach the Intelligence Layer via `withCircuitBreaker` (S6)
 * rather than calling the embedding service directly.  This keeps AI failures
 * isolated from core business logic.
 */

export {
  embedText,
  runSyncAiTask,
  type EmbedResult,
  type SyncAiTask,
  type SyncAiResult,
} from "./syncAi";

export {
  dispatchAsyncAiJob,
  enqueueAsyncAiJob,
  processAiJobOutbox,
  type AsyncAiJobType,
  type AsyncAiJobPayload,
  type AsyncAiJobResult,
} from "./asyncAiWorker";
