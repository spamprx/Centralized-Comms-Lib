import type { JSONContent } from '@tiptap/core';
import type { TemplateRecord } from '../services/templateCrudService';
import { flattenRegions, parseTemplateLayout } from './templateLayout/layoutConfig';

function extractRichDoc(props: Record<string, unknown> | undefined): JSONContent | null {
  if (!props || typeof props !== 'object') return null;
  const doc = props.doc;
  if (
    doc &&
    typeof doc === 'object' &&
    !Array.isArray(doc) &&
    (doc as JSONContent).type === 'doc'
  ) {
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
  const regions = layout ? flattenRegions(layout) : [];
  if (!regions.length) {
    return starterFromName(record.name);
  }

  const merged: JSONContent[] = [];
  for (const region of regions) {
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
        props && typeof props.label === 'string' && props.label.trim()
          ? props.label.trim()
          : 'Field';
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
