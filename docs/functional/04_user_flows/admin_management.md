# User Flow — Admin Management

This document describes the key administrative workflows: setting up roles and groups, configuring review policies, monitoring the system, and maintaining the audit log.

---

## Role & Permission Management

### Creating a New Role

1. Admin navigates to **Admin → Roles**
2. Clicks "Create Role"; enters name and description
3. Selects permissions from the permission matrix (`module × action`):
   - Modules: `content`, `template`, `review`, `admin`, `analytics`, `channel`, `component`, `asset`
   - Actions: `create`, `read`, `update`, `delete`
4. Saves the role — `Role` and `Permission` records created in PostgreSQL
5. Audit log entry: `ROLE_CREATED`

### Assigning a Role to a User

1. Admin opens **Admin → Users**; searches for the user
2. Clicks "Assign Role" → selects from available roles
3. `UserRole` record created
4. The user's session is not invalidated (role additions are additive)
5. Audit log entry: `ROLE_ASSIGNED`

### Revoking a Role

1. Admin opens the user's role list; clicks "Remove" on the role to revoke
2. `UserRole` record deleted
3. User's active session token is **invalidated in Redis** — they must re-authenticate
4. Audit log entry: `ROLE_REVOKED`

---

## Group Management

### Creating a Group

1. Admin opens **Admin → Groups**; clicks "Create Group"
2. Enters group name, description, and assigns a role (all members inherit this role)
3. Optionally adds initial members from the user directory
4. Bulk import: upload a CSV of user IDs or emails → `POST /admin/users/bulk-import`
5. `UserGroup` and `UserGroupMembership` records created

### Adding / Removing Members

**Add:**
- Search for users; add to group → `UserGroupMembership` created → role granted immediately

**Remove:**
- Select member; click "Remove" → `UserGroupMembership` deleted → role revoked → session token invalidated in Redis

### Group as Visibility Target

- When an author sets content visibility to `PRIVATE_TO_GROUP`, they pick from the groups list
- Only members of the selected group(s) can see the content
- Group membership changes are immediately reflected in content access

---

## Review Policy Configuration

### Creating a Policy

1. Admin opens **Admin → Review Policies**; clicks "New Policy"
2. Configures:
   - **Trigger conditions:** content type, channel, author group, tags
   - **Required reviewers:** specific users, groups, or roles
   - **Quorum rule:** "all must approve" or "N of M"
   - **Auto-approval eligibility:** select template IDs that bypass human review
3. Saves policy — `ReviewPolicy` record created
4. Policy is active immediately; all new submissions are evaluated against all active policies

### Policy in Action

1. Author submits content matching a policy rule
2. Business Rule Enforcement evaluates all active policies in order
3. Matching reviewers are auto-assigned; notifications dispatched
4. If the author tries to publish without satisfying the policy, the system blocks the transition with a specific error message

### Modifying or Disabling a Policy

1. Admin edits the policy via `PATCH /admin/review-policies/:id`
2. Existing `IN_REVIEW` content already assigned is not affected by policy changes mid-review
3. Disabling a policy (`active: false`) stops it from being evaluated on new submissions

---

## Pipeline Setup

1. Admin opens **Admin → Pipelines**
2. Drag-and-drop stage builder displays available stage types: Review Stage, Legal Stage, Editorial Stage, Publish Stage, etc.
3. Admin arranges stages in sequence (or sets parallel tracks)
4. Configures per-stage:
   - Assigned role or group (who handles this stage)
   - Timeout duration (e.g. 48 hours)
   - Escalation rule (e.g. if no action → notify admin)
5. Assigns the pipeline to a content type or channel
6. `workflow/workflow.routes.ts` persists the configuration

---

## Content Invalidation

1. Admin identifies published content that needs emergency removal (incorrect information, policy violation)
2. Navigates to the content item; clicks "Invalidate"
3. Provides a mandatory reason
4. System:
   - Sets `invalidated: true` on the `Content` record
   - Removes the item from the Elasticsearch index immediately
   - Sends `CONTENT.INVALIDATED` outbox event → author notified with reason
   - Audit log records the action
5. Invalidated content is hidden from all audience views but retained for audit purposes
6. Bulk invalidation: multi-select content items → single invalidation action

---

## Monitoring Dashboard

1. Admin opens **Admin → Monitor** (`GET /admin/monitoring/metrics`)
2. Dashboard displays:
   - Active users in the last 15 minutes
   - Content counts per lifecycle state
   - Review queue depth (pending assignments)
   - Pipeline stage bottlenecks
   - Top error types in the last hour
3. Real-time updates; page auto-refreshes
4. AI anomaly alerts appear as banners when thresholds are crossed (configured in admin settings)

---

## Audit Log Viewer

1. Admin opens **Admin → Logs**
2. Applies filters: user ID, action type, content ID, date range
3. Results display in reverse chronological order with full event details
4. Export as CSV or JSON: `GET /admin/logs/export?format=csv&from=...&to=...`
5. Exported files can be forwarded to compliance or legal teams

---

## System Settings

Admins can configure system-wide settings via `PATCH /admin/settings`:

| Setting | Description |
|---------|-------------|
| `copyAttribution.enabled` | Whether copied text includes attribution by default |
| `aiQuota.requestsPerUserPerDay` | Per-user AI request limit |
| `aiMonitor.anomalyThreshold.*` | Per-metric anomaly alert thresholds |
| `smartRanking.semanticWeight` | Weight of vector similarity in search ranking (0–1) |
| `smartRanking.keywordWeight` | Weight of BM25 keyword score (0–1) |
| `auditLog.retentionDays` | Days to retain audit log entries |
| `plagiarism.similarityThreshold` | Similarity percentage that triggers a plagiarism flag |

Settings changes are audit-logged. Changed values take effect immediately without server restart.
