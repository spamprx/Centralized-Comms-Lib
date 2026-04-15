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
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
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
