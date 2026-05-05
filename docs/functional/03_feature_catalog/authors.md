# Feature Catalog — Authors

All features described here apply to users with the Author role unless noted otherwise.

---

## F-AUT-001 — State Management `[Must Have]`

Authors can create content and move it through a governed set of lifecycle states.

**States:**

| State | Meaning |
|-------|---------|
| `DRAFT` | Being written; only the author and co-authors can see it |
| `IN_REVIEW` | Submitted; assigned reviewers are notified and can act |
| `PUBLISHED` | Approved and visible to the intended audience |
| `ARCHIVED` | Read-only; removed from active listings but retained for audit |

**Transitions:**

- Draft → In Review: Author clicks "Submit for Review"; requires at least one reviewer assigned
- In Review → Published: All required reviewers approve (quorum policy applies)
- In Review → Draft: A reviewer denies the submission
- Published → Archived: Author or Admin archives the item; search index de-lists it
- Published → In Review (Rollback): Reviewer or Admin rolls back an approval

Every state change is recorded in the audit log with timestamp, actor identity, and previous state. Invalid transitions (e.g. Draft → Published directly) are rejected by the business rule engine with a descriptive error.

**Implementation status:** Fully implemented. `content.service.ts → transitionState` and `businessRules/index.ts` enforce the state machine. Outbox events notify reviewers and authors on each transition.

---

## F-AUT-002 — Visibility Control `[Must Have]`

Authors control who can see their content, independent of where it is in the lifecycle.

**Visibility modes:**

| Mode | Who can access |
|------|---------------|
| `PUBLIC` | Any authenticated audience member |
| `PRIVATE` | Author(s) and assigned reviewers only |
| `HIDDEN` | Only accessible via a direct known URL; excluded from all search results and listings |
| `ARCHIVED` | Read-only; audience cannot access; admin and author can |
| `PRIVATE_TO_GROUP` | Only members of one or more designated user groups |

A piece of content can be `PUBLISHED` (state) and `PRIVATE_TO_GROUP` (visibility) at the same time — approved but targeted at a specific group. Visibility enforcement happens at the Object-Level Authorisation layer in the Service Layer, not only in the UI. Attempting to access out-of-scope content returns a 403 without exposing the item's existence. Redis cache is invalidated on every visibility change.

**Implementation status:** Fully implemented. Visibility modes are stored on the `Content` model. `authorization/index.ts → checkResourceAccess` enforces group visibility. Redis cache invalidation runs on `updateVisibility`.

---

## F-AUT-003 — Tags `[Must Have]`

Authors can attach, edit, and remove tags to organise content and make it discoverable.

- Tag names are drawn from a shared platform taxonomy (same tags used for templates)
- Tags support hierarchical grouping (parent/child relationships)
- Elasticsearch facets are refreshed immediately on tag add/remove
- Auto-suggest of existing tags is provided in the editor; new tags can also be created inline

**Implementation status:** Fully implemented. `tag.service.ts` handles CRUD. `content.service.ts → assignTag / removeTag` links tags to content. `ContentTag` join table in Prisma schema. Search index includes tags as keyword facets.

---

## F-AUT-004 — Co-authoring `[Must Have]`

Multiple authors can edit the same content simultaneously. Conflicts are resolved automatically using CRDT/OT semantics.

- Up to 10 concurrent authors per document (per requirement; the system uses WebSocket sessions)
- Each author's cursor position and selection are visible to all participants in real time
- Changes are merged and broadcast to all participants; the merged state is persisted to the Content Repository
- A restore operation is blocked while a co-author session is active to prevent conflicts

**Implementation status:** Implemented. WebSocket server is wired in `server.ts` via `./realtime/wsServer`. Co-author invite/respond flows exist in `content.service.ts` (`requestCoAuthor`, `respondToCoAuthorRequest`). `ContentCoAuthor` model tracks participants.

---

## F-AUT-005 — Analysis `[Must Have]`

Authors can view engagement analytics for their published content.

**Tracked metrics:**

- Total views and unique readers
- Average reading time and completion rates
- Reaction counts (by type) and like count
- Share events

Authors can filter by date range. Analytics data is exportable as CSV. The `ContentAnalyticsEvent` model stores individual events; aggregated KPIs are computed via the analytics routes.

**Implementation status:** Fully implemented. `analytics.routes.ts` exposes `/api/v1/analytics/content/:contentId/metrics`, `/kpis`, `/views`, `/engagement`, `/reading-time`, `/top-content`, `/export/csv`. Events tracked via `POST /analytics/track`.

---

## F-AUT-006 — AI — Create Drafts `[Must Have]`

Authors provide a topic, prompt, or outline. The AI returns a fully editable first draft.

- Short prompts route to the Sync AI (fast path, < 2 s typical)
- Long-form generation (detailed outlines, multi-section content) routes to the Async AI Worker
- Generated content carries an `AI_GENERATED` metadata flag
- Authors can regenerate or refine sections iteratively without losing their previous draft
- AI quota enforcement at the Gateway Layer prevents overuse

**Implementation status:** Implemented. `intelligence/syncAi.ts → runSyncAiTask` and `intelligence/asyncAiWorker.ts → enqueueAsyncAiJob` are the two paths. `content.service.ts` calls the appropriate path based on prompt complexity. Circuit breakers (`shared/circuitBreaker/index.ts`) wrap both calls.

---

## F-AUT-007 — Reusable Component Creation `[Should Have]`

Authors can save any block or section of content as a named reusable component, stored in the component library.

- **Linked mode:** The component is embedded as a live reference. When the component's canonical body is updated, all linked content items receive the updated version automatically (via outbox propagation).
- **Snapshot mode:** A static copy is taken at insertion time. Updates to the component do not affect existing snapshots.
- Components are versioned (`ComponentVersion`). Each version has its own TipTap JSON body.
- The component library is searchable and categorised by `ComponentCategory`.

**Implementation status:** Fully implemented. `component/component.routes.ts` exposes component CRUD and versioning. `componentPropagation.service.ts` handles linked propagation. `componentEvents.consumer.ts` processes `COMPONENT.VERSION_UPDATED` outbox events and drives `propagateLinkedComponentToContent`.

---

## F-AUT-008 — Citations & References `[Should Have]`

Authors can insert inline citations and maintain a reference list.

- Supported formats: APA, IEEE, MLA
- Search dialog within the editor queries the Search Index for existing references
- Citations are rendered inline and appended to a bibliography section
- `ContentCitation` model persists all citation links per content item

**Implementation status:** Implemented. `citation/citation.routes.ts → POST /citations/render` handles citation rendering. `ContentCitation` in schema. Frontend `citationService` calls the API.

---

## F-AUT-009 — AI — Update Old Templates / Drafts `[Should Have]`

AI reviews a legacy document and suggests edits to bring it in line with current language, data, or standards.

- Uses the Async AI Worker (long-running job) with semantic comparison via the Vector Store
- Suggestions are presented as tracked changes — none are applied automatically
- Authors can accept or reject individual suggestions before persisting

**Implementation status:** Wired via `workflow/workflow.routes.ts → POST /pipeline-run` which calls `enqueueAsyncAiJob`. Full tracked-changes UI is a Sprint 5 deliverable.

---

## F-AUT-010 — AI — Content Pipeline `[Should Have]`

Admins configure multi-step automated content preparation pipelines (grammar, formatting, compliance scan, scheduling). Authors can trigger a pipeline run on their draft.

- Steps are ordered and configurable: lightweight checks route to Sync AI, deep analysis to Async AI Worker
- Each step produces a pass/fail result with actionable feedback
- A summary report is displayed after pipeline completion; results are logged to the audit store

**Implementation status:** Partially implemented. `workflow/workflow.routes.ts` exposes pipeline policy CRUD and `POST /pipeline-run`. `enqueueAsyncAiJob` dispatches the job. Full step-by-step result aggregation is in progress.

---

## F-AUT-011 — History `[Should Have]`

The system maintains an immutable version history of every content item.

- A snapshot is created on every explicit save and on every lifecycle state transition
- Snapshots record: version number, actor identity, timestamp, triggering event type
- Authors can browse, preview, and compare any two versions side-by-side (word-level diff)
- Restoring a snapshot appends a new history entry; prior history is never truncated
- Restore is blocked while a co-author session is active

**Implementation status:** Fully implemented. `ContentSnapshot` model in Prisma. `content.service.ts → listVersions`, `compareSnapshotsWordDiff` (uses `diff` npm package). Version restore endpoint in `content.routes.ts`.

---

## F-AUT-012 — AI — Auto Tag `[Nice to Have]`

The AI analyses completed content and suggests relevant tags from the existing taxonomy. Suggestions are shown for author review before application; nothing is applied silently.

**Implementation status:** Stretch goal (Sprint 2). Not yet implemented as a standalone feature. Auto-tag capability is expected to be wired through the `enqueueAsyncAiJob` path with a `TAG_SUGGESTION` job type.
