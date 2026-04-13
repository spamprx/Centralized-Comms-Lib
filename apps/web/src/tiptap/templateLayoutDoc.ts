/**
 * TipTap document nodes + JSON bridge for template layouts (rows / resizable columns).
 * Register `templateLayoutDocExtensions` alongside StarterKit in any editor that should
 * load the same layout structure as the template builder (e.g. content pages).
 */
import { Node, mergeAttributes } from '@tiptap/core';
import type { JSONContent } from '@tiptap/core';
import type { LayoutCell, LayoutRow, TemplateLayoutConfig, TemplateLayoutRegion } from '../services/templateCrudService';
import { LAYOUT_VERSION } from '../lib/templateLayout/layoutConfig';

const RT = 'richText';
const MEDIA = 'media';
const FIELD = 'field';

export const LayoutRowNode = Node.create({
  name: 'layoutRow',
  group: 'block',
  content: 'layoutCell+',
  defining: true,
  addAttributes() {
    return {
      rowId: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-layout-row]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-layout-row': 'true', class: 'template-layout-row' }), 0];
  },
});

export const LayoutCellNode = Node.create({
  name: 'layoutCell',
  group: 'layoutCell',
  content: 'region',
  isolating: true,
  addAttributes() {
    return {
      cellId: { default: null },
      flexGrow: { default: 1 },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-layout-cell]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const flex = Number(node.attrs.flexGrow) || 1;
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-layout-cell': 'true',
        class: 'template-layout-cell',
        style: `flex:${flex} 1 0%;min-width:0`,
      }),
      0,
    ];
  },
});

export const RegionRichTextNode = Node.create({
  name: 'regionRichText',
  group: 'region',
  content: 'block+',
  addAttributes() {
    return {
      regionId: { default: null },
      sectionTitle: { default: '' },
      editorPlaceholder: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-region-rich-text]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-region-rich-text': 'true' }), 0];
  },
});

export const RegionMediaNode = Node.create({
  name: 'regionMedia',
  group: 'region',
  atom: true,
  addAttributes() {
    return {
      regionId: { default: null },
      role: { default: 'inline' },
      alt: { default: '' },
      caption: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'figure[data-region-media]' }];
  },
  renderHTML({ node }) {
    const caption = String(node.attrs.caption ?? '');
    return ['figure', { 'data-region-media': 'true', class: 'template-region-media' }, ['figcaption', {}, caption]];
  },
});

export const RegionFieldNode = Node.create({
  name: 'regionField',
  group: 'region',
  atom: true,
  addAttributes() {
    return {
      regionId: { default: null },
      fieldKey: { default: '' },
      label: { default: '' },
      helpText: { default: '' },
      required: { default: false },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-region-field]' }];
  },
  renderHTML({ node }) {
    const k = String(node.attrs.fieldKey ?? '');
    return ['div', { 'data-region-field': 'true', class: 'template-region-field' }, `{{${k}}}`];
  },
});

/** Pass into useEditor({ extensions: [...StarterKit..., ...templateLayoutDocExtensions] }) */
export const templateLayoutDocExtensions = [
  LayoutRowNode,
  LayoutCellNode,
  RegionRichTextNode,
  RegionMediaNode,
  RegionFieldNode,
];

function regionToDocNodes(region: TemplateLayoutRegion): JSONContent {
  const id = region.id;
  const props = (region.props ?? {}) as Record<string, unknown>;

  if (region.type === RT) {
    const doc = props.doc as JSONContent | undefined;
    const inner = doc && doc.type === 'doc' && Array.isArray(doc.content) ? doc.content : [];
    return {
      type: 'regionRichText',
      attrs: {
        regionId: id,
        sectionTitle: String(props.sectionTitle ?? ''),
        editorPlaceholder: String(props.editorPlaceholder ?? ''),
      },
      content: inner.length ? inner : [{ type: 'paragraph' }],
    };
  }

  if (region.type === MEDIA) {
    return {
      type: 'regionMedia',
      attrs: {
        regionId: id,
        role: String(props.role ?? 'inline'),
        alt: String(props.alt ?? ''),
        caption: String(props.caption ?? ''),
      },
    };
  }

  if (region.type === FIELD) {
    return {
      type: 'regionField',
      attrs: {
        regionId: id,
        fieldKey: String(props.fieldKey ?? ''),
        label: String(props.label ?? ''),
        helpText: String(props.helpText ?? ''),
        required: Boolean(props.required),
      },
    };
  }

  return {
    type: 'regionRichText',
    attrs: { regionId: id, sectionTitle: '', editorPlaceholder: '' },
    content: [{ type: 'paragraph' }],
  };
}

/** Canonical TipTap `doc` JSON for a template layout (for content editor / persistence). */
export function layoutConfigToTipTapDoc(config: TemplateLayoutConfig): JSONContent {
  const rows = config.rows ?? [];
  if (rows.length === 0) {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }

  const content: JSONContent[] = rows.map((row) => ({
    type: 'layoutRow',
    attrs: { rowId: row.id },
    content: row.cells.map((cell) => ({
      type: 'layoutCell',
      attrs: { cellId: cell.id, flexGrow: cell.flexGrow },
      content: [regionToDocNodes(cell.region)],
    })),
  }));

  return { type: 'doc', content };
}

function docNodeToRegion(node: JSONContent): TemplateLayoutRegion | null {
  if (!node || typeof node !== 'object') return null;
  const id = crypto.randomUUID();

  if (node.type === 'regionRichText') {
    const a = (node.attrs ?? {}) as Record<string, unknown>;
    const inner = Array.isArray(node.content) ? node.content : [];
    return {
      id: String(a.regionId ?? id),
      type: RT,
      props: {
        sectionTitle: String(a.sectionTitle ?? ''),
        editorPlaceholder: String(a.editorPlaceholder ?? ''),
        doc: { type: 'doc', content: inner },
      },
    };
  }

  if (node.type === 'regionMedia') {
    const a = (node.attrs ?? {}) as Record<string, unknown>;
    return {
      id: String(a.regionId ?? id),
      type: MEDIA,
      props: {
        role: a.role,
        alt: String(a.alt ?? ''),
        caption: String(a.caption ?? ''),
        variant: 'placeholder',
      },
    };
  }

  if (node.type === 'regionField') {
    const a = (node.attrs ?? {}) as Record<string, unknown>;
    return {
      id: String(a.regionId ?? id),
      type: FIELD,
      props: {
        fieldKey: String(a.fieldKey ?? ''),
        label: String(a.label ?? ''),
        helpText: String(a.helpText ?? ''),
        required: Boolean(a.required),
      },
    };
  }

  return null;
}

/** Recover layout config from a TipTap document that uses templateLayoutDocExtensions. */
export function tipTapDocToLayoutConfig(doc: JSONContent): TemplateLayoutConfig | null {
  if (!doc || doc.type !== 'doc' || !Array.isArray(doc.content)) return null;
  const rows: LayoutRow[] = [];

  for (const block of doc.content) {
    if (!block || typeof block !== 'object' || block.type !== 'layoutRow' || !Array.isArray(block.content)) continue;
    const rowId = String((block.attrs as { rowId?: string })?.rowId ?? crypto.randomUUID());
    const cells: LayoutCell[] = [];

    for (const cellNode of block.content) {
      if (!cellNode || typeof cellNode !== 'object' || cellNode.type !== 'layoutCell' || !Array.isArray(cellNode.content))
        continue;
      const cellId = String((cellNode.attrs as { cellId?: string })?.cellId ?? crypto.randomUUID());
      const flexGrow = Number((cellNode.attrs as { flexGrow?: number })?.flexGrow);
      const inner = cellNode.content[0];
      const region = docNodeToRegion(inner);
      if (!region) continue;
      cells.push({
        id: cellId,
        flexGrow: Number.isFinite(flexGrow) && flexGrow > 0 ? flexGrow : 1,
        region,
      });
    }

    if (cells.length) rows.push({ id: rowId, cells });
  }

  if (rows.length === 0) return null;
  return { version: LAYOUT_VERSION, rows };
}
