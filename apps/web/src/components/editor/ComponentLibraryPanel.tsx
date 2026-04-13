import { useMemo, useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';
import { Copy, Link2, Search, X } from 'lucide-react';
import type { ComponentRecord } from '../../services/componentService';
import { mockEditorComponents } from '../../data/mockEditorComponents';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

function insertFragmentForComponent(mode: 'linked' | 'detached', comp: ComponentRecord): JSONContent {
  const badge = mode === 'linked' ? 'Linked' : 'Snapshot';
  return {
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text: `${badge} · `,
        marks: [{ type: 'bold' }],
      },
      { type: 'text', text: comp.name },
      { type: 'text', text: ' · ' },
      {
        type: 'text',
        text: comp.key,
        marks: [{ type: 'italic' }],
      },
    ],
  };
}

type ComponentLibraryPanelProps = {
  editor: Editor | null;
};

export default function ComponentLibraryPanel({ editor }: ComponentLibraryPanelProps) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 280);

  const items = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return mockEditorComponents;
    return mockEditorComponents.filter(
      (c) =>
        c.key.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.description?.toLowerCase().includes(q) ?? false),
    );
  }, [debouncedQuery]);

  const insert = (mode: 'linked' | 'detached', comp: ComponentRecord) => {
    if (!editor) return;
    editor.chain().focus().insertContent(insertFragmentForComponent(mode, comp)).run();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="relative shrink-0">
        <Search
          size={14}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--editor-faint)]"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search components…"
          className="box-border w-full rounded-[var(--editor-radius-input)] border-[0.5px] border-[var(--editor-border)] bg-[var(--editor-card-bg)] py-2 pl-8 pr-8 text-[12px] text-[var(--editor-doc-text)] outline-none placeholder:text-[var(--editor-faint)] focus:border-[var(--editor-primary)]"
          aria-label="Search components"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-[var(--editor-radius-input)] p-1 text-[var(--editor-faint)] transition-colors hover:bg-[var(--editor-canvas-bg)] hover:text-[var(--editor-muted)]"
            title="Clear search"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-[var(--editor-radius-input)] border-[0.5px] border-[var(--editor-border)] bg-[var(--editor-card-bg)]">
        {items.length === 0 ? (
          <div className="p-3 text-[12px] text-[var(--editor-faint)]">
            {mockEditorComponents.length > 0
              ? 'No components match your search.'
              : 'No components in the library.'}
          </div>
        ) : (
          <ul className="m-0 list-none divide-y divide-[var(--editor-border)] p-0">
            {items.map((comp) => (
              <li key={comp.id} className="p-2.5">
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-semibold text-[var(--editor-doc-text)]">
                    {comp.name}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[11px] text-[var(--editor-muted)]">
                    {comp.key}
                  </div>
                  {comp.description ? (
                    <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[var(--editor-muted)]">
                      {comp.description}
                    </p>
                  ) : null}
                </div>
                <div className="mt-2 flex gap-1.5">
                  <button
                    type="button"
                    disabled={!editor}
                    onClick={() => insert('linked', comp)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-[var(--editor-radius-input)] border-[0.5px] border-[var(--editor-primary)] bg-transparent px-2 py-1.5 text-[11px] font-medium text-[var(--editor-primary)] transition-colors hover:bg-[var(--editor-primary-muted)] disabled:cursor-not-allowed disabled:opacity-40"
                    title="Insert linked usage"
                  >
                    <Link2 size={12} strokeWidth={2.25} />
                    Linked
                  </button>
                  <button
                    type="button"
                    disabled={!editor}
                    onClick={() => insert('detached', comp)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-[var(--editor-radius-input)] border-[0.5px] border-transparent bg-[var(--editor-primary)] px-2 py-1.5 text-[11px] font-medium text-[var(--editor-primary-fg)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Insert snapshot copy"
                  >
                    <Copy size={12} strokeWidth={2.25} />
                    Snapshot
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
