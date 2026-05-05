/**
 * Integration Layer (SRS §3.4.9)
 *
 * Components:
 *   Event Bus (Outbox Writer S5) — publishEvent / publishEventStandalone
 *   Notification & Channel        — dispatchNotification
 *   Idempotency & Retry           — withIdempotencyRetry
 *
 * The Integration Layer is the bridge between the Service Layer's committed
 * domain events and external consumers (notification delivery, channel
 * publishing, AI worker dispatch, search index updates).
 */

export {
  publishEvent,
  publishEventStandalone,
  fetchUnprocessedEvents,
  type PublishEventInput,
  type KnownEventType,
} from "./eventBus";

export {
  dispatchNotification,
  registerNotificationDispatcher,
} from "./notificationDispatcher";

export {
  withIdempotencyRetry,
  type RetryContext,
  type EventHandlerResult,
} from "./idempotencyRetry";
