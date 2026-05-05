# Point 2 — Publish gate and channel/template consistency

## Goal

- **Publish** entry (later labeled in UI) for items with **`templateId` or `channelId`**.
- **Backend**: if both template and channel are set, **`channelId` must be in the template’s channel bindings** (enforces single allowed channel from template).

## Implementation

- [`apps/web/src/layouts/MyContentLayout.tsx`](../../apps/web/src/layouts/MyContentLayout.tsx): action visibility `(item.templateId || item.channelId)`.
- [`apps/api/src/modules/content/content.service.ts`](../../apps/api/src/modules/content/content.service.ts): `validateTemplateChannelBinding` + checks in `createDraft` and `saveBody`.
- [`apps/api/src/modules/content/content.routes.ts`](../../apps/api/src/modules/content/content.routes.ts): `400` on `invalidChannelBinding`.

## QA checklist

- [ ] Content with only `channelId`: Publish action visible; save succeeds.
- [ ] Content with template + channel not in bindings: save returns **400** with clear error.
- [ ] Content with template + matching binding: save succeeds.
