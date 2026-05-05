# Sprint 4 — Implementation Notes

**Focus:** Channels, Audience & Template Library

**Committed features (21):** F-CHN-001 through F-CHN-010, F-AUD-001 through F-AUD-006, F-TMP-008, F-TMP-009, F-TMP-010, F-TMP-011, F-ADM-003

**Stretch goals (3):** F-AUD-012 (Info Graph), F-AUD-013 (Related Content), F-COL-002 (Shared Space)

---

## What Was Built

### Channel Distribution (F-CHN-001 through F-CHN-010)

**Decision:** A channel is a named configuration record (`Channel` model) with a `type` enum. Actual delivery is handled by channel-specific service adapters. All delivery paths go through the Notify API for Email and WhatsApp; other channels have their own integrations.

**Email channel (F-CHN-001):**
- `emailSend.service.ts → buildNotifyPayload(contentId, channelBinding, recipients)` renders content to HTML using the channel binding's layout config
- `sendToNotify(payload)` POSTs to the Notify API
- `POST /email-send/preview` renders the HTML without sending (for author review)
- Test script: `infra/scripts/test-email-send.sh`

**WhatsApp channel (F-CHN-007) — most complex channel:**
- `whatsappSend.service.ts` handles two concerns:
  1. Content conversion: TipTap JSON → WhatsApp block format (`collectPlaceholderKeysFromBlocks`, `appendAttachmentsFromTipTapDoc`)
  2. Delivery: batch send with per-recipient status tracking
- `WhatsAppSendRequest` persists the full batch request for auditability
- `WhatsAppMessageLog` tracks per-recipient delivery outcome
- `waPlaceholderManifest.ts` maps template variable names to WhatsApp template parameters
- Frontend: `PublishWhatsAppModal.tsx` with recipient upload, preview, and batch send

**Why Notify API for Email and WhatsApp (not direct SMTP/API):** The Notify API abstracts away provider differences (SMTP servers, WhatsApp Business API versions), provides delivery tracking, and handles rate limits and retry at the provider level. This simplifies the Comms-Library code and allows switching providers without code changes.

**Channel config security:** Channel API credentials (Moodle token, Canvas API key) are stored in the `Channel.config` JSON field encrypted at rest. They are never returned in API responses — only used server-side when dispatching.

### Audience Features (F-AUD-001 through F-AUD-006)

**Content reading (F-AUD-001):**
- Redis cache: `content:detail:{id}` stores the rendered content object (JSON)
- Cache is populated on first read; invalidated on `content.service.ts → transitionState` (publish/archive) and on `updateVisibility`
- Object-level auth check performed before cache lookup (cache cannot bypass access control)

**Bookmarks (F-AUD-004):**
- `ContentBookmarkNotification` created when a bookmarked item is republished
- Bookmark notification list paginates via `profile.routes.ts`
- Frontend: notification badge on the bookmarks icon; dismissal marks all as read

**Progress tracking (F-AUD-005):**
- Client-side batching: progress events are collected for 3 seconds then flushed as a single `POST /content/:id/progress` request
- Server-side: upsert on `ContentReadingProgress` — only one record per (content, user) pair
- Dashboard query: `ContentReadingProgress` grouped by `userId`, joining with content title

**AI Summarise (F-AUD-006):**
- Path decision: `body.length < 2000 characters` → Sync AI; else → Async
- Redis caches the summary: key `summary:{contentId}:{length_preset}`; invalidated when content body changes
- Async result stored in `OutboxEvent.metadata.result` (temporary storage until a dedicated job result table is added)

### Asset Management (F-TMP-009)

**Decision:** Two-step upload (presigned PUT → finalize) keeps binary data off the API server entirely.

**Upload flow:**
1. `POST /assets/upload-intent` — `presignPut(bucket, key, expiresInSeconds)` → presigned URL returned
2. Client uploads directly to MinIO via the presigned URL (multipart upload for large files)
3. `POST /assets/:id/finalize` — `headObject` verifies the upload exists; `Asset.status` set to `UPLOADED`

**Asset link integrity scanner:**
- `jobs/assetLinkIntegrityScan.ts` polls for assets with `status = UPLOADED`
- For each asset with a URL reference: `headObject` checks if the file still exists in MinIO; external URLs tested with HTTP HEAD
- `AssetLinkCheck` record written: `VALID | BROKEN | PENDING`
- On broken: `ASSET_LINK_BROKEN` outbox event → admin/author notification
- Scan interval: configurable via `ASSET_LINK_SCAN_INTERVAL_MS`; activated by `ENABLE_ASSET_LINK_SCAN=true`

### Component Library (F-TMP-008)

**Propagation stability:**
- Before Sprint 4, propagation was triggered immediately on component version update (inline during the request)
- Changed to Outbox Pattern: `COMPONENT.VERSION_UPDATED` event is written in the same transaction as the version update; `componentEvents.consumer.ts` processes it asynchronously
- This prevents a single component with 10 000 linked items from blocking the API for seconds

**Frontend component library panel (`ComponentLibraryPanel.tsx`):**
- Searches components via `GET /api/v1/components?q=...&category=...`
- Drag-and-drop using HTML5 drag API into TipTap editor positions
- Insertion mode selection dialog on drop: "Linked (auto-update)" or "Snapshot (static copy)"

### Admin Monitor (F-ADM-003)

**Decision:** Real-time metrics pulled from PostgreSQL aggregation queries, not a separate OLAP database.

**Metrics computed at query time:**
- `SELECT state, COUNT(*) FROM "Content" GROUP BY state` → content by state
- `SELECT COUNT(*) FROM "ReviewAssignment" WHERE status = 'PENDING'` → review queue depth
- `SELECT COUNT(*) FROM "OutboxEvent" WHERE status = 'PENDING'` → outbox queue depth
- `SELECT COUNT(*) FROM "OutboxEvent" WHERE status = 'DEAD_LETTER'` → dead-letter count

These queries are fast on indexed columns. For very large deployments, pre-aggregated materialized views would be added.

**Auto-refresh:** The admin dashboard frontend polls `GET /admin/monitoring/metrics` every 30 seconds using a React `setInterval` with `useEffect` cleanup.

---

## Technical Debt Incurred in Sprint 4

1. **Async AI result storage in `OutboxEvent.metadata`:** Async job results (summaries, AI drafts) are temporarily stored in `OutboxEvent.payload` as they are completed by the AI worker. A dedicated `AiJobResult` table is needed for proper result management, expiry, and retrieval.

2. **WhatsApp recipient CSV validation is minimal:** The recipient import (`waRecipientsImport.ts`) validates phone number format but does not deduplicate across multiple batch sends or check against unsubscribe lists. A proper recipient management system is planned.

3. **Channel credentials stored in JSON field:** `Channel.config` JSON is encrypted at rest but is not structured typed. A more robust approach would use per-channel-type typed config schemas validated at save time.

4. **Nightly vector reindex is not incremental:** The nightly job rebuilds embeddings for all published content, not just items that changed since the last run. Adding a `lastEmbeddedAt` timestamp to the `Content` model would allow incremental updates.
