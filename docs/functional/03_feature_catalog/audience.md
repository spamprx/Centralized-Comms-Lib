# Feature Catalog — Audience

All features apply to authenticated Audience (end-user) role accounts unless noted.

---

## F-AUD-001 — View `[Must Have]`

Audience members can view published content in a clean, responsive reading interface.

- Rendered via the Content & Template Engine; layout adapts to desktop and mobile
- Redis cache serves repeated reads without hitting the primary database
- Only `PUBLISHED` content with appropriate visibility is accessible; any other state returns 403
- Content includes a consistent header, body sections rendered from TipTap JSON, and an attribution footer

**Implementation status:** Fully implemented. `content.routes.ts` GET handler serves the published document. Cache hit on Redis with fallback to Prisma. `ReadingLayout.tsx` is the frontend reader.

---

## F-AUD-002 — Copy `[Must Have]`

Users can copy content text to their clipboard. Copied text automatically includes a source attribution footer (e.g. "Source: [Title] — Comms-Library") unless disabled.

- Admins can disable the attribution footer per content item or per channel
- The copy event is intercepted client-side; no server round-trip required for the copy itself
- Attribution configuration is fetched from the Content Repository settings

**Implementation status:** Implemented. Client-side copy intercept in the reading layout. Admin setting via `admin.routes.ts → PATCH /admin/settings`.

---

## F-AUD-003 — React / Like / Share / Comment `[Must Have]`

Audience members can interact with published content.

**Reactions:** At least five emoji reaction types (e.g. 👍 ❤️ 🎉 🤔 😮) plus a Like toggle. Reaction counts are displayed in real time via Redis.

**Comments:** Public comments supporting threading up to two levels deep. Comments support rich text; new comment threads notify subscribed participants via the outbox. `ContentComment` model persists threads.

**Share:** Generates a shareable direct URL or triggers a cross-platform share dialog. Social media posting is routed through External Integrations with circuit breakers.

**Implementation status:** Fully implemented. `ContentLike`, `ContentReaction`, `ContentComment`, `ContentView` models in Prisma. Dedicated endpoints in `content.routes.ts`. Redis refreshes real-time counts.

---

## F-AUD-004 — Bookmark `[Must Have]`

Users can bookmark any published content item for quick access later.

- Bookmarks are organised into user-defined folders (`BookmarkFolder` model)
- A notification is sent to the user when a bookmarked item is updated (`ContentBookmarkNotification`)
- The bookmarks list is sorted by date; folders can be reordered
- Bookmark notification preferences are manageable in the user's profile

**Implementation status:** Fully implemented. `ContentBookmark`, `BookmarkFolder`, `ContentBookmarkNotification` models. `profile.service.ts` manages bookmark CRUD and folder ops. `profile.routes.ts` exposes the endpoints.

---

## F-AUD-005 — Progress `[Must Have]`

The system tracks each user's reading progress (Not Started / Reading / Done) across all accessible content.

- Scroll position is batched and sent periodically (not on every scroll event) to reduce server load
- Progress syncs across all of the user's devices for the same account
- Dashboard shows completion percentages per item
- Users can manually override status: mark as Done or mark as Unread

**Implementation status:** Fully implemented. `ContentReadingProgress` model. Progress update endpoint in `content.routes.ts`. `analytics.routes.ts` serves dashboard aggregation. `ProfileLayout.tsx` renders the progress view.

---

## F-AUD-006 — AI — Summarize `[Must Have]`

AI generates a concise summary of a content item. Users can choose from multiple length presets (short, medium, detailed).

- Short content: handled by Sync AI (fast path, near-instant)
- Long content: handled by Async AI Worker (the user sees a loading indicator)
- Generated summaries are cached in Redis for subsequent requests
- Summaries preserve key facts, figures, and conclusions
- Users can copy or export the summary independently

**Implementation status:** Implemented. AI path selection in `content.service.ts`. `runSyncAiTask` for short content, `enqueueAsyncAiJob` for long content. Summary cached in Redis. Frontend summary panel in `ReadingLayout.tsx`.

---

## F-AUD-007 — AI — Clustering `[Must Have]`

AI groups all published content into topic clusters, helping users discover related material by browsing rather than searching.

- Clusters are regenerated periodically as new content is published
- Users can follow a cluster to receive notifications when new items are added
- Within a cluster, items are ranked by relevance score
- Cluster query reads embeddings from the Vector Store; Async AI Worker computes cluster centroids

**Implementation status:** Wired. Cluster computation dispatched via `enqueueAsyncAiJob`. Elasticsearch `titleEmbedding` dense vectors (384 dimensions) support the similarity computation. Cluster browsing UI in `LibraryLayout.tsx`. Full periodic reindex via `jobs/nightlyVectorReindex`.

---

## F-AUD-008 — AI — RAG (Retrieval-Augmented Generation) `[Must Have]`

Users can ask natural-language questions in the AI assistant and receive answers grounded in the content library. Every answer includes inline citations to the source documents.

- Query is validated, then Search & Retrieval fetches the most relevant passages from the Vector Store and Elasticsearch index
- Sync AI generates the grounded answer using retrieved passages as context
- Citations are verified against the Content Repository before display
- The retrieval index is refreshed within 5 minutes of content publication

**Implementation status:** Implemented. `syncAi.ts → runSyncAiTask` powers the RAG response generation. Embedding lookup via Vector Store (Elasticsearch dense vector). Citation validation endpoint in `content.routes.ts`. Frontend `ChatLayout.tsx` is the conversational interface.

---

## F-AUD-009 — Note Taking `[Should Have]`

Audience members can take private notes anchored to specific passages within published content.

- Notes are private — never visible to authors, reviewers, or other audience members
- Notes are anchored to the highlighted text selection; a margin indicator marks the anchor position
- Notes are exportable in Markdown and PDF formats

**Implementation status:** Implemented. `ContentAnnotation` model in Prisma. Annotation CRUD endpoints in `content.routes.ts`. `ReadingLayout.tsx` renders margin indicators.

---

## F-AUD-010 — Content Filtering `[Should Have]`

Users can filter visible content by section, tag, keyword, or date range. Filtered results can be exported.

- Filters are combinable with AND/OR logic
- Filter state is reflected in the URL for shareability and back-navigation
- "Export Selection" produces a PDF or Markdown file with source attribution

**Implementation status:** Implemented. Faceted filtering via Elasticsearch in `contentSearch.service.ts`. Filter parameters validated on `GET /search/content`. Export-to-PDF handled via `content/content.routes.ts`. Redis cache used for repeated filter queries.

---

## F-AUD-011 — AI — AI Tutor `[Should Have]`

An interactive conversational AI tutor answers questions about library content in a multi-turn dialogue, exclusively grounded in published material.

- User opens the AI Tutor panel and asks a question
- Conversation history is stored in Redis for context in follow-up turns
- Responses are grounded in library content only; the system will not hallucinate or source external facts
- Conversation history is saved and resumable across sessions

**Implementation status:** Implemented. Builds on the same RAG infrastructure as F-AUD-008 but maintains a conversation context window in Redis. `ChatLayout.tsx` is the interface. Multi-turn context retrieved from Redis on each turn.

---

## F-AUD-012 — Info Graph `[Nice to Have]`

A visual knowledge graph showing relationships between content items as an interactive, zoomable node-link diagram (Obsidian-style). Edges represent shared tags, citations, and semantic similarity.

**Implementation status:** Stretch goal (Sprint 4). Not yet implemented.

---

## F-AUD-013 — Related Content `[Nice to Have]`

The system recommends 3–5 related content items at the end of each reading page, based on shared tags, audience overlap, and semantic similarity.

**Implementation status:** Stretch goal (Sprint 4). Not yet implemented.

---

## F-AUD-014 — AI — Convert Content Template `[Nice to Have]`

AI re-formats content from one template to another (e.g. lecture notes to slide deck), preserving the textual content while adapting layout and structure.

**Implementation status:** Stretch goal (Sprint 5). Not yet implemented.
