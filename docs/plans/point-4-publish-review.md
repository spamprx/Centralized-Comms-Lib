# Point 4 — Publish UX, review choice, lifecycle bypass

## Goal

- **Publish** replaces Notify in My Content; first step: **direct WhatsApp** vs **review workflow**.
- **Direct** path: WhatsApp send (+ optional **mark Published** with review-quorum bypass for channel/template-bound content only).
- **Review** path: closes publish modal and opens **Manage reviewers** for the same item.

## Backend

- [`POST /content/:id/STATE_TRANSITION`](../../apps/api/src/modules/content/content.routes.ts) accepts `bypassReviewQuorumForChannelPublish: true`.
- [`content.service.ts` `transitionState`](../../apps/api/src/modules/content/content.service.ts): when transitioning to `PUBLISHED`, skips closed-review quorum check if flag is set **and** `channelId` or `templateId` is present on the content row.

## Frontend

- [`PublishWhatsAppModal.tsx`](../../apps/web/src/components/PublishWhatsAppModal.tsx): choose step + form; checkbox to mark published after send (uses `contentService.transitionState` with bypass flag).

## QA checklist

- [ ] Review workflow button opens reviewer modal.
- [ ] Direct send + checkbox calls `STATE_TRANSITION` with bypass only after successful WhatsApp send.
- [ ] Non-channel content: bypass has no effect unless channel/template set (server-side guard).
