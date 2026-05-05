# Data Model — Audit Log & Outbox Events

---

## AuditLog

The `AuditLog` table is the immutable, append-only record of every significant system event. It serves two purposes:
1. **Compliance audit trail** — every state change, permission change, and admin action is logged
2. **User notification inbox** — notification records are also stored here using the `NOTIFICATION:*` action prefix

```
AuditLog {
  id         String   @id @default(uuid())
  actorId    String?  (FK → User — null for system-generated events)
  action     String   (e.g. "CONTENT_STATE_CHANGED", "ROLE_ASSIGNED", "NOTIFICATION:REVIEW_ASSIGNED")
  targetType String?  (e.g. "CONTENT", "USER", "ROLE", "GROUP")
  targetId   String?  (UUID of the target entity)
  metadata   Json?    (event-specific details: previousState, newState, reason, etc.)
  ipAddress  String?  (scrubbed to subnet level for privacy)
  userAgent  String?  (scrubbed)
  createdAt  DateTime @default(now())
}
```

### Key Design Constraints

- **Immutable:** No UPDATE or DELETE is ever issued on this table. The application code never modifies existing entries.
- **Append-only:** Only INSERT operations are permitted.
- **Token scrubbing:** JWT tokens and authorization headers are stripped by the log pipeline before any entry is written (NFR-SEC-03). The `ipAddress` is stored at /24 subnet granularity (last octet zeroed) to comply with privacy requirements.
- **Retention:** Configurable via admin settings (`auditLog.retentionDays`, default 730 days). Entries older than the retention window can be exported and purged by a scheduled admin job.

### Standard Action Strings

| Action | Triggered by |
|--------|-------------|
| `CONTENT_CREATED` | Content draft created |
| `CONTENT_STATE_CHANGED` | Any lifecycle state transition |
| `CONTENT_VISIBILITY_CHANGED` | Visibility mode updated |
| `CONTENT_INVALIDATED` | Admin invalidates content |
| `REVIEW_SUBMITTED` | Content submitted for review |
| `REVIEW_ASSIGNED` | Reviewer assigned |
| `REVIEW_DECIDED` | Approve or deny decision |
| `REVIEW_ROLLED_BACK` | Approval rolled back |
| `ROLE_CREATED` | Admin creates a role |
| `ROLE_ASSIGNED` | Role assigned to user |
| `ROLE_REVOKED` | Role removed from user |
| `GROUP_CREATED` | Admin creates a group |
| `GROUP_MEMBER_ADDED` | User added to group |
| `GROUP_MEMBER_REMOVED` | User removed from group |
| `POLICY_CREATED` | Review policy created |
| `AI_AUTO_APPROVED` | Content auto-approved by AI |
| `AI_SCREENING_COMPLETED` | AI pre-screening finished |
| `PIPELINE_RUN` | Author triggers a content pipeline |
| `ASSET_UPLOADED` | Asset finalized after upload |
| `ASSET_LINK_BROKEN` | Broken link detected by scanner |
| `NOTIFICATION:REVIEW_ASSIGNED` | Reviewer notified of assignment |
| `NOTIFICATION:REVIEW_DECIDED` | Author notified of decision |
| `NOTIFICATION:CONTENT_PUBLISHED` | Bookmark holders notified |

### Querying Audit Logs

The admin API exposes filtered, paginated access:

```
GET /api/v1/admin/logs?userId=...&action=...&targetId=...&from=...&to=...
```

Elasticsearch is **not** used for audit log search. All log queries go directly to PostgreSQL. For large deployments with millions of entries, consider adding a read replica for log queries to avoid contention.

---

## OutboxEvent

The `OutboxEvent` table implements the Transactional Outbox Pattern. It is the queue between the Service Layer and the Integration Layer.

```
OutboxEvent {
  id          String   @id @default(uuid())
  eventType   String   (KnownEventType value)
  payload     Json     (event-specific payload)
  status      OutboxStatus  (PENDING | PROCESSED | DEAD_LETTER)
  retryCount  Int      @default(0)
  maxRetries  Int      @default(5)
  processedAt DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### OutboxStatus enum

| Value | Description |
|-------|-------------|
| `PENDING` | Awaiting processing by the outbox worker |
| `PROCESSED` | Successfully handled; notification/propagation dispatched |
| `DEAD_LETTER` | Exhausted all retries; requires admin investigation |

### Outbox Event Flow

```
1. Service Layer writes data + OutboxEvent(PENDING) in same $transaction
2. Outbox worker polls: fetchUnprocessedEvents(limit=50) → ORDER BY createdAt ASC
3. withIdempotencyRetry(event.id, handler):
   a. If already PROCESSED → skip (idempotency protection)
   b. Call handler (notification dispatcher, component propagation, AI job dispatch)
   c. On success → markProcessed(event.id)
   d. On failure → incrementRetry(event.id)
   e. After maxRetries → deadLetter(event.id)
```

### Polling Interval

The outbox worker polls on an interval configured by `OUTBOX_POLL_INTERVAL_MS` (default: 5000ms). This means events are typically processed within 5 seconds of being created.

### Dead-Letter Management

Dead-lettered events appear in the admin monitoring metrics as `deadLetterCount`. Admins can inspect them via the audit log (the dead-letter action is logged). Manual reprocessing is performed by an admin resetting the event status to `PENDING` via a database operation (no UI for this in the current release — it is an ops/admin task).
