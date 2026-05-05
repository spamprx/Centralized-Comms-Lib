# API Reference — Admin

**Base path:** `/api/v1/admin`

All endpoints require Admin role (`authorize("ADMIN")` middleware applied at the router level).

---

## Roles

```
GET    /api/v1/admin/roles              ← list all roles
POST   /api/v1/admin/roles              ← create role
GET    /api/v1/admin/roles/:id          ← get role details + permissions
DELETE /api/v1/admin/roles/:id          ← delete role (only if no users assigned)
```

### Role permissions

```
GET    /api/v1/admin/roles/:id/permissions     ← list permissions on role
POST   /api/v1/admin/roles/:id/permissions     ← add permission
DELETE /api/v1/admin/permissions/:id           ← remove a permission
```

**Create role body:**
```json
{
  "name": "string",
  "description": "string",
  "permissions": [
    { "module": "content", "action": "create" },
    { "module": "template", "action": "read" }
  ]
}
```

---

## Users

```
GET    /api/v1/admin/users              ← list users (paginated, filterable)
GET    /api/v1/admin/users/:id          ← get user profile + roles + groups
DELETE /api/v1/admin/users/:id          ← deactivate user
POST   /api/v1/admin/users/:id/reset-password
POST   /api/v1/admin/users/bulk-delete  ← body: { "userIds": ["uuid"] }
PATCH  /api/v1/admin/users/bulk-status  ← body: { "userIds": ["uuid"], "active": false }
```

### User role assignment

```
POST   /api/v1/admin/users/:userId/roles
DELETE /api/v1/admin/users/:userId/roles/:roleId
```

**Assign role body:** `{ "roleId": "uuid" }`

---

## Groups

```
GET    /api/v1/admin/groups             ← list all groups
POST   /api/v1/admin/groups             ← create group
GET    /api/v1/admin/groups/:id         ← group details + members
PATCH  /api/v1/admin/groups/:id         ← update name/description/role
DELETE /api/v1/admin/groups/:id         ← delete group (removes all memberships)
POST   /api/v1/admin/groups/:id/members ← add members; body: { "userIds": ["uuid"] }
DELETE /api/v1/admin/groups/:id/members/:userId ← remove member (revokes role + invalidates session)
POST   /api/v1/admin/groups/import      ← CSV bulk import
```

---

## Review Policies

```
GET    /api/v1/admin/review-policies
POST   /api/v1/admin/review-policies
GET    /api/v1/admin/review-policies/:id
PATCH  /api/v1/admin/review-policies/:id
DELETE /api/v1/admin/review-policies/:id
```

**Create policy body:**
```json
{
  "name": "string",
  "conditions": {
    "contentTypes": ["ARTICLE"],
    "tags": ["legal"],
    "channels": ["EMAIL"],
    "authorGroupIds": ["uuid"]
  },
  "requiredReviewers": {
    "groupIds": ["uuid"],
    "userIds": ["uuid"]
  },
  "quorum": { "type": "ALL | MINIMUM", "count": 2 },
  "autoApprovalEligibleTemplateIds": ["uuid"]
}
```

---

## Monitoring

```
GET /api/v1/admin/monitoring/metrics
```

**Response:**
```json
{
  "activeUsers": 47,
  "contentByState": { "DRAFT": 120, "IN_REVIEW": 18, "PUBLISHED": 840, "ARCHIVED": 203 },
  "reviewQueueDepth": 18,
  "pipelineBottlenecks": [{ "stage": "Legal Review", "pending": 12 }],
  "outboxQueueDepth": 3,
  "deadLetterCount": 0
}
```

---

## Audit Logs

```
GET /api/v1/admin/logs
```

**Query params:** `userId`, `action`, `contentId`, `from`, `to`, `page`, `limit`

```
GET /api/v1/admin/logs/export
```

**Query params:** `format=csv|json`, `userId`, `action`, `from`, `to`

Returns a downloadable file.

---

## Settings

```
GET   /api/v1/admin/settings
PATCH /api/v1/admin/settings
POST  /api/v1/admin/settings/test-email  ← sends a test email via Notify API
```

**Patch settings body (partial):**
```json
{
  "copyAttribution": { "enabled": true },
  "aiQuota": { "requestsPerUserPerDay": 50 },
  "smartRanking": { "semanticWeight": 0.6, "keywordWeight": 0.4 },
  "plagiarism": { "similarityThreshold": 30 },
  "auditLog": { "retentionDays": 730 }
}
```

---

## Content Invalidation

```
POST /api/v1/admin/content/:id/invalidate
```

**Body:** `{ "reason": "string (required)" }`

Immediately hides the content from audience, removes from Elasticsearch, notifies author.

```
POST /api/v1/admin/content/bulk-invalidate
```

**Body:** `{ "contentIds": ["uuid"], "reason": "string" }`

---

## Error Codes

| HTTP Status | Code | Meaning |
|------------|------|---------|
| 403 | `ADMIN_REQUIRED` | Non-admin attempted an admin endpoint |
| 400 | `ROLE_IN_USE` | Cannot delete a role with active user assignments |
| 400 | `PRIVILEGE_ESCALATION` | Cannot grant permissions exceeding caller's own |
| 409 | `GROUP_NAME_CONFLICT` | Group name already exists |
