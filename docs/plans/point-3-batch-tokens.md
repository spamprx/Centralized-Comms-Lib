# Point 3 — CSV/JSON recipients and batch WhatsApp publish

## Goal

- When the body contains `{{field}}` or `<mediaKey>` placeholders, collect **required keys** and require a **CSV or JSON** import with one row per recipient.
- Backend sends **one notification per row** via `POST /api/v1/whatsapp-send/send-batch`.

## API

- [`POST /whatsapp-send/send-batch`](../../apps/api/src/modules/whatsapp-send/whatsappSend.routes.ts) — body: `{ event_type, client_id?, blocks, attachments?, rows: [{ user_id, wa_number, field_values? }] }`.
- [`POST /whatsapp-send/placeholder-manifest`](../../apps/api/src/modules/whatsapp-send/whatsappSend.routes.ts) — optional; client uses [`waPlaceholderManifest.ts`](../../apps/web/src/lib/waPlaceholderManifest.ts) mirror.

## Token rules

- `{{name}}` → `field_values.name`
- `<photo>` → `field_values.photo` (typically a URL string after expansion)
- Backend applies tokens in [`whatsappSend.service.ts`](../../apps/api/src/modules/whatsapp-send/whatsappSend.service.ts) (`finalizeBodyWithFieldValues`).

## QA checklist

- [ ] CSV with header `user_id,wa_number,<token>...` parses and batch sends.
- [ ] JSON array of objects with same keys sends.
- [ ] Invalid `wa_number` format rejected before send.
