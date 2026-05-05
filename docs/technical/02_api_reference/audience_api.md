# API Reference — Audience

These endpoints are available to Audience (read + interact) users as well as Authors and Reviewers.

---

## Content Reading

### Get Published Content

```
GET /api/v1/content/:id
```

Returns the rendered content item. Object-Level Authorisation enforces visibility rules. Redis cache is checked first.

**Response 200:**
```json
{
  "id": "uuid",
  "title": "string",
  "body": { /* TipTap JSON */ },
  "state": "PUBLISHED",
  "visibility": "PUBLIC",
  "author": { "id": "uuid", "name": "string" },
  "tags": ["string"],
  "publishedAt": "ISO8601",
  "engagementCounts": {
    "views": 1240,
    "likes": 45,
    "reactions": { "THUMBS_UP": 30, "HEART": 12, "CELEBRATE": 3 }
  }
}
```

### List Published Content (Audience view)

```
GET /api/v1/content
```

**Query params:** `tags`, `authorId`, `from`, `to`, `templateId`, `page`, `limit`

Returns only `PUBLISHED` content accessible to the authenticated user.

---

## Engagement

### Record View

```
POST /api/v1/content/:id/view
```

Records a `ContentView` event asynchronously. Updates `engagementScore` in Elasticsearch.

### Like / Unlike

```
POST /api/v1/content/:id/like
```

Toggles the like state for the authenticated user. Updates Redis reaction count.

### React

```
POST /api/v1/content/:id/react
```

**Body:** `{ "reaction": "THUMBS_UP | HEART | CELEBRATE | THINKING | SURPRISED" }`

### Update Reading Progress

```
POST /api/v1/content/:id/progress
```

**Body:** `{ "percentComplete": 75, "lastPosition": 3400 }`

Batched updates. `ContentReadingProgress` record upserted per user per content item.

---

## Comments

### Post Comment

```
POST /api/v1/content/:id/comments
```

**Body:**
```json
{
  "text": "string (rich text)",
  "parentCommentId": "uuid (optional — for replies)"
}
```

### List Comment Threads

```
GET /api/v1/content/:id/comments
```

Returns top-level threads with nested replies (up to 2 levels).

---

## Bookmarks

### Add Bookmark

```
POST /api/v1/profile/bookmarks
```

**Body:** `{ "contentId": "uuid", "folderId": "uuid (optional)" }`

### Remove Bookmark

```
DELETE /api/v1/profile/bookmarks/:id
```

### List Bookmarks

```
GET /api/v1/profile/bookmarks
```

**Query params:** `folderId`, `page`, `limit`

### Bookmark Folders

```
GET    /api/v1/profile/bookmark-folders
POST   /api/v1/profile/bookmark-folders          ← create folder
PATCH  /api/v1/profile/bookmark-folders/:id      ← rename
DELETE /api/v1/profile/bookmark-folders/:id      ← delete (moves bookmarks to uncategorised)
POST   /api/v1/profile/bookmark-folders/:id/move ← move bookmarks into folder
```

### Bookmark Notifications

```
GET  /api/v1/profile/bookmark-notifications              ← list unread
POST /api/v1/profile/bookmark-notifications/mark-read    ← mark all as read
```

---

## Private Notes (Annotations)

### Create Note

```
POST /api/v1/content/:id/annotations
```

**Body:**
```json
{
  "text": "string",
  "anchorStart": 250,
  "anchorEnd": 310,
  "selectedText": "string"
}
```

**Response 201:** `{ "id": "uuid", "text": "string", "anchorStart": 250, "anchorEnd": 310 }`

### List Notes

```
GET /api/v1/content/:id/annotations
```

Returns only notes belonging to the authenticated user.

### Delete Note

```
DELETE /api/v1/content/:id/annotations/:annotationId
```

---

## AI Features

### Summarise

```
POST /api/v1/content/:id/summarize
```

**Body:** `{ "length": "SHORT | MEDIUM | DETAILED" }`

Short content → synchronous AI response. Long content → returns a job ID; client polls for result.

**Response (sync):**
```json
{ "summary": "string", "cached": false }
```

**Response (async):**
```json
{ "jobId": "uuid", "status": "QUEUED" }
```

### AI Tutor — Ask Question

```
POST /api/v1/content/:id/tutor
```

**Body:**
```json
{
  "question": "string",
  "sessionId": "uuid (optional — for multi-turn context)"
}
```

**Response:**
```json
{
  "answer": "string",
  "citations": [{ "contentId": "uuid", "passage": "string", "sectionTitle": "string" }],
  "sessionId": "uuid"
}
```

### RAG Query (Library-wide)

```
POST /api/v1/content/rag-query
```

**Body:** `{ "question": "string" }`

Same response shape as AI Tutor but retrieval spans the entire published library.

---

## Search (Audience)

```
GET /api/v1/search/content
```

**Query params:** `q` (full-text query), `tags`, `authorId`, `from`, `to`, `channelId`, `page`, `limit`, `semanticRank` (boolean)

Returns search results with highlighted snippets and relevance scores.

**Response:**
```json
{
  "total": 42,
  "hits": [
    {
      "id": "uuid",
      "title": "string",
      "summary": "string",
      "highlights": ["…matched <em>passage</em>…"],
      "score": 0.87,
      "tags": ["string"],
      "publishedAt": "ISO8601"
    }
  ],
  "facets": {
    "tags": [{ "value": "policy", "count": 15 }],
    "authors": [{ "value": "uuid", "label": "string", "count": 8 }]
  }
}
```
