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
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative mb-3 shrink-0">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-app-faint" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, key, or description…"
          className="box-border w-full rounded-app-md border border-app-border/80 bg-app-bg/40 py-2.5 pl-9 pr-9 text-[13px] text-app-text outline-none placeholder:text-app-faint focus:border-app-accent/35"
          aria-label="Search components"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-app-faint transition-colors hover:bg-app-elevated hover:text-app-muted"
            title="Clear search"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>

      <div className="mb-2 shrink-0 rounded-app-md border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-[10px] leading-snug text-amber-200/90">
        Demo data — replace with <span className="font-mono text-[9px]">componentService.list()</span> when the API is ready.
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-app-md border border-app-border/60 bg-app-bg/25">
        {items.length === 0 ? (
          <div className="p-4 text-[13px] text-app-faint">
            {mockEditorComponents.length > 0
              ? 'No components match your search.'
              : 'No components in the library.'}
          </div>
        ) : (
          <ul className="m-0 list-none divide-y divide-app-border/50 p-0">
            {items.map((comp) => (
              <li key={comp.id} className="p-3">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-app-text">{comp.name}</div>
                  <div className="mt-0.5 truncate font-mono text-[11px] text-violet-300/90">{comp.key}</div>
                  {comp.description ? (
                    <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-app-muted">{comp.description}</p>
                  ) : null}
                </div>
                <div className="mt-2.5 flex flex-col gap-1.5">
                  <button
                    type="button"
                    disabled={!editor}
                    onClick={() => insert('linked', comp)}
                    className="flex items-center justify-center gap-1.5 rounded-app-md border border-violet-500/35 bg-violet-500/12 px-2.5 py-2 text-[11px] font-medium text-violet-200 transition-colors hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-45"
                    title="Inserts a paragraph marked as linked (live-sync) usage"
                  >
                    <Link2 size={13} strokeWidth={2.25} />
                    Insert linked
                  </button>
                  <button
                    type="button"
                    disabled={!editor}
                    onClick={() => insert('detached', comp)}
                    className="flex items-center justify-center gap-1.5 rounded-app-md border border-cyan-500/35 bg-cyan-500/10 px-2.5 py-2 text-[11px] font-medium text-cyan-200 transition-colors hover:bg-cyan-500/18 disabled:cursor-not-allowed disabled:opacity-45"
                    title="Inserts a paragraph marked as detached (snapshot) usage"
                  >
                    <Copy size={13} strokeWidth={2.25} />
                    Insert snapshot
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-3 shrink-0 text-[10px] leading-relaxed text-app-faint">
        <span className="text-violet-300/80">Linked</span> blocks stay tied to the registry component;{' '}
        <span className="text-cyan-300/80">Snapshot</span> blocks are a fixed copy at insert time.
      </p>
    </div>
  );
}
