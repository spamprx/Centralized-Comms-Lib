/**
 * Integration Layer — Outbox Consumer for Component & Asset events.
 *
 * This consumer polls unprocessed OutboxEvents and routes each one through:
 *   1. A domain-specific handler (e.g. component propagation)
 *   2. The Notification & Channel dispatcher (SRS §3.4.9)
 *   3. The Idempotency & Retry wrapper (marks processed or increments retry)
 *
 * AI_JOB.* events are handled by intelligence/asyncAiWorker.processAiJobOutbox.
 */

import { PrismaUnitOfWork, getPrismaClient } from "../../repository";
import { propagateLinkedComponentToContent } from "./componentPropagation.service";
import {
  dispatchNotification,
  withIdempotencyRetry,
} from "../../integration";
import type { OutboxEvent } from "../../repository/types";

const SYSTEM_ACTOR = {
  actorId: "system",
  isAdmin: true as const,
  ipAddress: "127.0.0.1",
  userAgent: "outbox-worker",
};

export async function handleComponentVersionUpdatedEvent(
  payload: unknown,
): Promise<void> {
  const versionId =
    payload &&
    typeof payload === "object" &&
    typeof (payload as { versionId?: unknown }).versionId === "string"
      ? (payload as { versionId: string }).versionId
      : "";
  if (!versionId) return;
  await propagateLinkedComponentToContent(SYSTEM_ACTOR, versionId);
}

/**
 * Route a single outbox event through its domain handler then the
 * Notification & Channel dispatcher.
 */
async function handleEvent(event: OutboxEvent): Promise<void> {
  // Domain-specific handlers
  if (event.eventType === "COMPONENT.VERSION_UPDATED") {
    await handleComponentVersionUpdatedEvent(event.payload);
    return;
  }

  // All other event types are routed through the notification dispatcher.
  // Unknown types are silently acknowledged (dispatcher returns dispatched:false).
  await dispatchNotification(event);
}

export async function processComponentAndAssetOutbox(limit = 50): Promise<{
  processed: number;
  failed: number;
}> {
  const uow = new PrismaUnitOfWork(getPrismaClient());
  const repos = uow.repos();
  const events = await repos.outbox.listUnprocessed(limit);
  let processed = 0;
  let failed = 0;

  for (const event of events) {
    const result = await withIdempotencyRetry(
      { eventId: event.id, retryCount: event.retryCount, outbox: repos.outbox },
      () => handleEvent(event),
    );

    if (result.success) {
      processed += 1;
    } else {
      failed += 1;
    }
  }

  return { processed, failed };
}
