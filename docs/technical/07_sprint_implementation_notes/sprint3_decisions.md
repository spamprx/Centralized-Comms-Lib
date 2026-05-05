# Sprint 3 — Implementation Notes

**Focus:** Templates, Search & Authoring+

**Committed features (15):** F-TMP-001 through F-TMP-007, F-SRC-001 through F-SRC-004, F-AUT-005, F-AUT-007, F-AUT-008, F-AUT-011

**Stretch goals (3):** F-REV-011 (AI Comment to Action List), F-TMP-012 (Conditional Render), F-COL-001 (Peer Review)

---

## What Was Built

### Template System (F-TMP-001 through F-TMP-007)

**Decision:** Templates are first-class entities with their own lifecycle (`DRAFT → ACTIVE → DEPRECATED`), separate from content lifecycle.

**Template data model decisions:**

| Design choice | Decision | Rationale |
|--------------|---------|-----------|
| Layout storage | `TemplateLayoutSection[]` (ordered array in PostgreSQL) | Flexible ordered sections; easy to reorder; serialisable to JSON for rendering |
| Formatting rules | Separate `TemplateFormattingRule[]` table | Allows diffing rule changes independently; supports rule deletion without full template update |
| Channel bindings | `TemplateChannelBinding` join table with `layoutConfig` JSON | Each channel gets its own config; adding a channel doesn't require schema migration |
| Translations | `TemplateTranslation` key-value table per locale | Supports any number of languages; missing keys fall back cleanly |
| Clone | Deep copy with new UUID, copy all related records | Independence guarantee; no shared state between original and clone |

**Template activation validation:** `POST /templates/:id/activate` checks:
1. At least one channel binding exists
2. All required fields in layout sections are defined
3. At least one translation set for `defaultLocale`
4. No circular component references in layout sections

**Draft layout saves:** `PATCH /templates/:id/layout/draft` uses an upsert pattern — existing `TemplateLayoutSection` records for this template are deleted and replaced atomically within a transaction. This avoids partial updates and ordering conflicts.

### Search (F-SRC-001 through F-SRC-004)

**Decision:** Elasticsearch for all search queries (not PostgreSQL full-text search). PostgreSQL full-text search (`tsvector`) was considered but rejected because Elasticsearch provides better stemming, synonym support, and dense vector search in a single system.

**Elasticsearch index strategy:**
- Single index `comms-content` for all published content
- Visibility filtering applied as Elasticsearch `filter` (not `query`) — filters don't affect relevance scores
- User group membership resolved server-side → group IDs included in filter for `PRIVATE_TO_GROUP` content

**Redis epoch cache:**
- A single Redis key `search:epoch` holds an integer version counter
- Cache keys include the epoch: `search:{hash(queryParams)}:{epoch}`
- On every content publish/modify: `INCR search:epoch`
- Old cache entries expire naturally (TTL: 5 minutes); effectively invalidated by epoch change

**AI Smart Ranking (F-SRC-004):**
- Query embedding via `embedText(query)` adds ~80–150 ms to the request
- `rankBlend.ts` is a pure function (no I/O); blending is done in memory in < 1 ms
- Admin-configurable weights stored in admin settings, loaded at startup + reloaded on PATCH

### Content Analysis / Analytics (F-AUT-005)

**Decision:** Separate `ContentAnalyticsEvent` table for raw events; computed aggregates served via `analytics.routes.ts` endpoints.

**Implementation:**
- `POST /analytics/track` writes individual events (`VIEW | LIKE | SHARE | COPY | PROGRESS`)
- Aggregate endpoints compute stats from `ContentAnalyticsEvent` with PostgreSQL aggregations
- Export: `GET /analytics/export/csv` streams event data with Prisma cursor pagination (avoids loading all rows into memory)
- `engagementScore` in Elasticsearch is updated on each engagement event (async, non-blocking)

**Why not Elasticsearch for analytics:** Raw event storage in ES was considered. Decision: PostgreSQL is the source of truth for analytics data (ACID guarantees, easier to export for compliance). ES stores only the precomputed `engagementScore` for ranking.

### Reusable Components (F-AUT-007)

**Decision:** Component versioning with a canonical body concept; outbox-driven propagation.

**Implementation:**
- `Component` → `ComponentVersion[]`; only one version has `isCanonical = true`
- Updating the canonical body: write new `ComponentVersion`, set `isCanonical = true`, write `COMPONENT.VERSION_UPDATED` outbox event in same transaction
- `componentEvents.consumer.ts` processes the outbox event → `propagateLinkedComponentToContent` updates all linked items
- Each propagation creates a `ContentSnapshot` with `eventType: COMPONENT_PROPAGATION`

**Linked vs snapshot choice at insertion:** The author selects the mode when inserting a component into content. The choice is stored in `TemplateLayoutSection.insertionMode` (for templates) and in the content body metadata (for content items).

**Circular reference prevention:** `component.routes.ts` validates that a component does not reference itself (directly or transitively) before saving.

### Citations (F-AUT-008)

**Decision:** Lightweight citation model without a full reference database integration.

**Implementation:**
- `ContentCitation` stores the raw citation metadata as JSON (title, authors, year, DOI, etc.)
- `citationKey` is the in-text reference identifier (e.g. "[1]" or "(Smith, 2024)")
- `POST /citations/render` converts raw citation data to a formatted string in the requested format (APA, IEEE, MLA) using a citation formatting library
- Citations are embedded in the TipTap body as custom nodes referencing `ContentCitation.id`

### Version History (F-AUT-011)

**Decision:** Immutable `ContentSnapshot` table; word-level diff computed on demand using the `diff` npm package.

**Implementation:**
- Snapshot trigger points: explicit save, state transition, restore, co-author session end, component propagation
- `compareSnapshotsWordDiff(contentId, fromVersion, toVersion)` fetches two snapshots and runs `diff.diffWords(a, b)` → returns `{ type: 'unchanged' | 'added' | 'removed', text: string }[]`
- Restore: writes the target snapshot's body as a new `ContentVersion`; appends a new `ContentSnapshot` with `eventType: RESTORE`

**Design consideration:** Whether to store snapshots as full copies vs. deltas. Decision: **full copies** (simpler, more reliable retrieval, no risk of delta chain corruption). Storage cost is acceptable — TipTap JSON for typical content is 5–50 KB.

---

## Technical Debt Incurred in Sprint 3

1. **Analytics aggregations are not pre-computed:** Aggregate queries (average reading time, completion rate) run against the raw `ContentAnalyticsEvent` table on every request. For large deployments (millions of events), these queries need to be pre-aggregated on a schedule.

2. **Component propagation is synchronous within the consumer batch:** If a component update affects 10 000 linked content items, the propagation worker processes them sequentially. A parallel batch processing approach is planned.

3. **Citation rendering uses a custom formatter:** Full CSL (Citation Style Language) support is not yet implemented. The current formatter handles APA, IEEE, MLA for common source types (journal, book, webpage) but has gaps for edge cases.

4. **Template activation validation is not schema-based:** Template completeness is checked in service code. A more robust approach would validate against a JSON schema derived from the `TemplateFormattingRule` and layout section config.
