# API Reference — Authors (Content CRUD & State Transitions)

**Base path:** `/api/v1/content`

All endpoints require authentication (`Authorization: Bearer <token>`). Content-specific operations additionally require the caller to own the content or have co-author/admin access (enforced by Object-Level Authorisation).

---

## Create Content

```
POST /api/v1/content
```

**Body:**
```json
{
  "templateId": "uuid",
  "title": "string",
  "visibility": "PRIVATE | PUBLIC | HIDDEN | PRIVATE_TO_GROUP",
  "groupIds": ["uuid"]
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "title": "string",
  "state": "DRAFT",
  "visibility": "PRIVATE",
  "createdAt": "ISO8601"
}
```

---

## List Content (Workspace)

```
GET /api/v1/content/workspace
```

Returns all content items the authenticated user is an author or co-author of, including drafts.

**Query params:** `state`, `visibility`, `templateId`, `tags`, `page`, `limit`

---

## Get Content by ID

```
GET /api/v1/content/:id
```

Returns the content item if the caller has visibility access. Reads from Redis cache first (cache key: `content:detail:{id}`).

---

## Save Body

```
POST /api/v1/content/:id
```

Persists the TipTap JSON body. Creates a `ContentSnapshot` for the version history.

**Body:**
```json
{
  "body": { /* TipTap JSON document */ },
  "title": "string (optional)"
}
```

---

## Update Title

```
PATCH /api/v1/content/:id/title
```

**Body:** `{ "title": "string" }`

---

## State Transitions

```
POST /api/v1/content/:id/submit-for-review
POST /api/v1/content/:id/publish
POST /api/v1/content/:id/archive
POST /api/v1/content/:id/revert-to-draft
```

Each transition is validated by `evaluateBusinessRule`. Invalid transitions return 400 with a descriptive reason. State changes are logged to the audit log and trigger outbox notifications.

**Response 200:**
```json
{
  "id": "uuid",
  "state": "IN_REVIEW",
  "transitionedAt": "ISO8601"
}
```

---

## Update Visibility

```
PATCH /api/v1/content/:id/visibility
```

**Body:**
```json
{
  "visibility": "PUBLIC | PRIVATE | HIDDEN | PRIVATE_TO_GROUP",
  "groupIds": ["uuid"]
}
```

Invalidates Redis cache. Updates Elasticsearch discoverability. Audit logged.

---

## Assign / Remove Tag

```
POST   /api/v1/content/:id/tags
DELETE /api/v1/content/:id/tags/:tagId
```

**Body (POST):** `{ "tagId": "uuid" }`

---

## Version History

```
GET /api/v1/content/:id/versions
```

Returns the list of all `ContentSnapshot` records for this content item.

**Response:**
```json
[
  {
    "version": 1,
    "actorId": "uuid",
    "actorName": "string",
    "timestamp": "ISO8601",
    "eventType": "SAVE | STATE_TRANSITION"
  }
]
```

---

## Get Snapshot

```
GET /api/v1/content/:id/versions/:version
```

Returns the full TipTap JSON body for a specific snapshot version (read-only preview).

---

## Compare Snapshots (Word Diff)

```
POST /api/v1/content/:id/versions/compare
```

**Body:** `{ "fromVersion": 1, "toVersion": 3 }`

**Response:**
```json
{
  "diff": [
    { "type": "unchanged", "text": "The policy " },
    { "type": "removed", "text": "must be" },
    { "type": "added", "text": "shall be" },
    { "type": "unchanged", "text": " followed." }
  ]
}
```

---

## Restore Version

```
POST /api/v1/content/:id/restore/:version
```

Restores the specified snapshot as the new working draft. Appends a new version entry (`RESTORE` event type). Blocked if an active co-author session is open.

---

## Co-Authoring

```
POST /api/v1/content/:id/co-authors/invite
POST /api/v1/content/:id/co-authors/invite-by-email
GET  /api/v1/content/:id/co-authors/pending-invitations
POST /api/v1/content/:id/co-authors/respond
```

---

## Analytics Events

```
POST /api/v1/content/:id/view        ← record a view event
POST /api/v1/content/:id/like        ← toggle like
POST /api/v1/content/:id/react       ← add/change reaction
POST /api/v1/content/:id/progress    ← update reading progress
POST /api/v1/content/:id/comments    ← post a public comment
GET  /api/v1/content/:id/comments    ← list comment threads
```

---

## Bookmarks

```
POST   /api/v1/profile/bookmarks            ← add bookmark
DELETE /api/v1/profile/bookmarks/:id        ← remove bookmark
GET    /api/v1/profile/bookmarks            ← list all bookmarks
GET    /api/v1/profile/bookmark-folders     ← list folders
POST   /api/v1/profile/bookmark-folders     ← create folder
```

---

## Annotations (Private Notes)

```
POST   /api/v1/content/:id/annotations
GET    /api/v1/content/:id/annotations
DELETE /api/v1/content/:id/annotations/:annotationId
```

---

## Soft Delete

```
POST /api/v1/content/:id/delete
```

Marks the content as deleted. Does not physically remove the record. Removes from Elasticsearch index.

---

## Error Codes

| HTTP Status | Code | Meaning |
|------------|------|---------|
| 400 | `INVALID_TRANSITION` | State transition not permitted by business rules |
| 400 | `QUOTA_EXCEEDED` | AI quota exceeded (for AI-assisted endpoints) |
| 403 | `ACCESS_DENIED` | Object-level authorisation failed |
| 404 | `NOT_FOUND` | Content not found (or hidden from requester) |
| 409 | `CO_AUTHOR_SESSION_ACTIVE` | Restore blocked due to active co-author session |
