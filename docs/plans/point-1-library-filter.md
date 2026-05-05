# Point 1 — Library vs My Content (channel-bound filter)

## Goal

- **My Content**: unchanged — lists all workspace items (channel-bound and not).
- **Library**: only **published** items with **`channelId == null`** (“unbounded” on the content row).

## Implementation

- [`apps/web/src/hooks/useLibrary.ts`](../../apps/web/src/hooks/useLibrary.ts): after `contentService.list({ lifecycleState: 'PUBLISHED' })`, filter `rows.filter((c) => !c.channelId)` before mapping to `ContentItem`.
- **Elasticsearch**: hits filtered client-side to `lifecycleState === 'PUBLISHED'` and no `contentChannelId` on the hit source.
- Index mapping: [`packages/database/elasticsearch/src/comms-content-index.json`](../../packages/database/elasticsearch/src/comms-content-index.json) adds `contentChannelId` keyword; [`apps/api/src/modules/search/contentIndex.document.ts`](../../apps/api/src/modules/search/contentIndex.document.ts) sets it from `content.channelId`.

## QA checklist

- [ ] Published content **with** `channelId` set: visible in My Content, **not** in Library grid.
- [ ] Published content **without** `channelId`: visible in Library.
- [ ] Library search: channel-bound docs do not appear after reindex (old docs without `contentChannelId` may still appear until reindexed).
