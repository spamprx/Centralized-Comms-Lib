/**
 * Server-side validation for template layout JSON (grid rows, columns, stacked regions).
 * Kept in sync with apps/web/src/lib/templateLayout/layoutConfig.ts
 */

import { randomUUID } from "crypto";

export const LAYOUT_VERSION = 2;

export type TemplateLayoutRegion = {
  id: string;
  type: string;
  props?: Record<string, unknown>;
};

export type LayoutCell = {
  id: string;
  flexGrow: number;
  regions: TemplateLayoutRegion[];
};

export type LayoutRow = {
  id: string;
  cells: LayoutCell[];
};

/** Normalized layout persisted on templates */
export type TemplateLayoutConfig = {
  version: number;
  rows: LayoutRow[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isRegion(v: unknown): v is TemplateLayoutRegion {
  if (!isRecord(v)) return false;
  if (typeof v.id !== "string" || !v.id.trim()) return false;
  if (typeof v.type !== "string" || !v.type.trim()) return false;
  if (
    v.props != null &&
    (typeof v.props !== "object" || Array.isArray(v.props))
  )
    return false;
  return true;
}

function parseRegionsFromCellRaw(
  raw: Record<string, unknown>,
): TemplateLayoutRegion[] | null {
  if (Array.isArray(raw.regions)) {
    const regions: TemplateLayoutRegion[] = [];
    for (const r of raw.regions) {
      if (!isRegion(r)) return null;
      regions.push(r);
    }
    if (regions.length === 0) return null;
    return regions;
  }
  if (raw.region != null && isRegion(raw.region)) {
    return [raw.region];
  }
  return null;
}

function parseCell(raw: unknown): LayoutCell | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string" || !raw.id.trim()) return null;
  const fg = raw.flexGrow;
  if (typeof fg !== "number" || !Number.isFinite(fg) || fg <= 0) return null;
  const regions = parseRegionsFromCellRaw(raw);
  if (!regions) return null;
  return { id: raw.id, flexGrow: fg, regions };
}

function parseRow(raw: unknown): LayoutRow | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string" || !raw.id.trim()) return null;
  if (!Array.isArray(raw.cells) || raw.cells.length === 0) return null;
  const cells: LayoutCell[] = [];
  for (const c of raw.cells) {
    const cell = parseCell(c);
    if (!cell) return null;
    cells.push(cell);
  }
  return { id: raw.id, cells };
}

function migrateRegionsToRows(regions: TemplateLayoutRegion[]): LayoutRow[] {
  return regions.map((region) => ({
    id: `row_${region.id}`,
    cells: [
      {
        id: `cell_${region.id}`,
        flexGrow: 1,
        regions: [region],
      },
    ],
  }));
}

function parseTemplateLayout(raw: unknown): TemplateLayoutConfig | null {
  if (raw == null || !isRecord(raw)) return null;
  const version = raw.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1)
    return null;

  if (Array.isArray(raw.rows)) {
    if (raw.rows.length === 0) {
      return { version: LAYOUT_VERSION, rows: [] };
    }
    const rows: LayoutRow[] = [];
    for (const r of raw.rows) {
      const row = parseRow(r);
      if (!row) return null;
      rows.push(row);
    }
    return { version: LAYOUT_VERSION, rows };
  }

  if (Array.isArray(raw.regions)) {
    const regions: TemplateLayoutRegion[] = [];
    for (const r of raw.regions) {
      if (!isRegion(r)) return null;
      regions.push(r);
    }
    return { version: LAYOUT_VERSION, rows: migrateRegionsToRows(regions) };
  }

  return null;
}

export function flattenRegions(
  config: TemplateLayoutConfig,
): TemplateLayoutRegion[] {
  const out: TemplateLayoutRegion[] = [];
  for (const row of config.rows) {
    for (const cell of row.cells) {
      for (const r of cell.regions) {
        out.push(r);
      }
    }
  }
  return out;
}

/** TipTap `doc` JSON from region props, or an empty doc — mirrors the web editor. */
function ensureRichDoc(props: Record<string, unknown> | undefined): unknown {
  const doc = props?.doc;
  if (
    doc &&
    typeof doc === "object" &&
    !Array.isArray(doc) &&
    (doc as { type?: string }).type === "doc"
  ) {
    return doc;
  }
  return { type: "doc", content: [{ type: "paragraph" }] };
}

/**
 * Plain text extracted from a TipTap doc — matches
 * `extractTextFromDoc` in `TemplateLayoutEditor.tsx` (character limit UX).
 */
function extractTextFromTipTapDoc(doc: unknown): string {
  const parts: string[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return;
    const n = node as Record<string, unknown>;
    if (n.type === "text" && typeof n.text === "string") {
      parts.push(n.text);
      return;
    }
    if (n.type === "hardBreak") {
      parts.push("\n");
      return;
    }
    const t = n.type;
    const isBlock = t === "paragraph" || t === "heading" || t === "blockquote";
    if (Array.isArray(n.content)) {
      for (const child of n.content) walk(child);
      if (isBlock) parts.push("\n");
    }
  };
  walk(doc);
  return parts
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Total rich-text character count across all `richText` regions (for channel limits). */
export function countRichTextCharactersInLayout(
  layout: TemplateLayoutConfig,
): number {
  let total = 0;
  for (const row of layout.rows) {
    for (const cell of row.cells) {
      for (const region of cell.regions) {
        if (region.type !== "richText") continue;
        const props = region.props as Record<string, unknown> | undefined;
        total += extractTextFromTipTapDoc(ensureRichDoc(props)).length;
      }
    }
  }
  return total;
}

export type StructuralRestrictions = {
  maxRows?: number;
  maxColumnsPerRow?: number;
  maxRichTextRegions?: number;
  maxMediaRegions?: number;
  maxFieldRegions?: number;
  maxTotalRegions?: number;
  allowedRegionSequences?: string[][];
  disallowInlineImagesInRichText?: boolean;
  /** Channel-level content model to validate rich-text ASTs against on save. */
  contentModel?: "whatsapp" | "sms" | "push";
};

function countImageNodesInTipTapDoc(doc: unknown): number {
  let n = 0;
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return;
    const rec = node as Record<string, unknown>;
    if (rec.type === "image") n++;
    if (Array.isArray(rec.content)) {
      for (const c of rec.content) walk(c);
    }
  };
  walk(doc);
  return n;
}

/** `<mediaKey>` placeholders inserted as plain text (toolbar "Add media token"). */
const MEDIA_PLACEHOLDER_IN_TEXT = /<[a-zA-Z_][a-zA-Z0-9_]*>/g;

function countMediaPlaceholderTagsInTipTapDoc(doc: unknown): number {
  let n = 0;
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return;
    const rec = node as Record<string, unknown>;
    if (rec.type === "text" && typeof rec.text === "string") {
      MEDIA_PLACEHOLDER_IN_TEXT.lastIndex = 0;
      const m = rec.text.match(MEDIA_PLACEHOLDER_IN_TEXT);
      if (m) n += m.length;
      return;
    }
    if (Array.isArray(rec.content)) {
      for (const c of rec.content) walk(c);
    }
  };
  walk(doc);
  return n;
}

/** Counts TipTap inline `image` nodes across all richText regions. */
export function countInlineImageNodesInLayout(
  layout: TemplateLayoutConfig,
): number {
  let total = 0;
  for (const row of layout.rows) {
    for (const cell of row.cells) {
      for (const region of cell.regions) {
        if (region.type !== "richText") continue;
        const props = region.props as Record<string, unknown> | undefined;
        total += countImageNodesInTipTapDoc(ensureRichDoc(props));
      }
    }
  }
  return total;
}

/** Counts `<mediaKey>` style tokens in richText TipTap docs. */
export function countMediaPlaceholderTokensInLayout(
  layout: TemplateLayoutConfig,
): number {
  let total = 0;
  for (const row of layout.rows) {
    for (const cell of row.cells) {
      for (const region of cell.regions) {
        if (region.type !== "richText") continue;
        const props = region.props as Record<string, unknown> | undefined;
        total += countMediaPlaceholderTagsInTipTapDoc(ensureRichDoc(props));
      }
    }
  }
  return total;
}

// ─── Content-model helpers ───────────────────────────────────────────────────

type TipTapNode = {
  type?: string;
  text?: string;
  content?: TipTapNode[];
  marks?: { type: string }[];
  attrs?: Record<string, unknown>;
};

/**
 * Field tokens: {{fieldName}} — inserted by "Add field token".
 * These appear as plain text inside TipTap text nodes.
 */
const FIELD_TOKEN_RE = /\{\{\s*[a-zA-Z_][a-zA-Z0-9_.]*\s*\}\}/g;

/**
 * Media tokens: <mediaKey> — inserted by "Add media token".
 * These appear as plain text inside TipTap text nodes.
 * Deliberately tight: identifier-only, no spaces, to avoid matching real HTML tags.
 */
const MEDIA_TOKEN_RE = /<[a-zA-Z_][a-zA-Z0-9_]*>/g;

/**
 * URL pattern for SMS — bare https?:// or www. links are valid in SMS body.
 * We strip these (along with tokens) before checking for leftover non-plain content.
 */
const URL_RE = /https?:\/\/[^\s]+|www\.[^\s]+/g;

/**
 * Strip field tokens, media tokens, and URLs from a text string.
 * Whatever remains is "pure prose".
 */
function stripAllTokens(text: string): string {
  return text
    .replace(FIELD_TOKEN_RE, "")
    .replace(MEDIA_TOKEN_RE, "")
    .replace(URL_RE, "")
    .trim();
}

/** Collect all inline nodes from the top-level paragraph children of a doc. */
function collectInlineNodes(doc: unknown): TipTapNode[] {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return [];
  const root = doc as TipTapNode;
  const inlines: TipTapNode[] = [];
  const collectFromBlock = (block: TipTapNode): void => {
    if (!Array.isArray(block.content)) return;
    for (const child of block.content) {
      if (!child.type) continue;
      // recurse into list items, blockquote, heading, etc.
      if (
        child.type === "bulletList" ||
        child.type === "orderedList" ||
        child.type === "listItem" ||
        child.type === "blockquote" ||
        child.type === "heading"
      ) {
        collectFromBlock(child);
      } else {
        inlines.push(child);
      }
    }
  };
  if (Array.isArray(root.content)) {
    for (const block of root.content) {
      collectFromBlock(block as TipTapNode);
    }
  }
  return inlines;
}

/**
 * Check whether a text node's content is purely field tokens / media tokens / URLs / whitespace.
 * Such nodes are considered "token-only" and do not count as prose text.
 */
function isTokenOnlyText(text: string): boolean {
  return stripAllTokens(text).length === 0;
}

/** Mark types that SMS cannot render meaningfully. */
const SMS_RICH_MARKS = new Set([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "highlight",
]);

// ─── Per-channel content validators ─────────────────────────────────────────

/**
 * WhatsApp content rules — all content lives inside richText blocks.
 *
 * WhatsApp messages map to one of these wire formats:
 *   1. Text-only      → a richText with only text / {{field}} / formatting. No images.
 *   2. Media-only     → a richText whose FIRST paragraph-level node is an image
 *                       (inline TipTap image) or <mediaToken>, with nothing else.
 *   3. Media + caption→ a richText where the FIRST paragraph is an image/mediaToken
 *                       and subsequent paragraphs hold the caption text / {{field}}.
 *
 * What is NOT allowed:
 *   • Text appearing BEFORE an image/mediaToken within the same richText block
 *     ("text sandwich" — WhatsApp can't render this).
 *   • Multiple images or mediaTokens inside a single richText block.
 */
function validateWhatsAppContent(layout: TemplateLayoutConfig): string[] {
  const msgs: string[] = [];

  for (const row of layout.rows) {
    for (const cell of row.cells) {
      for (const region of cell.regions) {
        if (region.type !== "richText") continue;
        const props = region.props as Record<string, unknown> | undefined;
        const doc = ensureRichDoc(props) as TipTapNode;
        if (!Array.isArray(doc.content)) continue;

        // Flatten top-level block nodes (paragraphs) preserving order
        const blocks = doc.content as TipTapNode[];

        let imageCount = 0;
        let imageBlockIndex = -1; // which block (paragraph index) holds the image
        let proseBeforeImage = false;

        blocks.forEach((block, blockIdx) => {
          if (!Array.isArray(block.content)) return;
          for (const node of block.content as TipTapNode[]) {
            if (node.type === "image") {
              imageCount++;
              if (imageBlockIndex === -1) imageBlockIndex = blockIdx;
              // Any prose block BEFORE the image block is a sandwich
              if (blockIdx > 0) proseBeforeImage = true;
            } else if (node.type === "text" && typeof node.text === "string") {
              MEDIA_TOKEN_RE.lastIndex = 0;
              const hasMediaTok = MEDIA_TOKEN_RE.test(node.text);
              if (hasMediaTok) {
                imageCount++;
                if (imageBlockIndex === -1) imageBlockIndex = blockIdx;
                if (blockIdx > 0) proseBeforeImage = true;
              }
            }
          }
        });

        if (imageCount > 1) {
          msgs.push(
            `WhatsApp: A text block contains ${imageCount} images/media tokens. ` +
              `WhatsApp supports only one photo or video per message. ` +
              `Split them into separate blocks.`,
          );
        }

        if (proseBeforeImage) {
          msgs.push(
            `WhatsApp: A text block has text before an image or media token. ` +
              `WhatsApp only supports image-first layout: put the image at the top of the block, ` +
              `with optional caption text below it.`,
          );
        }
      }
    }
  }

  return msgs;
}

/**
 * SMS content rules — all content lives inside a single richText block.
 *
 * SMS delivers raw plain text over the wire. Only the following are valid:
 *   • Plain prose text
 *   • Field tokens {{fieldName}}
 *   • Bare URLs (https://… or www.…)
 *
 * Not supported:
 *   • Inline images (TipTap image nodes)
 *   • Media tokens <mediaKey>
 *   • Rich formatting marks (bold, italic, underline, etc.) — silently dropped by carriers
 */
function validateSmsContent(layout: TemplateLayoutConfig): string[] {
  const msgs: string[] = [];

  for (const row of layout.rows) {
    for (const cell of row.cells) {
      for (const region of cell.regions) {
        if (region.type !== "richText") continue;
        const props = region.props as Record<string, unknown> | undefined;
        const doc = ensureRichDoc(props) as TipTapNode;

        const inlines = collectInlineNodes(doc);
        const badMarks = new Set<string>();

        for (const node of inlines) {
          if (node.type === "image") {
            msgs.push(
              `SMS: Contains an inline image. SMS is plain text only — remove the image.`,
            );
          } else if (node.type === "text" && typeof node.text === "string") {
            MEDIA_TOKEN_RE.lastIndex = 0;
            if (MEDIA_TOKEN_RE.test(node.text)) {
              msgs.push(
                `SMS: Contains a media token (e.g. <photoUrl>). ` +
                  `SMS cannot deliver media — use a field token {{fieldName}} for dynamic text instead.`,
              );
            }
            // Flag unsupported marks
            for (const mark of node.marks ?? []) {
              if (SMS_RICH_MARKS.has(mark.type)) badMarks.add(mark.type);
            }
          }
        }

        if (badMarks.size > 0) {
          msgs.push(
            `SMS: Rich formatting (${[...badMarks].join(", ")}) is stripped by carriers — ` +
              `use plain text only. Field tokens {{field}} and links are fine.`,
          );
        }
      }
    }
  }

  return msgs;
}

/**
 * Push notification content rules — all content lives inside richText blocks.
 *
 * Push supports:
 *   • Title richText: plain text + {{field}} tokens — keep it short.
 *   • Body richText:  plain text + {{field}} tokens.
 *   • An optional image is delivered as a separate richText block where the
 *     FIRST and ONLY paragraph-level node is an inline image or <mediaToken>.
 *     Nothing else should appear in that block (push providers treat the image
 *     as a top-level attachment, not inline content).
 *
 * Not supported inside title/body richText blocks:
 *   • Inline images mixed with text
 *   • Media tokens mixed with text (use a dedicated image-only block)
 */
function validatePushContent(layout: TemplateLayoutConfig): string[] {
  const msgs: string[] = [];

  for (const row of layout.rows) {
    for (const cell of row.cells) {
      for (const region of cell.regions) {
        if (region.type !== "richText") continue;
        const props = region.props as Record<string, unknown> | undefined;
        const doc = ensureRichDoc(props) as TipTapNode;
        const blocks = Array.isArray(doc.content)
          ? (doc.content as TipTapNode[])
          : [];

        // Determine if this block is a pure-image block (only one paragraph with one image/mediaToken)
        const isPureImageBlock =
          blocks.length === 1 &&
          Array.isArray(blocks[0].content) &&
          (blocks[0].content as TipTapNode[]).length === 1 &&
          ((blocks[0].content as TipTapNode[])[0].type === "image" ||
            ((blocks[0].content as TipTapNode[])[0].type === "text" &&
              typeof (blocks[0].content as TipTapNode[])[0].text === "string" &&
              (() => {
                MEDIA_TOKEN_RE.lastIndex = 0;
                return MEDIA_TOKEN_RE.test(
                  (blocks[0].content as TipTapNode[])[0].text!,
                );
              })()));

        if (isPureImageBlock) continue; // valid image-only block — OK

        // For all other blocks, images and media tokens mixed with text are not valid
        const inlines = collectInlineNodes(doc);
        for (const node of inlines) {
          if (node.type === "image") {
            msgs.push(
              `Push: An inline image is mixed with text in a block. ` +
                `For the notification image, use a dedicated block that contains only the image (no surrounding text).`,
            );
            break;
          }
          if (node.type === "text" && typeof node.text === "string") {
            MEDIA_TOKEN_RE.lastIndex = 0;
            if (MEDIA_TOKEN_RE.test(node.text) && !isTokenOnlyText(node.text)) {
              msgs.push(
                `Push: A media token (e.g. <imageUrl>) is mixed with prose text. ` +
                  `Use a dedicated block containing only the media token for the notification image.`,
              );
              break;
            }
          }
        }
      }
    }
  }

  return msgs;
}

const CONTENT_VALIDATORS: Record<
  string,
  (layout: TemplateLayoutConfig) => string[]
> = {
  whatsapp: validateWhatsAppContent,
  sms: validateSmsContent,
  push: validatePushContent,
};

/**
 * Validates a parsed layout against a channel's structural restrictions.
 * Returns an array of violation messages (empty = valid).
 */
export function validateLayoutStructure(
  layout: TemplateLayoutConfig,
  restrictions: StructuralRestrictions,
): string[] {
  const msgs: string[] = [];
  const fin = (v: unknown): v is number =>
    typeof v === "number" && Number.isFinite(v) && v >= 0;

  if (fin(restrictions.maxRows) && layout.rows.length > restrictions.maxRows) {
    msgs.push(
      `Max ${restrictions.maxRows} row(s) allowed; layout has ${layout.rows.length}.`,
    );
  }

  if (fin(restrictions.maxColumnsPerRow)) {
    for (const row of layout.rows) {
      if (row.cells.length > restrictions.maxColumnsPerRow!) {
        msgs.push(
          `Max ${restrictions.maxColumnsPerRow} column(s) per row allowed.`,
        );
        break;
      }
    }
  }

  let richText = 0;
  let media = 0;
  let field = 0;
  let total = 0;
  for (const row of layout.rows) {
    for (const cell of row.cells) {
      for (const region of cell.regions) {
        total++;
        if (region.type === "richText") richText++;
        else if (region.type === "media") media++;
        else if (region.type === "field") field++;
      }
    }
  }

  if (
    fin(restrictions.maxRichTextRegions) &&
    richText > restrictions.maxRichTextRegions!
  ) {
    msgs.push(
      `Max ${restrictions.maxRichTextRegions} text block(s) allowed; layout has ${richText}.`,
    );
  }
  if (
    fin(restrictions.maxMediaRegions) &&
    media > restrictions.maxMediaRegions!
  ) {
    msgs.push(
      `Max ${restrictions.maxMediaRegions} media block(s) allowed; layout has ${media}.`,
    );
  }
  if (
    fin(restrictions.maxFieldRegions) &&
    field > restrictions.maxFieldRegions!
  ) {
    msgs.push(
      `Max ${restrictions.maxFieldRegions} field block(s) allowed; layout has ${field}.`,
    );
  }
  if (
    fin(restrictions.maxTotalRegions) &&
    total > restrictions.maxTotalRegions!
  ) {
    msgs.push(
      `Max ${restrictions.maxTotalRegions} total block(s) allowed; layout has ${total}.`,
    );
  }

  if (
    Array.isArray(restrictions.allowedRegionSequences) &&
    restrictions.allowedRegionSequences.length > 0
  ) {
    for (const row of layout.rows) {
      for (const cell of row.cells) {
        const seq = cell.regions.map((r) => r.type);
        if (seq.length === 0) continue;
        const ok = restrictions.allowedRegionSequences.some(
          (allowed) =>
            allowed.length === seq.length &&
            allowed.every((t, i) => t === seq[i]),
        );
        if (!ok) {
          const seqStr = seq.join(" \u2192 ");
          const allowedStr = restrictions.allowedRegionSequences
            .map((s) => s.join("+"))
            .join(", ");
          msgs.push(
            `Block sequence [${seqStr}] is not allowed (valid: ${allowedStr}).`,
          );
        }
      }
    }
  }

  // Legacy flag — kept for backwards compat but superseded by contentModel:"whatsapp"
  if (
    restrictions.disallowInlineImagesInRichText === true &&
    restrictions.contentModel !== "whatsapp"
  ) {
    const img = countInlineImageNodesInLayout(layout);
    const tok = countMediaPlaceholderTokensInLayout(layout);
    if (img > 0 || tok > 0) {
      const parts: string[] = [];
      if (img > 0)
        parts.push(
          `${img} inline image(s) embedded in text — use a dedicated Media block instead`,
        );
      if (tok > 0)
        parts.push(
          `${tok} media token(s) (e.g. <key>) in a standalone text block — pair them with a Media block above`,
        );
      msgs.push(
        `This channel does not support embedded media inside text blocks: ${parts.join("; ")}.`,
      );
    }
  }

  // Per-channel content model validation (runs last so structural msgs appear first)
  if (restrictions.contentModel) {
    const validator = CONTENT_VALIDATORS[restrictions.contentModel];
    if (validator) msgs.push(...validator(layout));
  }

  return msgs;
}

/**
 * Validates and normalizes layout JSON. Returns null if invalid.
 * Accepts v2 `rows` (grid) or legacy v1 flat `regions`.
 */
export function parseAndValidateLayoutConfig(
  layout: unknown,
): TemplateLayoutConfig | null {
  return parseTemplateLayout(layout);
}

function deepCloneJson<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Clone helper: new IDs for rows, cells, and regions (used when cloning a template). */
export function regenerateLayoutIds(layout: unknown): unknown {
  const parsed = parseAndValidateLayoutConfig(layout);
  if (!parsed) return layout;
  return {
    version: parsed.version,
    rows: parsed.rows.map((row) => ({
      ...row,
      id: randomUUID(),
      cells: row.cells.map((cell) => ({
        ...cell,
        id: randomUUID(),
        regions: cell.regions.map((r) => ({
          ...r,
          id: randomUUID(),
          props: r.props ? deepCloneJson(r.props) : undefined,
        })),
      })),
    })),
  };
}
