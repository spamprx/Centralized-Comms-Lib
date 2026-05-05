# Feature Catalog — Admin

All features require the Admin role.

---

## F-ADM-001 — Manage Roles `[Must Have]`

Admins can create, edit, and delete roles with granular permission sets.

**Built-in default roles:** Admin, Author, Reviewer, Audience. These cannot be deleted but can be extended.

**Permissions model:** Each permission is a `(module, action)` pair:
- Modules: `content`, `template`, `review`, `admin`, `analytics`, `channel`, `component`, `asset`
- Actions: `create`, `read`, `update`, `delete`

Role assignment is per-user. Admins can promote or demote users. The business rule engine prevents privilege escalation (an admin cannot grant a role with permissions they do not themselves hold).

**Implementation status:** Fully implemented. `admin.service.ts` handles role CRUD and permission assignment. `admin.routes.ts` exposes `/admin/roles`, `/admin/roles/:id`, `/admin/roles/:id/permissions`, `/admin/permissions/:id`. Protected by `authorize("ADMIN")` middleware.

---

## F-ADM-002 — Manage User Groups `[Must Have]`

Admins organise users into named groups for bulk permission assignment and content visibility targeting.

- Users can belong to multiple groups simultaneously
- Adding a user to a group grants them the group's assigned role instantly
- Removing a user from a group revokes the group role and **invalidates their active session token** in Redis — they must re-authenticate
- Groups support bulk import via CSV. LDAP/SAML directory sync is a planned extension.
- Groups can be used as content visibility targets (see F-AUT-002 `PRIVATE_TO_GROUP`)

**Implementation status:** Fully implemented. `admin.service.ts` handles group CRUD and membership. `UserGroup`, `UserGroupMembership` models in Prisma. Session invalidation on removal via Redis. Bulk CSV import endpoint in `admin.routes.ts`.

---

## F-ADM-003 — Monitor `[Must Have]`

Admins have access to a real-time system dashboard showing content volume, user activity, and pipeline throughput.

**Dashboard metrics include:**
- Active users (last 15 minutes)
- Content count by lifecycle state (Draft / In Review / Published / Archived)
- Pipeline bottlenecks (stages with the most pending items)
- Recent audit events timeline
- Outbox queue depth and dead-letter count

**Implementation status:** Fully implemented. `admin.routes.ts → GET /admin/monitoring/metrics`. Prometheus metrics served at `/metrics` (Prometheus scrape endpoint). `analytics.routes.ts → GET /analytics/kpis` for content KPIs.

---

## F-ADM-004 — Review Policy `[Must Have]`

Admins define rules that govern what review process a piece of content must complete before it can be published.

**Policy dimensions:**
- Content type (article, announcement, template)
- Channel (Email, WhatsApp, etc.)
- User group of the author
- Tags

**Examples:**
- "All content tagged `policy` requires approval from the Legal group"
- "WhatsApp content requires 2 approvals"
- "AI-generated content must always have at least 1 human reviewer"

Policy violations produce clear, actionable error messages; the system blocks the state transition and tells the author exactly which requirement is unmet.

**Implementation status:** Fully implemented. `ReviewPolicy` model in Prisma. `admin.routes.ts → /admin/review-policies`. `businessRules/index.ts → evaluateBusinessRule` applies policies on submission.

---

## F-ADM-005 — Logs `[Must Have]`

The system maintains a comprehensive, immutable audit log of all administrative and content-lifecycle events.

**What is logged:**
- Every content state transition (with actor, timestamp, previous state)
- Every visibility change
- Every role assignment/removal
- Every approval/denial/rollback decision
- Every admin action (policy change, group modification, invalidation)
- AI auto-approval and screening events

**Log properties:**
- Immutable: entries are never modified or deleted
- Retention: configurable, default 2 years
- Filterable: by user, action type, content ID, date range
- Exportable: CSV and JSON formats

**Implementation status:** Fully implemented. `AuditLog` model in Prisma. `admin.routes.ts → GET /admin/logs`, `GET /admin/logs/export`. Token-scrubbing filter applied at the log pipeline level (NFR-SEC-03).

---

## F-ADM-006 — AI — Monitor `[Must Have]`

AI-powered anomaly detection continuously analyses system metrics and raises alerts when unusual patterns are detected.

**Detected anomalies (examples):**
- Sudden spike in content creation rate
- Unusual denial rate (may indicate policy misconfiguration)
- Repeated failed login attempts from an IP range
- Review queue depth growing without assignments being processed

**Alert delivery:** Admin dashboard notification + email (via Notify API). Alerts include a summary of the anomaly and suggested investigation steps. Alerting thresholds are configurable per metric in the admin settings.

**Implementation status:** Wired. Async AI Worker runs the monitoring analysis job. Outbox events drive notification dispatch. Admin configures thresholds via `PATCH /admin/settings`. Full anomaly model training is ongoing.

---

## F-ADM-007 — Setup Pipelines `[Should Have]`

Admins can define custom multi-stage publication pipelines beyond the default Draft → Review → Publish flow.

**Example custom pipeline:** Draft → Self-Review → Legal Review → Editorial Approval → Publish

**Pipeline features:**
- Drag-and-drop stage editor in the admin UI
- Sequential and parallel stages supported
- Each stage has a configurable timeout and escalation rule (e.g. if no action in 48 h → escalate to admin)
- Pipelines are assigned to content types or channels

**Implementation status:** Partially implemented. `workflow/workflow.routes.ts → GET|POST /workflows/policies`, `PATCH|DELETE /policies/:id`. Drag-and-drop pipeline builder UI is a Sprint 5 deliverable.

---

## F-ADM-008 — Invalidation `[Should Have]`

Admins can immediately unpublish content that is outdated, incorrect, or violates policy.

- Invalidated content is hidden from all audience views but retained in the archive
- The author is notified with the invalidation reason
- Bulk invalidation is supported via multi-select
- Invalidation is logged with the admin's identity, reason, and timestamp
- The Search Index removes the item from public results immediately

**Implementation status:** Fully implemented. `admin.routes.ts` handles invalidation. `Content` model has `invalidated` flag. Search index removal triggered via `syncContentIndexFromDb`. Outbox notification dispatched to author.

---

## F-ADM-009 — AI — Analyse `[Should Have]`

AI provides deep analytical insights on content quality, readability scores, and engagement trends.

**Analytics outputs:**
- Readability index per content item (Flesch-Kincaid or similar)
- Average engagement time and drop-off points per section
- Content quality heatmaps across the library
- Schedulable reports: admins configure periodic email delivery of AI analytics summaries

**Implementation status:** Wired. `admin.routes.ts → GET /admin/ai-analytics` routes to `enqueueAsyncAiJob` with `ANALYTICS_REPORT` job type. Report scheduling via admin settings. Full readability model integration is a Sprint 5 deliverable.
