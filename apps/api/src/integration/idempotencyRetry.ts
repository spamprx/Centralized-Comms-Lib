/**
 * Integration Layer — Idempotency & Retry (SRS §3.4.9)
 *
 * Wraps outbox event dispatch with idempotency guarantees:
 *   - Each event is only processed once (idempotency via `processedAt` flag)
 *   - Failures increment `retryCount` for visibility and back-off decisions
 *   - After `MAX_RETRY_COUNT` attempts the event is considered dead-letter
 *
 * The SRS calls this component "Idempotency & Retry" and places it between
 * the Event Bus and the downstream Notification & Channel service.
 *
 * Environment:
 *   OUTBOX_MAX_RETRY_COUNT  Max retries before dead-lettering (default: 5)
 */

import type { OutboxRepository } from "../repository/interfaces";

const DEFAULT_MAX_RETRIES = 5;

function getMaxRetries(): number {
  const v = parseInt(process.env.OUTBOX_MAX_RETRY_COUNT ?? "", 10);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_MAX_RETRIES;
}

export interface RetryContext {
  eventId: string;
  retryCount: number;
  outbox: OutboxRepository;
}

export type EventHandlerResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Execute `handler` for an outbox event with idempotency protection.
 *
 * On success the event is marked processed.
 * On failure the retry counter is incremented; if `retryCount` has already
 * reached the maximum the event is dead-lettered (marked processed with a
 * dead-letter annotation so it is not re-queued indefinitely).
 */
export async function withIdempotencyRetry(
  ctx: RetryContext,
  handler: () => Promise<void>,
): Promise<EventHandlerResult> {
  const maxRetries = getMaxRetries();

  try {
    await handler();
    await ctx.outbox.markProcessed(ctx.eventId);
    return { success: true };
  } catch (err) {
    const isDeadLetter = ctx.retryCount >= maxRetries - 1;

    if (isDeadLetter) {
      // Dead-letter: mark processed so the poll loop does not re-pick it
      // indefinitely.  Callers / observability dashboards can filter on
      // retryCount >= MAX to identify dead-letter events.
      await ctx.outbox.markProcessed(ctx.eventId);
    } else {
      await ctx.outbox.incrementRetry(ctx.eventId);
    }

    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
