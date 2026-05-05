# Sprint 2 — Implementation Notes

**Focus:** Foundation — Auth, Admin & Core Authoring

**Committed features (14):** F-AUT-001, F-AUT-002, F-AUT-003, F-AUT-004, F-AUT-006, F-ADM-001, F-ADM-002, F-ADM-004, F-ADM-005, F-REV-001, F-REV-002, F-REV-003, F-REV-004, F-REV-005

**Stretch goals (2):** F-AUT-012 (AI Auto Tag), F-REV-010 (AI Content Contradiction)

---

## What Was Built

### Authentication System

**Decision:** JWT-based stateless authentication with HS256 (configurable to RS256 for production).

**Implementation:**
- `POST /api/v1/auth/register` — bcrypt password hashing (`bcryptjs`), JWT issuance
- `POST /api/v1/auth/login` — credential verification, JWT response
- `POST /api/v1/auth/logout` — token invalidation marker set in Redis
- `authenticate` middleware in the Gateway Layer verifies JWT on every protected route

**Why not sessions:** Stateless JWT allows horizontal API scaling without a shared session store. The Redis marker for logout is the only server-side state needed.

### Content Lifecycle (F-AUT-001)

**Decision:** State machine enforced entirely in the Service Layer, not the database.

**Implementation:**
- `Content.state` enum: `DRAFT | IN_REVIEW | PUBLISHED | ARCHIVED`
- `businessRules/index.ts → evaluateBusinessRule('LIFECYCLE_TRANSITION')` validates every transition
- Audit log entry created atomically with every state change (via `withTransaction`)
- Outbox events drive reviewer/author notifications on each transition

**Why not DB constraints:** A database `CHECK` constraint would not allow configurable quorum rules or per-policy exceptions. The Service Layer rule engine is more flexible.

### Visibility Control (F-AUT-002)

**Decision:** Five visibility modes enforced at the Service Layer (object-level auth), not just the UI.

**Implementation:**
- `Content.visibility` enum: `PUBLIC | PRIVATE | HIDDEN | PRIVATE_TO_GROUP | ARCHIVED`
- `checkResourceAccess` in `authorization/index.ts` enforces group visibility by fetching user's group memberships
- Redis cache invalidated on every visibility change
- `PRIVATE_TO_GROUP` requires checking `UserGroupMembership` — the slowest case, but group membership changes are infrequent and cached

**Design consideration:** Hidden content returning 404 (vs 403) was discussed. Decision: return 403 without revealing whether the item exists, consistent with security best practice.

### Tags (F-AUT-003)

**Decision:** Flat tags with optional parent (hierarchical), stored in a shared `Tag` table used by both content and templates.

**Implementation:**
- `Tag` model with optional `parentId` (self-referential FK)
- `ContentTag` join table (no duplicates via `@@id([contentId, tagId])`)
- Elasticsearch `tags` field is a `keyword` array for exact-match faceting
- Tag add/remove triggers an Elasticsearch partial update (not full reindex)

### Co-Authoring (F-AUT-004)

**Decision:** WebSocket-based real-time collaboration with TipTap's built-in collaborative editing extensions.

**Implementation:**
- `server.ts` attaches a WebSocket server to the HTTP server via `realtime/wsServer.ts`
- JWT verified on the WebSocket handshake upgrade
- `ContentCoAuthor` model tracks invitation/acceptance state (persistent)
- TipTap collaborative extensions manage CRDT merge client-side; merged state is persisted on save
- Restore blocked while `ContentCoAuthor` records exist with status `ACCEPTED`

**Tradeoff:** Server-side CRDT (Yjs) was considered for stronger conflict resolution. Decision: use TipTap's built-in extensions for sprint 2; upgrade to Yjs server-side if multi-author conflicts become an issue in practice.

### Role & Group Management (F-ADM-001, F-ADM-002)

**Decision:** RBAC with granular `(module, action)` permissions per role; group-as-role-bundle pattern.

**Implementation:**
- `Role → Permission[]` (one-to-many): each permission is a `{module, action}` pair
- `UserRole` join (user ↔ role direct assignment)
- `UserGroup` carries a `roleId`: all group members inherit the group's role
- `UserGroupMembership` removal → Redis `session:{userId}` key set → token invalidation on next request

**Why group carries a single role:** Multiple roles per group adds combinatorial complexity in permission evaluation. The simpler model (one role per group) is sufficient for the use cases identified. Users can be in multiple groups and hold multiple roles.

### Review Workflow (F-REV-001 through F-REV-005)

**Decision:** `ReviewRequest` → `ReviewAssignment[]` → `ReviewDecision` model hierarchy. Quorum evaluated on every approval.

**Implementation:**
- `ReviewRequest` is created when content is submitted; linked to `Content`
- Each assigned reviewer gets a `ReviewAssignment` record
- `ReviewDecision` is created when the reviewer acts (approve/deny)
- Quorum check in `review.service.ts → decide`: counts `APPROVED` decisions against `ReviewPolicy.quorum`
- Denial short-circuits: first denial immediately reverts content to DRAFT and cancels all other assignments
- Auto-approval (F-REV-005): `runSyncAiTask('FORMAT_VALIDATE')` called on submission if template is eligible; result stored before creating assignments

### AI Draft Creation (F-AUT-006)

**Decision:** Route selection based on prompt length (character count threshold).

**Implementation:**
- Threshold: 500 characters → Sync AI; > 500 → Async AI
- Sync: `runSyncAiTask({ taskType: 'CONTENT_DRAFT_SHORT', payload: { prompt, template } })`
- Async: `enqueueAsyncAiJob({ jobType: 'CONTENT_DRAFT_LONG', payload: { prompt, template, contentId } }, uow)`
- Both paths save the result to a new `ContentVersion`; the async path polls for completion

### Audit Logging (F-ADM-005)

**Decision:** All audit writes go through a single `auditRepository.create` call within the same transaction as the domain write.

**Implementation:**
- `AuditLog` table is append-only (no update/delete in any service code)
- Token scrubbing applied in `logger.ts` before any log line is written
- Admin query endpoint with full filtering: `GET /admin/logs?userId&action&contentId&from&to`
- Export: streams results as CSV/JSON using a cursor

---

## Technical Debt Incurred in Sprint 2

1. **Quorum configuration is per-policy, not per-assignment:** In Sprint 2, quorum is a property of the `ReviewPolicy`. In a later sprint, per-assignment quorum (e.g. "2 of these 5 reviewers") is planned.

2. **AI draft quota counted on enqueue, not on result:** Quota is decremented when the job is queued, not when it completes. This is correct for sync (request consumed immediately) but means failed async jobs still consume quota. A credit-back mechanism for failed jobs is planned.

3. **Co-author presence is tracked by session only:** Offline detection relies on WebSocket disconnect. If a user closes the tab abruptly without a clean disconnect, their presence indicator may persist until the next ping fails. A heartbeat mechanism is planned for Sprint 3.
