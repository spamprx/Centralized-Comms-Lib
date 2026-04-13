import type { JSONContent } from '@tiptap/core';
import type { TemplateLayoutConfig, TemplateRecord } from '../services/templateCrudService';

function parseTemplateLayout(raw: unknown): TemplateLayoutConfig | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.version !== 'number' || !Number.isInteger(o.version) || o.version < 1) return null;
  if (!Array.isArray(o.regions)) return null;
  for (const r of o.regions) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
    const reg = r as Record<string, unknown>;
    if (typeof reg.id !== 'string' || !reg.id.trim()) return null;
    if (typeof reg.type !== 'string' || !reg.type.trim()) return null;
    if (reg.props != null && (typeof reg.props !== 'object' || Array.isArray(reg.props))) return null;
  }
  return o as unknown as TemplateLayoutConfig;
}

function extractRichDoc(props: Record<string, unknown> | undefined): JSONContent | null {
  if (!props || typeof props !== 'object') return null;
  const doc = props.doc;
  if (doc && typeof doc === 'object' && !Array.isArray(doc) && (doc as JSONContent).type === 'doc') {
    return doc as JSONContent;
  }
  return null;
}

function starterFromName(name: string): JSONContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: name }],
      },
      { type: 'paragraph' },
    ],
  };
}

/**
 * Builds a single TipTap document from a template's active (or draft) layout so it can be loaded
 * into the article editor. Rich-text regions contribute their inner blocks; field regions become
 * a small heading + paragraph; media regions get a short placeholder line.
 */
export function tipTapDocFromTemplateRecord(record: TemplateRecord): JSONContent {
  const layout =
    parseTemplateLayout(record.activeLayout) ?? parseTemplateLayout(record.draftLayout);
  if (!layout?.regions?.length) {
    return starterFromName(record.name);
  }

  const merged: JSONContent[] = [];
  for (const region of layout.regions) {
    if (region.type === 'richText') {
      const props = region.props as Record<string, unknown> | undefined;
      const doc = extractRichDoc(props);
      const inner = doc?.content;
      if (Array.isArray(inner) && inner.length > 0) {
        merged.push(...inner);
      } else {
        merged.push({ type: 'paragraph' });
      }
    } else if (region.type === 'field') {
      const props = region.props as { label?: string } | undefined;
      const label =
        props && typeof props.label === 'string' && props.label.trim() ? props.label.trim() : 'Field';
      merged.push({
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: label }],
      });
      merged.push({ type: 'paragraph' });
    } else if (region.type === 'media') {
      merged.push({
        type: 'paragraph',
        content: [{ type: 'text', text: '[Media placeholder]', marks: [{ type: 'italic' }] }],
      });
    }
  }

  if (merged.length === 0) {
    return starterFromName(record.name);
  }
  return { type: 'doc', content: merged };
}
