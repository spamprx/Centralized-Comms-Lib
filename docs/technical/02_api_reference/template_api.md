# API Reference — Templates

**Base path:** `/api/v1/templates`

Template operations require the Author role. Admin-only operations are noted.

---

## Template CRUD

```
GET    /api/v1/templates             ← list templates (with tag + cluster filters)
POST   /api/v1/templates             ← create template
GET    /api/v1/templates/:id         ← get template details
GET    /api/v1/templates/:id/bindings ← get with channel bindings
PATCH  /api/v1/templates/:id         ← update metadata (name, description)
DELETE /api/v1/templates/:id         ← delete (requires content migration first)
```

**Create template body:**
```json
{
  "name": "string",
  "description": "string",
  "defaultLocale": "en",
  "channelIds": ["uuid"]
}
```

---

## Clone

```
POST /api/v1/templates/:id/clone
```

Creates an independent deep copy (new UUID, `DRAFT` phase). All bindings, formatting rules, and translations are included.

**Response 201:** Full template object with new ID.

---

## Layout Editor (Draft & Activate)

### Save Draft Layout

```
PATCH /api/v1/templates/:id/layout/draft
```

**Body:**
```json
{
  "sections": [
    {
      "id": "uuid",
      "order": 1,
      "type": "HEADER | BODY | FOOTER | MEDIA_PLACEHOLDER",
      "config": { /* section-specific config */ }
    }
  ]
}
```

Persists `TemplateLayoutSection` records without activating the template.

### Activate Template

```
POST /api/v1/templates/:id/activate
```

Validates completeness (required fields, at least one channel binding). Transitions template from `DRAFT` to `ACTIVE` phase.

---

## Translations

### Manage Translations

```
GET  /api/v1/templates/:id/translations        ← list all i18n keys and current translations
POST /api/v1/templates/translate               ← request AI-assisted translation (async)
```

**Translate body:**
```json
{
  "templateId": "uuid",
  "targetLocale": "hi",
  "keys": ["header.title", "footer.disclaimer"]
}
```

### Manual Translation Entry

```
PATCH /api/v1/templates/:id/translations
```

**Body:**
```json
{
  "locale": "hi",
  "translations": {
    "header.title": "शीर्षक",
    "footer.disclaimer": "अस्वीकरण"
  }
}
```

---

## Channel Bindings

```
POST   /api/v1/templates/:id/bindings
DELETE /api/v1/templates/:id/bindings/:bindingId
```

**Add binding body:**
```json
{
  "channelId": "uuid",
  "layoutConfig": {
    "columns": 1,
    "maxWidth": 600,
    "mediaHandling": "INLINE | ATTACHMENT | OMIT"
  },
  "fieldMapping": {
    "title": "subject",
    "summary": "preheader"
  }
}
```

---

## Formatting Rules

```
GET    /api/v1/templates/:id/formatting-rules
PUT    /api/v1/templates/:id/formatting-rules
DELETE /api/v1/templates/:id/formatting-rules/:ruleId
```

**PUT body (full replace):**
```json
{
  "rules": [
    {
      "type": "TYPOGRAPHY",
      "property": "headingFont",
      "value": "Georgia",
      "locked": true
    },
    {
      "type": "COLOUR",
      "property": "primaryColour",
      "value": "#003366",
      "locked": true
    }
  ]
}
```

---

## Tags & Clusters

```
POST   /api/v1/templates/:id/tags           ← assign tag
DELETE /api/v1/templates/:id/tags/:tagId    ← remove tag
GET    /api/v1/templates/clusters/all       ← list all template clusters
POST   /api/v1/templates/:id/cluster        ← assign to cluster
DELETE /api/v1/templates/:id/cluster/:clusterId
```

---

## Template Library (Component Insertion)

```
GET  /api/v1/templates/:id/sections                         ← list layout sections
POST /api/v1/templates/:id/sections                         ← add component to template
```

**Add section body:**
```json
{
  "componentId": "uuid",
  "componentVersionId": "uuid",
  "insertionMode": "LINKED | SNAPSHOT",
  "position": 3
}
```

---

## AI — Draft First Version

```
POST /api/v1/templates/ai-draft
```

**Body:**
```json
{
  "description": "A three-section announcement template with a header image, body text, and a call-to-action footer",
  "channelId": "uuid (optional)"
}
```

**Response:** `{ "jobId": "uuid", "status": "QUEUED" }`

Result is available when the job completes (async AI worker).

---

## AI — Convert Between Channel Templates

```
POST /api/v1/templates/:id/convert-channel
```

**Body:** `{ "targetChannelId": "uuid" }`

**Response:** `{ "jobId": "uuid", "status": "QUEUED" }`
