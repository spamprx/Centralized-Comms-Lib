import { useCallback, useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';
import { Copy, Link2, Search, X } from 'lucide-react';
import {
  componentService,
  type ComponentLibraryEntry,
} from '../../services/componentService';
import { mockEditorComponents } from '../../data/mockEditorComponents';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

function filterMockCatalog(q: string): ComponentLibraryEntry[] {
  const s = q.trim().toLowerCase();
  if (!s) return mockEditorComponents;
  return mockEditorComponents.filter(
    (c) =>
      c.key.toLowerCase().includes(s) ||
      c.name.toLowerCase().includes(s) ||
      (c.description?.toLowerCase().includes(s) ?? false),
  );
}

function isInsertableTipTapDoc(json: unknown): json is JSONContent {
  if (!json || typeof json !== 'object') return false;
  const o = json as Record<string, unknown>;
  return o.type === 'doc' && Array.isArray(o.content);
}

function insertFragmentForComponent(mode: 'linked' | 'detached', comp: ComponentLibraryEntry): JSONContent {
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

function deepCloneJson<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/**
 * **Snapshot** — embed a frozen copy of the component version’s TipTap document (no live link).
 * **Linked** — insert a `componentReference` node that stores `componentVersionId`; on save the API
 * replaces it with the latest canonical blocks from the registry.
 */
function insertFromLibrary(editor: Editor | null, mode: 'linked' | 'detached', comp: ComponentLibraryEntry) {
  if (!editor) return;

  if (mode === 'detached') {
    const raw = comp.latestVersion?.bodyJson;
    if (raw != null && isInsertableTipTapDoc(raw)) {
      editor.chain().focus().insertContent(deepCloneJson(raw)).run();
      return;
    }
    editor.chain().focus().insertContent(insertFragmentForComponent('detached', comp)).run();
    return;
  }

  // linked
  const vid = comp.latestVersion?.id;
  if (vid) {
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'componentReference',
        attrs: {
          componentVersionId: vid,
          componentKey: comp.key,
          componentName: comp.name,
          mode: 'linked',
        },
      })
      .run();
    return;
  }

  editor.chain().focus().insertContent(insertFragmentForComponent('linked', comp)).run();
}

type ComponentLibraryPanelProps = {
  editor: Editor | null;
  onCatalogSourceChange?: (source: 'loading' | 'api' | 'demo') => void;
};

export default function ComponentLibraryPanel({ editor, onCatalogSourceChange }: ComponentLibraryPanelProps) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 280);
  const [items, setItems] = useState<ComponentLibraryEntry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    onCatalogSourceChange?.('loading');
    setLoading(true);
    setLoadError(null);
    const q = debouncedQuery.trim();
    try {
      const data = q ? await componentService.search(q) : await componentService.list();
      setItems(data);
      onCatalogSourceChange?.('api');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load components';
      setLoadError(msg);
      setItems(filterMockCatalog(debouncedQuery));
      onCatalogSourceChange?.('demo');
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, onCatalogSourceChange]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

      {loadError ? (
        <p className="m-0 rounded-[var(--editor-radius-input)] border-[0.5px] border-amber-500/35 bg-amber-500/10 px-2 py-1.5 text-[11px] leading-snug text-amber-900 dark:text-amber-100/90">
          API: {loadError}. Showing offline catalog.
        </p>
      ) : null}

      {loading ? (
        <p className="m-0 text-[11px] text-[var(--editor-faint)]">Loading components…</p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto rounded-[var(--editor-radius-input)] border-[0.5px] border-[var(--editor-border)] bg-[var(--editor-card-bg)]">
        {!loading && items.length === 0 ? (
          <div className="p-3 text-[12px] text-[var(--editor-faint)]">
            {query.trim() ? 'No components match your search.' : 'No components in the library.'}
          </div>
        ) : (
          <ul className="m-0 list-none divide-y divide-[var(--editor-border)] p-0">
            {items.map((comp) => (
              <li key={comp.id} className="p-2.5">
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-semibold text-[var(--editor-doc-text)]">
                    {comp.name}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[11px] text-[var(--editor-muted)]">{comp.key}</div>
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
                    onClick={() => insertFromLibrary(editor, 'linked', comp)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-[var(--editor-radius-input)] border-[0.5px] border-[var(--editor-primary)] bg-transparent px-2 py-1.5 text-[11px] font-medium text-[var(--editor-primary)] transition-colors hover:bg-[var(--editor-primary-muted)] disabled:cursor-not-allowed disabled:opacity-40"
                    title="Insert live link to this component version (body refreshes from the library on save)"
                  >
                    <Link2 size={12} strokeWidth={2.25} />
                    Linked
                  </button>
                  <button
                    type="button"
                    disabled={!editor}
                    onClick={() => insertFromLibrary(editor, 'detached', comp)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-[var(--editor-radius-input)] border-[0.5px] border-transparent bg-[var(--editor-primary)] px-2 py-1.5 text-[11px] font-medium text-[var(--editor-primary-fg)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Insert a frozen copy of this version (edits here do not change the library)"
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
