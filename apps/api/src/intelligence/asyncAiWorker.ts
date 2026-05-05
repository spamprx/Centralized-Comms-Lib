/**
 * Intelligence Layer — Async AI Worker (SRS §3.4.7 I2)
 *
 * Handles long-running AI jobs that must not block the request/response cycle:
 *   - Draft generation from prompts
 *   - Plagiarism checking
 *   - Content pipeline (grammar, tone, compliance)
 *   - Topic clustering
 *   - Template conversion between channels
 *   - AI-driven template first-version generation
 *
 * Jobs are enqueued as OutboxEvents with aggregateType "AI_JOB" so they
 * benefit from the same transactional reliability as domain events (Outbox
 * Pattern, SRS §3.2 — Transactional Reliability).
 *
 * The worker polls OutboxEvents of type AI_JOB_* and dispatches them to the
 * AI inference service asynchronously.  Progress/results are stored back
 * via the Content / Template repository.
 *
 * Environment:
 *   EMBEDDING_SERVICE_URL      Base URL for the AI inference service
 *   AI_JOB_TIMEOUT_MS          Per-job HTTP timeout (default: 60000)
 */

import { withCircuitBreaker } from "../shared/circuitBreaker";
import { getPrismaClient } from "../repository";

const DEFAULT_JOB_TIMEOUT_MS = 60_000;

function getAiBase(): string | null {
  return process.env.EMBEDDING_SERVICE_URL?.trim() || null;
}

function getJobTimeoutMs(): number {
  const t = parseInt(process.env.AI_JOB_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(t) && t > 0 ? t : DEFAULT_JOB_TIMEOUT_MS;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export type AsyncAiJobType =
  | "AI_JOB.GENERATE_DRAFT"
  | "AI_JOB.PLAGIARISM_CHECK"
  | "AI_JOB.CONTENT_PIPELINE"
  | "AI_JOB.CLUSTER_TOPICS"
  | "AI_JOB.CONVERT_TEMPLATE"
  | "AI_JOB.GENERATE_TEMPLATE"
  | "AI_JOB.UPDATE_STALE_DRAFT"
  | "AI_JOB.AI_MONITOR_ANOMALY";

export type AsyncAiJobPayload = Record<string, unknown>;

export type AsyncAiJobResult =
  | { ok: true; output: unknown }
  | { ok: false; reason: string };

/**
 * Dispatch a single async AI job to the inference service.
 * Returns null when the service is not configured (dev / CI).
 */
export async function dispatchAsyncAiJob(
  jobType: AsyncAiJobType,
  payload: AsyncAiJobPayload,
): Promise<AsyncAiJobResult | null> {
  const base = getAiBase();
  if (!base) return null;

  const url = `${base.replace(/\/$/, "")}/ai/jobs`;

  return withCircuitBreaker(`async-ai:${jobType}`, async () => {
    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobType, payload }),
        },
        getJobTimeoutMs(),
      );
      if (!res.ok) {
        return { ok: false as const, reason: `HTTP ${res.status}` };
      }
      const data = (await res.json()) as { output?: unknown };
      return { ok: true as const, output: data.output ?? null };
    } catch (err) {
      return {
        ok: false as const,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  });
}

/**
 * Enqueue an AI job via the Transactional Outbox so it is committed
 * atomically with any associated data change and dispatched reliably.
 *
 * The outbox consumer (`processComponentAndAssetOutbox`) will pick up
 * AI_JOB_* events and call `dispatchAsyncAiJob`.
 */
export async function enqueueAsyncAiJob(
  aggregateId: string,
  jobType: AsyncAiJobType,
  payload: AsyncAiJobPayload,
): Promise<void> {
  await getPrismaClient().outboxEvent.create({
    data: {
      aggregateType: "AI",
      aggregateId,
      eventType: jobType,
      payload: payload as any,
    },
  });
}

/**
 * Process pending AI_JOB outbox events.
 * Called from the outbox worker loop in server.ts alongside component events.
 */
export async function processAiJobOutbox(limit = 10): Promise<{
  processed: number;
  failed: number;
}> {
  const prisma = getPrismaClient();
  const events = await prisma.outboxEvent.findMany({
    where: {
      processedAt: null,
      eventType: { startsWith: "AI_JOB." },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let processed = 0;
  let failed = 0;

  for (const event of events) {
    try {
      const result = await dispatchAsyncAiJob(
        event.eventType as AsyncAiJobType,
        (event.payload as AsyncAiJobPayload) ?? {},
      );
      if (result && !result.ok) {
        throw new Error(result.reason);
      }
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date() },
      });
      processed += 1;
    } catch {
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: { retryCount: { increment: 1 } },
      });
      failed += 1;
    }
  }

  return { processed, failed };
}
