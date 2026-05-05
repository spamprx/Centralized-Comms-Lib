# Data Model — Template

Templates define the structural and stylistic scaffold for content. All template models are in the Prisma schema.

---

## Template

```
Template {
  id            String   @id @default(uuid())
  name          String
  description   String?
  phase         TemplatePhase  (DRAFT | ACTIVE | DEPRECATED)
  defaultLocale String   @default("en")
  authorId      String   (FK → User)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Relations
  translations    TemplateTranslation[]
  layoutSections  TemplateLayoutSection[]
  formattingRules TemplateFormattingRule[]
  channelBindings TemplateChannelBinding[]
  tags            TemplateTag[]
  clusters        TemplateCluster[]
  contents        Content[]        ← content items using this template
}
```

### TemplatePhase enum

| Value | Description |
|-------|-------------|
| `DRAFT` | Being designed; not available for content creation |
| `ACTIVE` | Available for authors to create content |
| `DEPRECATED` | No longer available for new content; existing content not affected |

---

## TemplateTranslation

Stores i18n key-value pairs per language. Used at render time to localise template labels and static text.

```
TemplateTranslation {
  id          String
  templateId  String   (FK → Template)
  locale      String   (ISO 639-1 code, e.g. "en", "hi", "te")
  key         String   (dot-notation string key, e.g. "header.title")
  value       String   (translated string)
  updatedAt   DateTime
  @@unique([templateId, locale, key])
}
```

**Fallback:** At render time, if a translation for the requested locale is missing, the `defaultLocale` value is used.

---

## TemplateLayoutSection

Ordered sections that define the visual structure of a template.

```
TemplateLayoutSection {
  id          String
  templateId  String   (FK → Template)
  order       Int
  type        SectionType  (HEADER | BODY | FOOTER | MEDIA_PLACEHOLDER | COMPONENT_SLOT)
  config      Json     (section-specific configuration: label, required, maxLength, etc.)
  componentId String?  (FK → Component — for COMPONENT_SLOT type)
  componentVersionId String?
  insertionMode ComponentInsertionMode?  (LINKED | SNAPSHOT)
  createdAt   DateTime
  updatedAt   DateTime
}
```

---

## TemplateFormattingRule

Style constraints applied to all content using this template.

```
TemplateFormattingRule {
  id          String
  templateId  String   (FK → Template)
  type        FormattingRuleType  (TYPOGRAPHY | COLOUR | SPACING | MEDIA)
  property    String   (e.g. "headingFont", "primaryColour", "lineHeight")
  value       String   (e.g. "Georgia", "#003366", "1.5")
  locked      Boolean  (if true, authors cannot override)
  createdAt   DateTime
}
```

---

## TemplateChannelBinding

Links a template to a distribution channel with channel-specific rendering configuration.

```
TemplateChannelBinding {
  id            String
  templateId    String   (FK → Template)
  channelId     String   (FK → Channel)
  layoutConfig  Json     (columns, maxWidth, mediaHandling, etc.)
  fieldMapping  Json     (maps template fields to channel-specific fields)
  createdAt     DateTime
  @@unique([templateId, channelId])
}
```

---

## TemplateTag

Join table linking Template to Tag.

```
TemplateTag {
  templateId  String   (FK → Template)
  tagId       String   (FK → Tag)
  @@id([templateId, tagId])
}
```

---

## TemplateCluster

Groups templates by topic or category for discovery.

```
TemplateCluster {
  id          String
  name        String
  description String?
  templates   Template[]
  createdAt   DateTime
}
```

---

## Channel

Distribution channel configuration.

```
Channel {
  id          String
  name        String
  type        ChannelType  (EMAIL | SMS | WHATSAPP | MOODLE | CANVAS | CALENDAR | PUSH | SOCIAL | RSS | WEBSITE)
  config      Json         (endpoint URLs, credentials references, etc.)
  active      Boolean      @default(true)
  createdAt   DateTime
  updatedAt   DateTime

  bindings    TemplateChannelBinding[]
}
```

---

## Component (Reusable Block)

```
Component {
  id          String
  name        String
  description String?
  category    ComponentCategory  (HEADER | FOOTER | INFO_BLOCK | LEGAL | MEDIA | CUSTOM)
  authorId    String   (FK → User)
  createdAt   DateTime
  updatedAt   DateTime

  versions    ComponentVersion[]
}
```

## ComponentVersion

```
ComponentVersion {
  id              String
  componentId     String   (FK → Component)
  version         Int
  body            Json     (TipTap JSON)
  linkRefs        Json?    (references to linked assets/URLs)
  propSchema      Json?    (prop schema for conditional rendering)
  isCanonical     Boolean  @default(false)   ← true = latest published version
  createdAt       DateTime
  createdBy       String   (FK → User)
}
```

Only one `ComponentVersion` per component has `isCanonical = true` at any time. When the canonical body is updated:
1. `isCanonical` on the new version is set to `true`
2. Old canonical version's `isCanonical` is set to `false`
3. `COMPONENT.VERSION_UPDATED` outbox event fires → propagation to linked content
