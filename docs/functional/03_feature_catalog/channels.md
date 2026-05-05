# Feature Catalog — Channels

Channels are named distribution endpoints. Each channel has its own rendering configuration and delivery mechanism. Content is composed once and distributed to any configured subset of channels.

Channel management (create, update, delete channel configurations) is an Admin responsibility. Channel bindings (linking a template to a specific channel) are an Author responsibility during template setup.

---

## Channel Architecture

All channel sends flow through the same pipeline:

1. Author or admin triggers a send
2. Template engine renders the content using the channel-specific binding (layout, field mapping, character limits)
3. Notification dispatcher routes the rendered payload to the appropriate delivery integration
4. Delivery status is logged (success, failure, retry)
5. For async channels (Email, WhatsApp) the outbox pattern guarantees exactly-once delivery

---

## F-CHN-001 — Email `[Must Have]`

Send rendered content to one or more email recipients.

- Full HTML email rendering from the channel-bound template
- Supports recipient lists, CC, BCC
- Delivery via the external **Notify** HTTP API (`emailSendService.ts → sendToNotify`)
- `POST /email-send/send` endpoint; `POST /email-send/preview` renders a preview without sending
- `SmsDeliveryLog` (shared with SMS) or dedicated email log tracks delivery status

**Implementation status:** Fully implemented. `emailSend.service.ts`, `emailSend.routes.ts`. Notify API integration. Frontend `PublishWhatsAppModal.tsx` pattern reused for Email send flow. Test script at `infra/scripts/test-email-send.sh`.

---

## F-CHN-002 — SMS `[Must Have]`

Send short-form content rendered from a channel-bound template via SMS.

- Character-limit enforcement applied at render time (160 chars per segment or Unicode limit)
- Recipient phone numbers validated before send
- `SmsDeliveryLog` model tracks message SID, status, segment count
- Delivery routed through Notify API

**Implementation status:** Wired via the channel + Notify API. `SmsDeliveryLog` model in Prisma. `channel.service.ts` manages the SMS channel configuration. Full send UI mirrors the Email send flow.

---

## F-CHN-003 — Moodle `[Must Have]`

Publish content directly to a configured Moodle LMS instance.

- Content is formatted according to the Moodle channel binding (HTML announcement structure)
- Integration is via Moodle's REST Web Services API
- Channel configuration stores the Moodle endpoint URL and API token (managed via the secrets vault)

**Implementation status:** Channel configuration model implemented. Actual Moodle API integration is planned for Sprint 4. `Channel` model with type `MOODLE` is registered.

---

## F-CHN-004 — Canvas `[Must Have]`

Publish content to a Canvas LMS instance.

- Uses Canvas's Announcements API
- Channel binding configures course IDs and API credentials
- Same delivery pipeline as Moodle; integration layer abstracts the API differences

**Implementation status:** Channel model supports `CANVAS` type. API integration implementation is Sprint 4.

---

## F-CHN-005 — Calendar `[Must Have]`

Distribute event-type content as calendar events (iCal format / Google Calendar API / Outlook).

- Content with a date and title can be exported as a `.ics` file or pushed to a connected calendar service
- Channel binding configures the target calendar (Google, Outlook, iCal export)

**Implementation status:** Channel model supports `CALENDAR` type. iCal generation and calendar push integration is Sprint 4.

---

## F-CHN-006 — Push Notifications `[Must Have]`

Send in-app and mobile push notifications for published content.

- Push delivery via Web Push (browsers) and platform push services (FCM/APNS via Notify)
- Notification body is truncated to push character limits; full content link is included
- User opt-in/opt-out managed in profile settings

**Implementation status:** Channel model supports `PUSH` type. Notification dispatch wired via `notificationDispatcher.ts`. Full push registration flow is Sprint 4.

---

## F-CHN-007 — WhatsApp `[Must Have]`

Send WhatsApp-formatted content to a list of recipients using approved WhatsApp Business API templates.

- Source content is converted from TipTap JSON to WhatsApp block format via `whatsappSend.service.ts`
- Placeholder manifest (`waPlaceholderManifest.ts`) maps template variables to WhatsApp template parameters
- Batch send with progress tracking; prior recipient lists can be reused
- `WhatsAppSendRequest` model persists each send request with full payload and status
- `WhatsAppMessageLog` tracks per-recipient delivery status

**Endpoints:**
- `POST /whatsapp-send/convert` — convert content to WhatsApp payload
- `POST /whatsapp-send/send` — send to single recipient
- `POST /whatsapp-send/send-batch` — send to recipient list
- `POST /whatsapp-send/preview` — preview without sending
- `GET /whatsapp-send/requests` — list send requests
- `PATCH /whatsapp-send/requests/:id/status` — update delivery status

**Implementation status:** Fully implemented. `whatsappSend.service.ts`, `whatsappSend.routes.ts`. Notify API integration. `WhatsAppSendRequest`, `WhatsAppMessageLog`, `WhatsAppTemplateRegistry` models in Prisma. Frontend `PublishWhatsAppModal.tsx`.

---

## F-CHN-008 — Social Media `[Must Have]`

Post content to configured social media platforms (LinkedIn, Twitter/X, etc.).

- Content is rendered to a short-form social media format per the channel binding
- External social media API calls are wrapped in circuit breakers
- Share URL can also be copied for manual posting

**Implementation status:** Channel model supports `SOCIAL` type. Circuit-breaker-wrapped External Integrations path wired in `content.service.ts`. Platform-specific API adapters are Sprint 4.

---

## F-CHN-009 — RSS / Atom Feed `[Should Have]`

Published content is automatically available as an RSS 2.0 or Atom 1.0 feed.

- Feed is generated dynamically from the published content list
- Filterable by tag or content type
- Authenticated feeds (for private content) and public feeds supported

**Implementation status:** Channel model registered. RSS feed generator is planned. `GET /channels/:id` returns channel config including feed URL.

---

## F-CHN-010 — Website `[Should Have]`

Embed published content in an external website via an embeddable widget or API endpoint.

- `GET /content/:id` returns the fully-rendered HTML suitable for iframe embedding
- JavaScript snippet for seamless content embedding
- Respects visibility controls — `PRIVATE` or group-private content will not be served

**Implementation status:** Content reading API already serves rendered HTML. Embeddable widget packaging is planned.

---

## Channel Management API

Admins manage the channel catalog via:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/channels` | List all configured channels |
| `POST` | `/api/v1/channels` | Create a new channel |
| `GET` | `/api/v1/channels/:id` | Get channel details |
| `PATCH` | `/api/v1/channels/:id` | Update channel configuration |
| `DELETE` | `/api/v1/channels/:id` | Remove a channel |
