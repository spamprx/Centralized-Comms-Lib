# Data Model — Content

All content-related models live in the PostgreSQL schema managed by Prisma. Source: `packages/database/transactional/prisma/schema.prisma`.

---

## Content (primary entity)

```
Content {
  id            String   @id @default(uuid())
  title         String
  state         ContentState
  visibility    VisibilityMode
  templateId    String?  (FK → Template)
  authorId      String   (FK → User)
  workspaceId   String?  (FK → Workspace)
  isDeleted     Boolean  @default(false)
  invalidated   Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Relations
  versions      ContentVersion[]
  snapshots     ContentSnapshot[]
  tags          ContentTag[]
  coAuthors     ContentCoAuthor[]
  annotations   ContentAnnotation[]
  bookmarks     ContentBookmark[]
  comments      ContentComment[]
  likes         ContentLike[]
  reactions     ContentReaction[]
  views         ContentView[]
  readingProgress ContentReadingProgress[]
  citations     ContentCitation[]
  analyticsEvents ContentAnalyticsEvent[]
  reviewRequests  ReviewRequest[]
}
```

### ContentState enum

| Value | Description |
|-------|-------------|
| `DRAFT` | Being written; not visible to audience |
| `IN_REVIEW` | Submitted; awaiting reviewer decisions |
| `PUBLISHED` | Approved; visible to intended audience |
| `ARCHIVED` | Read-only; removed from active listings |

### VisibilityMode enum

| Value | Description |
|-------|-------------|
| `PUBLIC` | All authenticated audience members |
| `PRIVATE` | Author + co-authors + assigned reviewers only |
| `HIDDEN` | Direct URL only; excluded from all search and browse |
| `ARCHIVED` | Synonymous with ARCHIVED state for display purposes |
| `PRIVATE_TO_GROUP` | Only members of linked groups |

---

## ContentVersion

Stores the TipTap JSON body of a content item. A new version is created on every save.

```
ContentVersion {
  id          String   @id @default(uuid())
  contentId   String   (FK → Content)
  body        Json     (TipTap document JSON)
  version     Int
  createdAt   DateTime @default(now())
  createdBy   String   (FK → User)
}
```

---

## ContentSnapshot

Immutable point-in-time copy. Created on every explicit save and every lifecycle state transition.

```
ContentSnapshot {
  id          String   @id @default(uuid())
  contentId   String   (FK → Content)
  body        Json     (TipTap document JSON)
  version     Int
  actorId     String   (FK → User)
  eventType   SnapshotEventType
  createdAt   DateTime @default(now())
}
```

### SnapshotEventType enum

`SAVE | STATE_TRANSITION | RESTORE | COMPONENT_PROPAGATION | CO_AUTHOR_SESSION_END`

---

## ContentCoAuthor

Tracks who is invited/accepted as a co-author on a content item.

```
ContentCoAuthor {
  id          String   @id
  contentId   String   (FK → Content)
  userId      String   (FK → User)
  status      CoAuthorStatus  (PENDING | ACCEPTED | DECLINED)
  invitedAt   DateTime
  respondedAt DateTime?
}
```

---

## ContentCitation

Tracks citations embedded in content items.

```
ContentCitation {
  id          String   @id
  contentId   String   (FK → Content)
  citationKey String   (e.g. "[1]" or APA identifier)
  format      CitationFormat  (APA | IEEE | MLA)
  rawData     Json     (full citation metadata)
  createdAt   DateTime
}
```

---

## Reader Interaction Models

### ContentAnnotation (Private Notes)

```
ContentAnnotation {
  id            String
  contentId     String   (FK → Content)
  userId        String   (FK → User)
  text          String
  anchorStart   Int
  anchorEnd     Int
  selectedText  String
  createdAt     DateTime
}
```

Notes are **private** — queries always filter by `userId = req.user.id`.

### ContentBookmark

```
ContentBookmark {
  id          String
  contentId   String   (FK → Content)
  userId      String   (FK → User)
  folderId    String?  (FK → BookmarkFolder)
  createdAt   DateTime
}
```

### BookmarkFolder

```
BookmarkFolder {
  id        String
  userId    String   (FK → User)
  name      String
  order     Int
  createdAt DateTime
}
```

### ContentBookmarkNotification

```
ContentBookmarkNotification {
  id          String
  bookmarkId  String   (FK → ContentBookmark)
  userId      String
  type        BookmarkNotificationType  (CONTENT_UPDATED | CONTENT_PUBLISHED)
  read        Boolean  @default(false)
  createdAt   DateTime
}
```

### ContentComment

```
ContentComment {
  id              String
  contentId       String   (FK → Content)
  authorId        String   (FK → User)
  text            String   (rich text)
  parentCommentId String?  (FK → ContentComment — for threading)
  createdAt       DateTime
  updatedAt       DateTime
}
```

Threading is limited to 2 levels deep (parent comment + replies). Replies cannot themselves have children.

### ContentLike

```
ContentLike {
  id        String
  contentId String   (FK → Content)
  userId    String   (FK → User)
  createdAt DateTime
  @@unique([contentId, userId])  ← one like per user per item
}
```

### ContentReaction

```
ContentReaction {
  id           String
  contentId    String   (FK → Content)
  userId       String   (FK → User)
  reactionType ReactionType  (THUMBS_UP | HEART | CELEBRATE | THINKING | SURPRISED)
  createdAt    DateTime
  @@unique([contentId, userId])  ← one reaction per user (can change type)
}
```

### ContentView

```
ContentView {
  id        String
  contentId String   (FK → Content)
  userId    String   (FK → User)
  viewedAt  DateTime
}
```

### ContentReadingProgress

```
ContentReadingProgress {
  id              String
  contentId       String   (FK → Content)
  userId          String   (FK → User)
  percentComplete Int      (0–100)
  lastPosition    Int      (character offset)
  status          ProgressStatus  (NOT_STARTED | READING | DONE)
  lastUpdated     DateTime
  @@unique([contentId, userId])
}
```

### ContentAnalyticsEvent

```
ContentAnalyticsEvent {
  id          String
  contentId   String   (FK → Content)
  userId      String?
  eventType   String   (VIEW | LIKE | SHARE | COPY | DOWNLOAD | PROGRESS)
  metadata    Json?
  occurredAt  DateTime
}
```

---

## ContentTag

Join table linking Content to Tag.

```
ContentTag {
  contentId String   (FK → Content)
  tagId     String   (FK → Tag)
  @@id([contentId, tagId])
}
```

---

## Tag

```
Tag {
  id          String
  name        String   @unique
  parentId    String?  (FK → Tag — for hierarchical tags)
  createdAt   DateTime
  contents    ContentTag[]
  templates   TemplateTag[]
}
```
