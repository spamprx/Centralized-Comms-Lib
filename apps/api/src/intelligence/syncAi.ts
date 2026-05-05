/**
 * Intelligence Layer — Sync AI (Fast Path) (SRS §3.4.7 I1)
 *
 * Handles short, latency-sensitive AI requests inline:
 *   - Text embedding generation
 *   - Content summarisation
 *   - Format validation
 *   - RAG answer generation
 *   - Smart search ranking
 *
 * All calls go through `withCircuitBreaker` (S6) so a flapping embedding
 * service does not cascade into regular API latency.
 *
 * Environment:
 *   EMBEDDING_SERVICE_URL   Base URL for the embedding/AI inference service
 *   EMBEDDING_SERVICE_PATH  Path for the embed endpoint (default: /embed)
 *   AI_SERVICE_TIMEOUT_MS   Per-request timeout in ms (default: 8000)
 */

import { withCircuitBreaker } from "../shared/circuitBreaker";

const DEFAULT_TIMEOUT_MS = 8_000;

function getAiBase(): string | null {
  return process.env.EMBEDDING_SERVICE_URL?.trim() || null;
}

function getTimeoutMs(): number {
  const t = parseInt(process.env.AI_SERVICE_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(t) && t > 0 ? t : DEFAULT_TIMEOUT_MS;
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

export type EmbedResult =
  | { ok: true; embedding: number[] }
  | { ok: false; reason: string };

/**
 * Generate a vector embedding for the given text.
 * Returns null when the embedding service is not configured.
 */
export async function embedText(text: string): Promise<EmbedResult | null> {
  const base = getAiBase();
  if (!base) return null;

  const path = process.env.EMBEDDING_SERVICE_PATH?.trim() || "/embed";
  const url = `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

  return withCircuitBreaker("sync-ai:embed", async () => {
    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.slice(0, 8_000) }),
        },
        getTimeoutMs(),
      );
      if (!res.ok) {
        return { ok: false as const, reason: `HTTP ${res.status}` };
      }
      const data = (await res.json()) as { embedding?: number[] };
      if (!Array.isArray(data.embedding)) {
        return { ok: false as const, reason: "Invalid embedding response" };
      }
      return { ok: true as const, embedding: data.embedding };
    } catch (err) {
      return {
        ok: false as const,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  });
}

export type SyncAiTask =
  | { type: "summarize"; text: string; maxWords?: number }
  | { type: "format_validate"; content: string; rules: string[] }
  | { type: "rag_answer"; question: string; context: string[] }
  | { type: "rank"; query: string; candidates: string[] };

export type SyncAiResult =
  | { ok: true; output: string }
  | { ok: false; reason: string };

/**
 * Run a short synchronous AI task through the fast-path inference service.
 * Returns null when the AI service is not configured.
 *
 * The endpoint is expected at `EMBEDDING_SERVICE_URL/ai/task` and must accept:
 *   POST { task: SyncAiTask }  →  { output: string }
 */
export async function runSyncAiTask(
  task: SyncAiTask,
): Promise<SyncAiResult | null> {
  const base = getAiBase();
  if (!base) return null;

  const url = `${base.replace(/\/$/, "")}/ai/task`;

  return withCircuitBreaker(`sync-ai:${task.type}`, async () => {
    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task }),
        },
        getTimeoutMs(),
      );
      if (!res.ok) {
        return { ok: false as const, reason: `HTTP ${res.status}` };
      }
      const data = (await res.json()) as { output?: string };
      if (typeof data.output !== "string") {
        return { ok: false as const, reason: "Missing output field" };
      }
      return { ok: true as const, output: data.output };
    } catch (err) {
      return {
        ok: false as const,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  });
}
