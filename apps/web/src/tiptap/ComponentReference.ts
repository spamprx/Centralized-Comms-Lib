import { Node, mergeAttributes } from '@tiptap/core';

/**
 * Block that points at a `ComponentVersion` in the registry.
 * `attrs.componentVersionId` is what the API uses to refresh linked bodies on save.
 */
export const ComponentReference = Node.create({
  name: 'componentReference',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      componentVersionId: {
        default: null as string | null,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-component-version-id'),
      },
      componentKey: {
        default: '',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-component-key') ?? '',
      },
      componentName: {
        default: '',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-component-name') ?? '',
      },
      mode: {
        default: 'linked',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-component-mode') ?? 'linked',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-component-version-id]',
        getAttrs: (el) => {
          const node = el as HTMLElement;
          const id = node.getAttribute('data-component-version-id');
          if (!id) return false;
          return {
            componentVersionId: id,
            componentKey: node.getAttribute('data-component-key') ?? '',
            componentName: node.getAttribute('data-component-name') ?? '',
            mode: node.getAttribute('data-component-mode') ?? 'linked',
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    const { componentVersionId, componentKey, componentName, mode } = node.attrs as {
      componentVersionId: string | null;
      componentKey: string;
      componentName: string;
      mode: string;
    };
    const label =
      mode === 'linked'
        ? `Linked · ${componentName || componentKey || 'Component'} — updates when this library version changes.`
        : `Reference · ${componentName || componentKey || 'Component'}`;
    return [
      'div',
      mergeAttributes({
        class: 'component-reference',
        'data-component-version-id': componentVersionId ?? '',
        'data-component-key': componentKey,
        'data-component-name': componentName,
        'data-component-mode': mode,
      }),
      ['span', { class: 'component-reference-label' }, label],
    ];
  },
});
