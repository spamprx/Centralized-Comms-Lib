# Integration Layer

## Purpose

The Integration Layer manages everything that happens **after** the domain write has been committed. It is responsible for:

- Relaying `OutboxEvent` records to the appropriate handlers (notifications, component propagation, AI job dispatch)
- Ensuring at-least-once delivery with idempotency protection
- Managing dead-letter events that have exhausted all retries
- Dispatching notifications to users via the configured channels

The Integration Layer is the implementation of the Transactional Outbox Pattern — the mechanism that guarantees no event is silently lost.

---

## Code Location

```
apps/api/src/integration/
├── eventBus.ts                   ← publishEvent, fetchUnprocessedEvents
├── notificationDispatcher.ts     ← dispatchNotification, registerNotificationDispatcher
├── idempotencyRetry.ts           ← withIdempotencyRetry
└── index.ts                      ← re-exports + layer documentation
```

---

## Event Bus (`eventBus.ts`)

### `publishEvent(eventType, payload, uow)`

Writes an `OutboxEvent` to the database within the caller's active transaction (via `uow`). This is called by service methods whenever they need to trigger downstream effects (notifications, propagation, AI jobs).

```
Service Layer writes:  data change + OutboxEvent  ← atomic transaction
Integration Layer reads: OutboxEvent → routes to handler
```

### `publishEventStandalone(eventType, payload)`

A variant that creates its own transaction. Used by background jobs that do not have an existing Unit of Work context (e.g. the nightly reindex job).

### `fetchUnprocessedEvents(limit)`

Polls the `OutboxEvent` table for events with `status = PENDING`, ordered by creation time (FIFO). Used by the outbox worker and the component events consumer.

### Known Event Types (`KnownEventType`)

| Event type | Triggered by | Handled by |
|-----------|-------------|-----------|
| `REVIEW.SUBMITTED` | Content submitted for review | Reviewer notification |
| `REVIEW.ASSIGNED` | Reviewer manually assigned | Reviewer notification |
| `REVIEW.DECIDED` | Approve or deny decision | Author notification |
| `REVIEW.ROLLED_BACK` | Approval rolled back | Author notification |
| `CONTENT.PUBLISHED` | Content transitions to Published | Bookmark holders notification |
| `CONTENT.INVALIDATED` | Admin invalidates content | Author notification |
| `CONTENT.STATE_CHANGED` | Any lifecycle state change | Audit log (already written in tx) |
| `COMPONENT.VERSION_UPDATED` | Component version published | Linked content propagation |
| `AI_JOB.*` | Any async AI task enqueued | Async AI Worker dispatch |
| `NOTIFICATION:*` | Notification dispatcher | AuditLog-backed notification store |

---

## Notification Dispatcher (`notificationDispatcher.ts`)

### `registerNotificationDispatcher(eventType, handler)`

Allows any module to register a handler function for a specific event type. The notification system is extensible — adding a new notification type requires only registering a new handler, not modifying the dispatcher itself.

### `dispatchNotification(event)`

1. Looks up all registered handlers for `event.eventType`
2. Calls each handler with the event payload
3. Handlers typically:
   - Create a `Notification` record (persisted as `AuditLog` with action `NOTIFICATION:*`)
   - Call the Notify API (email or in-app) via `emailSend.service.ts` or in-app notification store

**Persistence pattern:** Notifications are stored as `AuditLog` rows with a `NOTIFICATION:*` action prefix. This means the audit log serves double duty: compliance audit trail + user notification inbox. This is intentional — every notification sent is automatically auditable.

---

## Idempotency & Retry (`idempotencyRetry.ts`)

### `withIdempotencyRetry(eventId, fn, options)`

Wraps any event processing function with:

1. **Idempotency check:** Before calling `fn`, checks if `event.id` has already been processed successfully. If yes, skips (returns early). This prevents duplicate processing if the outbox worker picks up the same event twice (e.g. after a crash recovery).

2. **Retry logic:** If `fn` throws:
   - Increments `OutboxEvent.retryCount`
   - Waits an exponential backoff period before the next attempt
   - After `MAX_RETRY_COUNT` failures: calls `outboxRepository.deadLetter(eventId)` to move the event to dead-letter status

3. **Dead-letter handling:** Dead-lettered events are never automatically retried. An admin can inspect them via the audit log and trigger manual reprocessing if needed.

**Configuration via environment:**
- `OUTBOX_MAX_RETRIES` (default: 5)
- `OUTBOX_RETRY_BACKOFF_MS` (default: 1000; doubles each attempt)

---

## Component Events Consumer

**File:** `apps/api/src/modules/component/componentEvents.consumer.ts`

A background consumer that processes `COMPONENT.VERSION_UPDATED` events.

### `processComponentAndAssetOutbox()`

Polls `fetchUnprocessedEvents` for component and asset outbox events. For each:

1. **`COMPONENT.VERSION_UPDATED`:** Routes to `handleComponentVersionUpdatedEvent`
2. **Other events:** Routes to `dispatchNotification`

### `handleComponentVersionUpdatedEvent(event)`

1. Fetches all content items that have a linked instance of the updated component
2. For each linked content item: calls `propagateLinkedComponentToContent` (from `componentPropagation.service.ts`)
3. Each propagation updates the content's body with the new component body
4. A new `ContentSnapshot` is appended to record the propagation
5. The content item's `updatedAt` timestamp is bumped → bookmark notification triggered

**Activation:** The component outbox consumer is started by `server.ts` when `ENABLE_OUTBOX_WORKER=true`, running on a configurable polling interval.

---

## Outbox Event Lifecycle

```
Service Layer
    │ withTransaction:
    │   [data write]
    │   [OutboxEvent(status=PENDING)]
    ↓
Event committed to PostgreSQL
    │
    ↓ (polling interval)
Integration Layer: fetchUnprocessedEvents
    │
    ├── withIdempotencyRetry
    │       │
    │       ├─ SUCCESS → markProcessed(event.id)
    │       │
    │       └─ FAILURE
    │              ├─ retry < MAX → incrementRetry, wait backoff
    │              └─ retry = MAX → deadLetter(event.id)
    │
    └── Route to handler:
            COMPONENT.VERSION_UPDATED → componentPropagation
            AI_JOB.*                  → asyncAiWorker dispatch
            NOTIFICATION:*            → notificationDispatcher
            Others                    → notificationDispatcher
```
