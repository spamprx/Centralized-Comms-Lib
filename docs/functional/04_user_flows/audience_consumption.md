# User Flow — Audience Consumption

This document describes how audience members discover, read, interact with, and learn from published content.

---

## Overview

```
Discover → Read → Interact → Save / Track → Learn (AI)
```

---

## Phase 1 — Discover Content

### Search

1. User types a query in the search bar
2. System validates the query string; forwards to Search & Retrieval
3. Elasticsearch performs full-text search (stemming, synonym expansion, typo tolerance)
4. If AI Smart Ranking is active: query is also embedded (`embedText`); results are re-ranked by blending BM25 + vector similarity + engagement score + recency
5. Results are returned with highlighted match snippets
6. User can refine with filters: tags, author, date range, channel (filter state preserved in URL)

### Browse by Cluster

1. User opens the "Explore" page
2. AI-generated topic clusters are displayed (computed by Async AI Worker from content embeddings)
3. User selects a cluster; sees all content items within it ranked by relevance
4. User can follow a cluster to receive notifications when new items are added

### Direct Navigation

- Following a bookmarked or shared link goes directly to the content item
- Hidden content is accessible only via a direct URL (excluded from all browse/search interfaces)

---

## Phase 2 — Read Content

1. User navigates to a published content item
2. Object-Level Authorisation confirms:
   - Content is in `PUBLISHED` state
   - Visibility permits this user (public, or user is in the required group)
3. Redis cache is checked first; on miss, Prisma fetches the latest published version
4. TipTap-rendered HTML is served via the `ReadingLayout`
5. View event (`ContentView`) is recorded asynchronously — contributes to analytics and engagement score

**Mobile responsiveness:** The reading layout adapts to viewport width. No horizontal scrolling required on content.

---

## Phase 3 — Interact

### React / Like

1. User clicks a reaction emoji or the Like button
2. `ContentReaction` or `ContentLike` record created
3. Redis updates the real-time reaction count displayed to all readers
4. Reaction count feeds into the engagement score used by AI Smart Ranking

### Comment

1. User posts a public comment
2. Rich-text input with support for `@mentions`
3. Threading: replies nest up to two levels deep
4. `ContentComment` persisted; subscribed participants notified via outbox

### Share

1. User clicks "Share"
2. Platform share dialog opens (or a shareable URL is copied)
3. Cross-platform social media posting routes through circuit-breaker-wrapped External Integrations

### Copy

1. User selects text and copies
2. Client-side intercept appends attribution footer (unless disabled by admin for this content/channel)
3. No server round-trip; copy completes instantly

---

## Phase 4 — Save & Track

### Bookmark

1. User clicks the bookmark icon on any published content
2. `ContentBookmark` record created under the user's default folder (or a chosen folder)
3. Folders are user-defined and reorderable
4. When the bookmarked content is updated, `ContentBookmarkNotification` is created → user receives notification

### Progress Tracking

1. As user scrolls through content, scroll position events are batched (not sent on every scroll)
2. Batched progress updates are sent to the server; `ContentReadingProgress` record updated
3. Progress syncs across all the user's devices
4. Dashboard shows completion percentage per item (Not Started / Reading / Done)
5. User can manually mark items as Done or Unread

### Note Taking

1. User highlights a text passage; clicks "Add Note"
2. A note editor opens anchored to the selection
3. Note is saved as `ContentAnnotation` — private to this user only
4. A subtle margin indicator marks note positions while reading
5. Notes are exportable in Markdown and PDF

---

## Phase 5 — AI-Powered Learning

### Summarise

1. User clicks "Summarize" on any published item
2. Selects a length preset (brief / medium / detailed)
3. Short items: Sync AI returns summary immediately
4. Long items: Async AI Worker processes in background; loading indicator shown
5. Summary appears in a collapsible panel; user can copy or export it
6. Summary is cached in Redis for subsequent requests

### AI Tutor (Conversational)

1. User opens the AI Tutor panel (`ChatLayout`)
2. User types a question (e.g. "What does section 3.2 mean in plain language?")
3. System validates and sends query to Search & Retrieval
4. Relevant passages retrieved from Vector Store + Elasticsearch
5. Sync AI generates a grounded answer with inline citations
6. User asks a follow-up; conversation history is retrieved from Redis for multi-turn context
7. Session is saved; user can resume the conversation later

### AI Clustering Exploration

1. User opens "Explore" — AI topic clusters are shown
2. Clicking a cluster lists all items in it, ranked by semantic similarity to the cluster centroid
3. User can subscribe to a cluster to get notified of new additions

### RAG Q&A

1. User types a question in the global AI assistant
2. Same pipeline as AI Tutor but scoped across the entire library (not a specific item)
3. Answer includes inline citations to source documents
4. Citations are verified against the Content Repository before display

---

## Content Filtering and Export

1. User applies filters (tags, sections, keywords, date range) to narrow content view
2. Filters are combinable (AND between types, OR within a multi-value filter)
3. Filtered results update in real time
4. User clicks "Export Selection" → PDF or Markdown file generated with source attribution

---

## Notification Summary for Audience

| Trigger | Notification |
|---------|-------------|
| Bookmarked item updated | In-app + optional email |
| Followed cluster has new content | In-app notification |
| Reply to user's comment | In-app notification |
| AI Tutor session responded | In-panel response |
