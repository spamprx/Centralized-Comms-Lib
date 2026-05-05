# API Reference — Reviewers

**Base path:** `/api/v1/reviews`

All endpoints require authentication. Reviewer-specific operations additionally require the caller to be an assigned reviewer for the relevant review assignment (enforced by Object-Level Authorisation).

---

## Create Review Request

```
POST /api/v1/reviews/requests
```

**Body:**
```json
{
  "contentId": "uuid",
  "message": "string (optional)"
}
```

Creates a `ReviewRequest` for the content item. Must be called by the content's author.

**Response 201:**
```json
{
  "id": "uuid",
  "contentId": "uuid",
  "status": "OPEN",
  "createdAt": "ISO8601"
}
```

---

## Get Review Request

```
GET /api/v1/reviews/requests/:id
```

Returns the review request with all associated assignments and decisions.

---

## List Assignable Reviewers

```
GET /api/v1/reviews/content/:contentId/assignable-reviewers
```

Returns users who have the Reviewer role and can be assigned to this content item.

---

## List Review Requests for Content

```
GET /api/v1/reviews/content/:contentId
```

Returns all `ReviewRequest` records for the given content item (history of review rounds).

---

## Assign Reviewer

```
POST /api/v1/reviews/requests/:id/assign
```

**Body:**
```json
{
  "reviewerId": "uuid"
}
```

Creates a `ReviewAssignment`. Dispatches `REVIEW.ASSIGNED` outbox event → reviewer notification.

---

## Make Decision (Approve or Deny)

```
POST /api/v1/reviews/assignments/:id/decide
```

**Body:**
```json
{
  "decision": "APPROVED | DENIED",
  "comment": "string (required)"
}
```

Creates a `ReviewDecision`. On approval: checks quorum; transitions content to `PUBLISHED` if met. On denial: transitions content to `DRAFT`; cancels all pending assignments.

**Response 200:**
```json
{
  "assignmentId": "uuid",
  "decision": "APPROVED",
  "quorumMet": true,
  "contentState": "PUBLISHED"
}
```

---

## Rollback Approval

```
POST /api/v1/reviews/assignments/:id/rollback
```

**Body:**
```json
{
  "justification": "string (required)"
}
```

Reverts a previously submitted approval. If the content was `PUBLISHED`, it transitions back to `IN_REVIEW`. Dispatches `REVIEW.ROLLED_BACK` outbox event.

---

## Add Comment

```
POST /api/v1/reviews/assignments/:id/comment
```

**Body:**
```json
{
  "text": "string (rich text)",
  "anchorStart": 100,
  "anchorEnd": 150,
  "threadId": "uuid (optional — omit to start a new thread)"
}
```

Creates a `ReviewComment`. Anchored comments include character offsets into the content body.

---

## List User Display Names

```
POST /api/v1/reviews/users/display-names
```

**Body:** `{ "userIds": ["uuid"] }`

Returns display names for a list of user IDs. Used by the frontend to resolve reviewer names in the review panel.

---

## My Assignments

```
GET /api/v1/reviews/my-assignments
```

Returns all `ReviewAssignment` records assigned to the authenticated user, with content summary and current status.

**Response:**
```json
[
  {
    "assignmentId": "uuid",
    "contentId": "uuid",
    "contentTitle": "string",
    "contentState": "IN_REVIEW",
    "assignmentStatus": "PENDING",
    "assignedAt": "ISO8601"
  }
]
```

---

## Assignment Status Values

| Status | Meaning |
|--------|---------|
| `PENDING` | Waiting for reviewer action |
| `APPROVED` | Reviewer approved; awaiting quorum if applicable |
| `DENIED` | Reviewer denied; content returned to DRAFT |
| `CANCELLED` | Assignment cancelled (e.g. content denied by another reviewer) |
| `ROLLED_BACK` | Previously approved; now rolled back |

---

## Error Codes

| HTTP Status | Code | Meaning |
|------------|------|---------|
| 400 | `DECISION_ALREADY_MADE` | Assignment already has a final decision |
| 400 | `COMMENT_REQUIRED` | Approve/Deny submitted without a comment |
| 400 | `JUSTIFICATION_REQUIRED` | Rollback submitted without justification |
| 403 | `NOT_ASSIGNED_REVIEWER` | Caller is not an assigned reviewer for this assignment |
| 404 | `REQUEST_NOT_FOUND` | Review request not found |
