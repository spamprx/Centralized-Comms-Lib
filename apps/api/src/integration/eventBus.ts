/**
 * Integration Layer — Event Bus / Outbox Writer (SRS §3.4.9, S5)
 *
 * Provides the "Outbox Writer" (S5) described in the SRS Service Layer and
 * the "Event Bus" abstraction in the Integration Layer.
 *
 * Domain services commit data changes and domain events atomically by calling
 * `publishEvent` inside a UnitOfWork transaction.  The Integration Layer
 * worker then polls unprocessed events and dispatches them to downstream
 * handlers (Notification & Channel, AI jobs, search index updates).
 *
 * This centralises all outbox writes so:
 *   - Event schema is enforced in one place
 *   - No service bypasses the outbox directly
 *   - Metrics and tracing can be applied at a single choke-point
 */

import type { OutboxRepository } from "../repository/interfaces";
import type { OutboxEventInput, OutboxEvent } from "../repository/types";
import { getPrismaClient, PrismaUnitOfWork } from "../repository";

export type { OutboxEventInput, OutboxEvent };

/**
 * Known event types across the system.
 * Extending this union keeps event naming consistent.
 */
export type KnownEventType =
  | "CONTENT.BODY_SAVED"
  | "CONTENT.STATE_CHANGED"
  | "CONTENT.VISIBILITY_CHANGED"
  | "CONTENT.TAG_UPDATED"
  | "CONTENT.REVIEWER_ASSIGNED"
  | "COMPONENT.VERSION_UPDATED"
  | "ASSET.LINK_BROKEN"
  | "TEMPLATE.METADATA_CHANGED"
  | "REVIEW.SUBMITTED"
  | "REVIEW.ROLLED_BACK"
  | "NOTIFICATION.SEND"
  | (string & {}); // allow freeform while keeping autocomplete for known types

export interface PublishEventInput {
  aggregateType: string;
  aggregateId: string;
  eventType: KnownEventType;
  payload: unknown;
}

/**
 * Publish a domain event via an existing `OutboxRepository` instance.
 * Call this inside a UnitOfWork transaction so the event is committed
 * atomically with the data change (Transactional Outbox Pattern).
 *
 * @example
 * await uow.withTransaction(async (repos) => {
 *   await repos.content.updateLifecycleState(id, "PUBLISHED");
 *   await publishEvent(repos.outbox, { ... });
 * });
 */
export async function publishEvent(
  outbox: OutboxRepository,
  input: PublishEventInput,
): Promise<OutboxEvent> {
  return outbox.add({
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    eventType: input.eventType,
    payload: input.payload,
  });
}

/**
 * Convenience: publish an event outside of an explicit transaction using the
 * singleton Prisma client.  Use when the calling code has already committed
 * its primary write and only needs to enqueue a notification.
 */
export async function publishEventStandalone(
  input: PublishEventInput,
): Promise<OutboxEvent> {
  const uow = new PrismaUnitOfWork(getPrismaClient());
  const repos = uow.repos();
  return publishEvent(repos.outbox, input);
}

/**
 * Fetch a batch of unprocessed events for the Integration Layer worker.
 * Ordered by `createdAt` ascending to guarantee FIFO within each aggregate.
 */
export async function fetchUnprocessedEvents(
  limit = 50,
): Promise<OutboxEvent[]> {
  const uow = new PrismaUnitOfWork(getPrismaClient());
  return uow.repos().outbox.listUnprocessed(limit);
}
