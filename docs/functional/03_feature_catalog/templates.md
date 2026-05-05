# Feature Catalog — Templates

Templates are the structural backbone of the platform. They define section structure, required fields, formatting rules, and channel-specific rendering configurations. Authors create content within a template, which guarantees consistent structure and brand compliance.

---

## F-TMP-001 — CRUD `[Must Have]`

Full Create, Read, Update, Delete operations on templates.

- A template defines: section structure, required fields, allowed content types, default formatting, and channel bindings
- Templates go through their own lifecycle (Draft → Active)
- Deleting a template that has active content linked to it requires migrating that content to another template first — the system enforces this before allowing deletion
- Template metadata includes name, description, category, associated channels, and assigned tags

**Implementation status:** Fully implemented. `template.service.ts → create, list, getById, update, delete`. `Template` model in Prisma. `template.routes.ts` exposes CRUD endpoints under `/api/v1/templates`.

---

## F-TMP-002 — Clone `[Must Have]`

Users can clone an existing template to use as a starting point.

- The clone is a deep copy: it has a new ID, is created in Draft state, and is fully independent
- Changes to the clone do not affect the original, and vice versa
- All channel bindings, formatting rules, and translations are included in the clone

**Implementation status:** Fully implemented. `template.service.ts → clone`. `POST /templates/:id/clone`. New template record persisted with new UUID and `Draft` phase.

---

## F-TMP-003 — Add Channel `[Must Have]`

Templates can be associated with one or more distribution channels. Each channel binding has its own rendering configuration.

**Channel binding properties:**
- Target channel (Email, WhatsApp, SMS, Moodle, etc.)
- Channel-specific layout (column count, header/footer rules, media constraints)
- Field mapping (which template fields map to which channel-specific fields)

When content using this template is distributed to a channel, the binding's rendering configuration is applied to produce the channel-appropriate output.

**Implementation status:** Fully implemented. `TemplateChannelBinding` model in Prisma. `template.service.ts → addBinding, removeBinding`. Binding CRUD endpoints in `template.routes.ts`.

---

## F-TMP-004 — Translate `[Must Have]`

Template labels, placeholder text, and static strings can be translated into multiple languages.

- All localisable strings are extracted into a key-value table (`TemplateTranslation` model)
- Authors enter translations per language
- At render time, the appropriate locale is selected based on the user's language preference
- Missing translations fall back to the default language (no blank placeholders are shown)
- Required language set is configurable per template; the business rule engine enforces completeness

**Implementation status:** Fully implemented. `TemplateTranslation` model. `template.service.ts → translateText`. `POST /templates/translate`. `shared/validation/` validates i18n patch structure.

---

## F-TMP-005 — Editor `[Must Have]`

A visual WYSIWYG canvas editor for designing and modifying template layouts.

- Drag-and-drop section reordering
- Rich-text content blocks (headings, body, lists, media placeholders)
- The component palette lists all available reusable components
- Template layouts can be saved as drafts and previewed before activation
- `saveDraftLayout` endpoint persists intermediate editor state without activating the template

**Implementation status:** Fully implemented. `template.service.ts → saveDraftLayout, activate`. `TemplateLayoutSection` model stores ordered sections. `PATCH /templates/:id/layout/draft` for draft saves. `POST /templates/:id/activate` for activation. `TemplateLayoutEditor.tsx` is the frontend.

---

## F-TMP-006 — Formatting `[Must Have]`

Templates define formatting rules (fonts, colours, heading styles, spacing) that are enforced on all content that uses the template.

- Formatting rules are stored in `TemplateFormattingRule` model
- Authors cannot override template-locked styles (the editor enforces constraints)
- Formatting rules cover: typography, colour palette, heading hierarchy, media size constraints
- Preview in the template editor shows the rules applied in real time

**Implementation status:** Fully implemented. `TemplateFormattingRule` model. `formattingRule.service.ts`. `GET|PUT|DELETE /templates/:id/formatting-rules`. `businessRules/index.ts` enforces template integrity.

---

## F-TMP-007 — AI — Draft First Version `[Must Have]`

Authors describe the template requirements in natural language. AI generates a complete first-draft template with sections, fields, and formatting suggestions.

- Routes to Async AI Worker (template generation is always long-form)
- The AI provides an attached rationale note explaining its design choices
- The generated draft is fully editable in the standard template editor before activation

**Implementation status:** Implemented. `enqueueAsyncAiJob` with `TEMPLATE_DRAFT` job type dispatched from `template.service.ts`. Frontend AI-generation dialog in `TemplatesPage.tsx`.

---

## F-TMP-008 — Library (Reuse Components) `[Should Have]`

Authors can drag pre-built reusable components directly into templates from the component library.

- **Linked mode:** the template always renders the latest version of the component. When the component is updated, all templates using a linked instance are automatically updated via outbox propagation.
- **Snapshot mode:** the template captures a static copy at insertion time. Updates to the component do not affect the snapshot.
- The library is searchable by component name and `ComponentCategory`

**Implementation status:** Fully implemented. `componentPropagation.service.ts` handles linked update propagation. `ComponentLibraryPanel.tsx` is the frontend drag-and-drop panel. `COMPONENT.VERSION_UPDATED` outbox event drives automated propagation.

---

## F-TMP-009 — Hyperlink & Asset Management `[Should Have]`

Templates (and content created from them) can manage embedded assets and hyperlinks with automatic integrity checking.

- Assets (images, documents) are uploaded to MinIO object storage via presigned PUT URLs
- `AssetLinkCheck` model tracks link health status: `VALID`, `BROKEN`, or `PENDING`
- A scheduled background job (`assetLinkIntegrityScan`) periodically scans all asset links
- Broken links trigger an alert notification to the author/admin via outbox
- Assets are versioned in the `Asset` model

**Implementation status:** Fully implemented. `assets.service.ts` handles upload intent (presigned PUT), finalization, and usage tracking. `linkIntegrity.service.ts` is the scanner. `jobs/assetLinkIntegrityScan.ts` runs on a schedule. `AssetLayout.tsx` is the frontend asset manager.

---

## F-TMP-010 — Tag & Cluster `[Should Have]`

Templates can be tagged using the same taxonomy as content. Tags support clustering for discovery.

- Tags on templates are stored in `TemplateTag` join table
- Tags feed the Elasticsearch facet index for filtered template discovery
- Clusters group templates by shared tags and semantic similarity

**Implementation status:** Fully implemented. `TemplateTag` model. Tag assignment endpoints in `template.routes.ts`. `GET /templates/clusters/all` returns cluster groupings.

---

## F-TMP-011 — AI — Convert Between Channel Templates `[Should Have]`

AI automatically adapts a template from one channel's format to another (e.g. Email template → SMS template).

- Author selects the source template and target channel
- Async AI Worker generates a converted template draft adapted to the target channel's constraints (character limits, media restrictions, layout changes)
- The converted draft is editable before activation
- The original template is not modified

**Implementation status:** Wired. `enqueueAsyncAiJob` with `TEMPLATE_CHANNEL_CONVERT` job type. Conversion UI in `TemplatesPage.tsx`. Full conversion quality is dependent on the AI worker implementation (Sprint 5).

---

## F-TMP-012 — Conditional Render `[Nice to Have]`

Template sections can be conditionally shown or hidden based on audience group membership, user role, or content variables. Hidden sections are completely absent from the rendered output — not just visually hidden.

**Implementation status:** Stretch goal (Sprint 3). Placeholder manifest for WhatsApp (`waPlaceholderManifest.ts`) lays groundwork for conditional substitution. Full conditional render engine not yet implemented.
