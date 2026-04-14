import { Mark, mergeAttributes } from '@tiptap/core';
import type { CitationMarkerMode } from '../lib/citationMarkers';

export const CitationMarker = Mark.create({
  name: 'citationMarker',
  inclusive: false,

  addAttributes() {
    return {
      marker: {
        default: 1,
        parseHTML: (el) => parseInt((el as HTMLElement).getAttribute('data-citation') || '1', 10),
      },
      mode: {
        default: 'chip' satisfies CitationMarkerMode,
        parseHTML: (el) => {
          const n = el as HTMLElement;
          if (n.classList.contains('citation-marker--paren')) return 'paren';
          if (n.classList.contains('citation-marker--raised')) return 'raised';
          return 'chip';
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-citation]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const mode = (HTMLAttributes.mode as CitationMarkerMode) || 'chip';
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: `citation-marker citation-marker--${mode}`,
        'data-citation': String(HTMLAttributes.marker),
      }),
      0,
    ];
  },
});

export function citationMarkLabel(marker: number, mode: CitationMarkerMode): string {
  return mode === 'paren' ? `(${marker})` : `[${marker}]`;
}
