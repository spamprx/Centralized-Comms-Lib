import { useCallback, useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';
import { Copy, Link2, Search, X } from 'lucide-react';
import { componentService, type ComponentLibraryEntry } from '../../services/componentService';
import { mockEditorComponents } from '../../data/mockEditorComponents';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

const COMPONENT_CATALOG_CACHE_KEY = 'component-library:api-catalog:v1';

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

function filterCatalog(items: ComponentLibraryEntry[], q: string): ComponentLibraryEntry[] {
  const s = q.trim().toLowerCase();
  if (!s) return items;
  return items.filter(
    (c) =>
      c.key.toLowerCase().includes(s) ||
      c.name.toLowerCase().includes(s) ||
      (c.description?.toLowerCase().includes(s) ?? false),
  );
}

function readCachedCatalog(): ComponentLibraryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(COMPONENT_CATALOG_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ComponentLibraryEntry[]) : [];
  } catch {
    return [];
  }
}

function writeCachedCatalog(items: ComponentLibraryEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(COMPONENT_CATALOG_CACHE_KEY, JSON.stringify(items));
  } catch {
    // ignore storage failures
  }
}

function isInsertableTipTapDoc(json: unknown): json is JSONContent {
  if (!json || typeof json !== 'object') return false;
  const o = json as Record<string, unknown>;
  return o.type === 'doc' && Array.isArray(o.content);
}

function insertFragmentForComponent(
  mode: 'linked' | 'detached',
  comp: ComponentLibraryEntry,
): JSONContent {
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
 * **Snapshot** — insert a frozen copy of the selected version's body; edits here never update the library.
 * **Linked** — insert a live reference (`componentVersionId`); propagation updates all linked usages safely.
 */
function insertFromLibrary(
  editor: Editor | null,
  mode: 'linked' | 'detached',
  comp: ComponentLibraryEntry,
) {
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

export default function ComponentLibraryPanel({
  editor,
  onCatalogSourceChange,
}: ComponentLibraryPanelProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<
    'ALL' | 'CONTENT' | 'MEDIA' | 'CTA' | 'LEGAL' | 'OTHER'
  >('ALL');
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
      const categoryFilter = category === 'ALL' ? undefined : category;
      const data = q
        ? await componentService.search(q, categoryFilter)
        : await componentService.list(categoryFilter);
      setItems(data);
      if (!q) writeCachedCatalog(data);
      onCatalogSourceChange?.('api');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load components';
      setLoadError(msg);
      const cached = readCachedCatalog();
      if (cached.length > 0) {
        setItems(filterCatalog(cached, debouncedQuery));
        onCatalogSourceChange?.('api');
      } else {
        // Last-resort demo fallback when API is unavailable and no cache exists.
        setItems(filterMockCatalog(debouncedQuery));
        onCatalogSourceChange?.('demo');
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, category, onCatalogSourceChange]);

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
          className="box-border w-full rounded-[var(--editor-radius-input)] border border-white/10 bg-white/[0.04] py-2 pl-8 pr-8 text-[12px] text-[var(--editor-doc-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none placeholder:text-[var(--editor-faint)] focus:border-[var(--editor-primary)]/50 focus:ring-2 focus:ring-[var(--editor-primary)]/15"
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
      <select
        value={category}
        onChange={(e) =>
          setCategory(e.target.value as 'ALL' | 'CONTENT' | 'MEDIA' | 'CTA' | 'LEGAL' | 'OTHER')
        }
        className="box-border w-full rounded-[var(--editor-radius-input)] border border-white/10 bg-white/[0.04] px-2 py-2 text-[12px] text-[var(--editor-doc-text)] outline-none"
        aria-label="Filter components by category"
      >
        <option value="ALL">All categories</option>
        <option value="CONTENT">Content</option>
        <option value="MEDIA">Media</option>
        <option value="CTA">CTA</option>
        <option value="LEGAL">Legal</option>
        <option value="OTHER">Other</option>
      </select>

      {loadError ? (
        <p className="m-0 rounded-[var(--editor-radius-input)] border border-amber-400/30 bg-amber-500/10 px-2 py-1.5 text-[11px] leading-snug text-amber-100/95">
          API: {loadError}. Showing cached/demo catalog.
        </p>
      ) : null}

      <p className="m-0 rounded-[var(--editor-radius-input)] border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[11px] leading-snug text-[var(--editor-muted)]">
        <span className="font-semibold text-[var(--editor-doc-text)]">Linked</span> keeps a live reference
        to the component version and receives safe propagation updates.{' '}
        <span className="font-semibold text-[var(--editor-doc-text)]">Snapshot</span> inserts a detached copy
        for one-off edits.
      </p>

      {loading ? (
        <p className="m-0 text-[11px] text-[var(--editor-faint)]">Loading components…</p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto rounded-[var(--editor-radius-input)] border border-white/10 bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        {!loading && items.length === 0 ? (
          <div className="p-3 text-[12px] text-[var(--editor-faint)]">
            {query.trim() ? 'No components match your search.' : 'No components in the library.'}
          </div>
        ) : (
          <ul className="m-0 list-none divide-y divide-white/[0.06] p-0">
            {items.map((comp) => (
              <li key={comp.id} className="p-2.5 transition-colors hover:bg-white/[0.03]">
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
                    onClick={() => insertFromLibrary(editor, 'linked', comp)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-[var(--editor-radius-input)] border border-[var(--editor-primary)]/45 bg-[var(--editor-primary-muted)] px-2 py-1.5 text-[11px] font-semibold text-[var(--editor-primary)] transition-colors hover:bg-[var(--editor-primary-muted)] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Linked: live reference that receives propagation updates"
                  >
                    <Link2 size={12} strokeWidth={2.25} />
                    Linked
                  </button>
                  <button
                    type="button"
                    disabled={!editor}
                    onClick={() => insertFromLibrary(editor, 'detached', comp)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-[var(--editor-radius-input)] border border-white/12 bg-gradient-to-r from-app-accent to-app-accent-2 px-2 py-1.5 text-[11px] font-semibold text-app-bg shadow-[0_0_16px_-6px_rgba(147,124,248,0.45)] transition-[filter] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Snapshot: detached copy that will not change with library updates"
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
