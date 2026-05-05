/**
 * Integration Layer — Notification & Channel Service (SRS §3.4.9)
 *
 * Dispatches domain events to the appropriate downstream notification targets.
 * The SRS calls this the "Notification & Channel service" — the component
 * that translates committed outbox events into user-visible notifications,
 * webhooks, or channel-specific delivery actions.
 *
 * Currently supported event types and their dispatch targets:
 *
 *   CONTENT.STATE_CHANGED          → Author / reviewer notification
 *   CONTENT.REVIEWER_ASSIGNED      → Reviewer notification
 *   REVIEW.SUBMITTED               → Author notification
 *   REVIEW.ROLLED_BACK             → Author notification
 *   COMPONENT.VERSION_UPDATED      → Linked content propagation
 *   ASSET.LINK_BROKEN              → Author / admin alert
 *   TEMPLATE.METADATA_CHANGED      → Search index facet refresh
 *   NOTIFICATION.SEND              → Generic channel dispatch
 *
 * Dispatchers are registered in `DISPATCHER_REGISTRY` so new event types
 * can be added without touching the main consumer loop.
 */

import type { OutboxEvent } from "../repository/types";
import { getPrismaClient } from "../repository";

/**
 * Persist a notification record to the AuditLog so it is durably recorded
 * even before a dedicated Notification model is added to the schema.
 * When a `notifications` table is added, swap this helper with a direct
 * `prisma.notification.create` call.
 */
async function persistNotification(data: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  resourceType?: string | null;
  resourceId?: string | null;
}): Promise<void> {
  await getPrismaClient().auditLog.create({
    data: {
      action: `NOTIFICATION:${data.type}`,
      resource: data.resourceType ?? "system",
      resourceId: data.resourceId ?? data.userId,
      actorId: null,
      newValue: {
        userId: data.userId,
        title: data.title,
        body: data.body ?? "",
      } as any,
    },
  });
}

export type DispatchResult =
  | { dispatched: true }
  | { dispatched: false; reason: string };

type EventDispatcher = (event: OutboxEvent) => Promise<DispatchResult>;

// ---------------------------------------------------------------------------
// Dispatcher implementations
// ---------------------------------------------------------------------------

async function dispatchContentStateChanged(
  event: OutboxEvent,
): Promise<DispatchResult> {
  const payload = event.payload as {
    contentId?: string;
    fromState?: string;
    toState?: string;
    actorId?: string;
  } | null;

  if (!payload?.contentId) {
    return { dispatched: false, reason: "Missing contentId in payload" };
  }

  const content = await getPrismaClient().content.findUnique({
    where: { id: payload.contentId },
    select: { authorId: true, title: true },
  });

  if (!content) {
    return { dispatched: false, reason: "Content not found" };
  }

  await persistNotification({
    userId: content.authorId,
    type: "CONTENT_STATE_CHANGED",
    title: `Content "${content.title}" moved to ${payload.toState}`,
    body: `State changed from ${payload.fromState} to ${payload.toState}`,
    resourceType: "content",
    resourceId: payload.contentId,
  });

  return { dispatched: true };
}

async function dispatchReviewerAssigned(
  event: OutboxEvent,
): Promise<DispatchResult> {
  const payload = event.payload as {
    contentId?: string;
    reviewerId?: string;
  } | null;

  if (!payload?.reviewerId || !payload?.contentId) {
    return { dispatched: false, reason: "Missing reviewerId or contentId" };
  }

  await persistNotification({
    userId: payload.reviewerId,
    type: "REVIEW_ASSIGNED",
    title: "You have been assigned as a reviewer",
    body: `You have been asked to review content: ${payload.contentId}`,
    resourceType: "content",
    resourceId: payload.contentId,
  });

  return { dispatched: true };
}

async function dispatchAssetLinkBroken(
  event: OutboxEvent,
): Promise<DispatchResult> {
  const payload = event.payload as {
    assetId?: string;
    url?: string;
    ownerUserId?: string;
  } | null;

  if (!payload?.assetId) {
    return { dispatched: false, reason: "Missing assetId in payload" };
  }

  if (payload.ownerUserId) {
    await persistNotification({
      userId: payload.ownerUserId,
      type: "ASSET_LINK_BROKEN",
      title: "Broken asset link detected",
      body: `Asset link may be broken. Asset ID: ${payload.assetId}`,
      resourceType: "asset",
      resourceId: payload.assetId,
    });
  }

  return { dispatched: true };
}

async function dispatchTemplateMetadataChanged(
  event: OutboxEvent,
): Promise<DispatchResult> {
  // Template metadata changes trigger a search facet refresh via cache epoch bump.
  // The actual bump is handled by the search cache; here we just acknowledge.
  return { dispatched: true };
}

async function dispatchReviewRequestChanged(
  event: OutboxEvent,
): Promise<DispatchResult> {
  const payload = event.payload as {
    contentId?: string;
    requestedById?: string;
  } | null;
  if (!payload?.requestedById) {
    return { dispatched: false, reason: "Missing requestedById in payload" };
  }
  await persistNotification({
    userId: payload.requestedById,
    type: "REVIEW_REQUEST_UPDATED",
    title: "Review request updated",
    body: payload.contentId
      ? `Review request changed for content: ${payload.contentId}`
      : "Review request changed.",
    resourceType: "review_request",
    resourceId: payload.contentId ?? null,
  });
  return { dispatched: true };
}

async function dispatchContentLifecycleEvent(
  event: OutboxEvent,
): Promise<DispatchResult> {
  const payload = event.payload as {
    contentId?: string;
    reason?: string;
  } | null;
  if (!payload?.contentId) {
    return { dispatched: false, reason: "Missing contentId in payload" };
  }
  const content = await getPrismaClient().content.findUnique({
    where: { id: payload.contentId },
    select: { authorId: true, title: true },
  });
  if (!content) return { dispatched: false, reason: "Content not found" };
  await persistNotification({
    userId: content.authorId,
    type: event.eventType,
    title: `Content event: ${event.eventType}`,
    body: `${content.title}`,
    resourceType: "content",
    resourceId: payload.contentId,
  });
  return { dispatched: true };
}

async function dispatchContentBodySaved(_: OutboxEvent): Promise<DispatchResult> {
  return { dispatched: true };
}

async function dispatchGenericNotification(
  event: OutboxEvent,
): Promise<DispatchResult> {
  const payload = event.payload as {
    userId?: string;
    type?: string;
    title?: string;
    body?: string;
    resourceType?: string;
    resourceId?: string;
  } | null;

  if (!payload?.userId || !payload?.title) {
    return {
      dispatched: false,
      reason: "Missing userId or title in NOTIFICATION.SEND payload",
    };
  }

  await persistNotification({
    userId: payload.userId,
    type: payload.type ?? "GENERIC",
    title: payload.title,
    body: payload.body ?? "",
    resourceType: payload.resourceType ?? null,
    resourceId: payload.resourceId ?? null,
  });

  return { dispatched: true };
}

// ---------------------------------------------------------------------------
// Dispatcher registry
// ---------------------------------------------------------------------------

const DISPATCHER_REGISTRY: Record<string, EventDispatcher> = {
  "CONTENT.STATE_CHANGED": dispatchContentStateChanged,
  "CONTENT.REVIEWER_ASSIGNED": dispatchReviewerAssigned,
  "CONTENT.BODY_SAVED": dispatchContentBodySaved,
  "CONTENT.DRAFT": dispatchContentLifecycleEvent,
  "CONTENT.IN_REVIEW": dispatchContentLifecycleEvent,
  "CONTENT.PUBLISHED": dispatchContentLifecycleEvent,
  "CONTENT.ARCHIVED": dispatchContentLifecycleEvent,
  "CONTENT.DENIED": dispatchContentLifecycleEvent,
  "CONTENT.ROLLBACK": dispatchContentLifecycleEvent,
  "CONTENT.COAUTHOR_REQUESTED": dispatchContentLifecycleEvent,
  "CONTENT.COAUTHOR_ACCEPTED": dispatchContentLifecycleEvent,
  "CONTENT.COAUTHOR_REJECTED": dispatchContentLifecycleEvent,
  "REVIEW_REQUEST.CREATED": dispatchReviewRequestChanged,
  "REVIEW_REQUEST.UPDATED": dispatchReviewRequestChanged,
  "REVIEWER.ASSIGNED": dispatchReviewerAssigned,
  "ASSET.LINK_BROKEN": dispatchAssetLinkBroken,
  "TEMPLATE.METADATA_CHANGED": dispatchTemplateMetadataChanged,
  "NOTIFICATION.SEND": dispatchGenericNotification,
};

/**
 * Register a custom notification dispatcher for an event type.
 * Useful for plugging in channel-specific handlers (email, SMS, push).
 */
export function registerNotificationDispatcher(
  eventType: string,
  dispatcher: EventDispatcher,
): void {
  DISPATCHER_REGISTRY[eventType] = dispatcher;
}

/**
 * Dispatch a single outbox event to its registered notification handler.
 * Returns `{ dispatched: false }` for unrecognised event types so the
 * caller can decide whether to treat it as an error or a no-op.
 */
export async function dispatchNotification(
  event: OutboxEvent,
): Promise<DispatchResult> {
  const dispatcher = DISPATCHER_REGISTRY[event.eventType];
  if (!dispatcher) {
    return {
      dispatched: false,
      reason: `No dispatcher registered for event type: ${event.eventType}`,
    };
  }
  return dispatcher(event);
}
