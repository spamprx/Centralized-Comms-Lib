import { useCallback, useEffect, useState } from 'react';
import { BookMarked, Loader2, Search, X } from 'lucide-react';
import type { ContentSearchHit } from '../../services/searchService';
import { isLiveCitationSearchMode } from '../../config/citationSearch';
import {
  formatCitationLocal,
  searchReferences,
  toCitationWork,
  type CitationStyle,
} from '../../services/citationService';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { CitationMarkerMode } from '../../lib/citationMarkers';

function hitTitle(hit: ContentSearchHit): string {
  const s = hit.source;
  if (typeof s.title === 'string' && s.title.trim()) return s.title.trim();
  if (typeof s.name === 'string' && s.name.trim()) return s.name.trim();
  return 'Untitled';
}

function hitKey(hit: ContentSearchHit): string {
  const s = hit.source ?? {};
  const title = typeof (s as any).title === 'string' ? (s as any).title.trim() : '';
  const name = typeof (s as any).name === 'string' ? (s as any).name.trim() : '';
  const authorName =
    typeof (s as any).authorDisplayName === 'string'
      ? (s as any).authorDisplayName.trim()
      : typeof (s as any).authorName === 'string'
        ? (s as any).authorName.trim()
        : '';
  const authorsArr = Array.isArray((s as any).authors) ? (s as any).authors.map(String).join(',') : '';
  const container = typeof (s as any).container === 'string' ? (s as any).container.trim() : '';
  const year = (s as any).year != null ? String((s as any).year) : '';
  return [title || name, authorName || authorsArr, year, container].map((x) => x.toLowerCase()).join('|');
}

function dedupeHits(hits: ContentSearchHit[]): ContentSearchHit[] {
  const bestByKey = new Map<string, ContentSearchHit>();
  for (const h of hits) {
    const key = hitKey(h);
    const prev = bestByKey.get(key);
    if (!prev || (h.score ?? 0) > (prev.score ?? 0)) bestByKey.set(key, h);
  }
  return Array.from(bestByKey.values()).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

function isPublishedHit(hit: ContentSearchHit): boolean {
  const s = hit.source as any;
  const ls = typeof s?.lifecycleState === 'string' ? s.lifecycleState : '';
  if (ls) return ls.toUpperCase() === 'PUBLISHED';
  const status = typeof s?.status === 'string' ? s.status : '';
  if (status) return status.toLowerCase() === 'published';
  const published = s?.published;
  if (typeof published === 'boolean') return published;
  // If the search index doesn't provide lifecycle state metadata,
  // we conservatively hide it (only published content should be referenceable).
  return false;
}

function metaLine(hit: ContentSearchHit): string {
  const w = toCitationWork(hit);
  const parts: string[] = [];
  if (w.authors?.length)
    parts.push(w.authors.slice(0, 2).join(', ') + (w.authors.length > 2 ? '…' : ''));
  else parts.push('[Author unknown]');
  parts.push(w.year != null && String(w.year) !== '' ? String(w.year) : 'n.d.');
  if (hit.score != null && !Number.isNaN(hit.score)) parts.push(`score ${hit.score.toFixed(2)}`);
  return parts.join(' · ');
}

type CitationSearchDialogProps = {
  open: boolean;
  onClose: () => void;
  citationStyle: CitationStyle;
  onCitationStyleChange: (style: CitationStyle) => void;
  citationMarkerMode: CitationMarkerMode;
  onCitationMarkerModeChange: (mode: CitationMarkerMode) => void;
  /** Insert `<h2>References</h2><ol>…</ol>` at the caret so the list is not forced to the very end. */
  onPlaceReferencesHere: () => void;
  /** Current bibliography entries (for next marker label). */
  existingCitationCount: number;
  onInsert: (hit: ContentSearchHit) => Promise<void>;
};

export default function CitationSearchDialog({
  open,
  onClose,
  citationStyle,
  onCitationStyleChange,
  citationMarkerMode,
  onCitationMarkerModeChange,
  onPlaceReferencesHere,
  existingCitationCount,
  onInsert,
}: CitationSearchDialogProps) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 380);
  const [hits, setHits] = useState<ContentSearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insertingId, setInsertingId] = useState<string | null>(null);

  const performSearch = useCallback(async (qRaw: string) => {
    const q = qRaw.trim();
    if (!q) {
      setHits([]);
      setTotal(0);
      setUnavailable(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const out = await searchReferences(q);
      const deduped = dedupeHits(out.hits);
      const publishedOnly = deduped.filter(isPublishedHit);
      setHits(publishedOnly);
      setTotal(out.total);
      setUnavailable(out.unavailable);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
      setHits([]);
      setTotal(0);
      setUnavailable(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const q = debouncedQuery.trim();
    if (q.length < 2) return;
    void performSearch(q);
  }, [debouncedQuery, open, performSearch]);

  const handleInsert = async (hit: ContentSearchHit) => {
    setInsertingId(hit.contentId);
    setError(null);
    try {
      if (!isPublishedHit(hit)) {
        throw new Error('Only published content can be referenced.');
      }
      await onInsert(hit);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not insert citation');
    } finally {
      setInsertingId(null);
    }
  };

  if (!open) return null;

  const nextNum = existingCitationCount + 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="citation-dialog-title"
    >
      <div className="relative flex max-h-[85vh] w-full max-w-[820px] flex-col overflow-hidden rounded-app-xl border border-white/10 bg-app-bg/88 shadow-app-lift backdrop-blur-2xl supports-backdrop-filter:bg-app-bg/72">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-app-accent/45 to-app-accent-2/35"
          aria-hidden
        />
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
          <div className="min-w-0">
            <h2
              id="citation-dialog-title"
              className="m-0 flex items-center gap-2 text-lg font-semibold text-app-text"
            >
              <BookMarked size={20} className="shrink-0 text-app-accent" />
              Insert citation from references
            </h2>
            <p className="mt-1 text-[12px] leading-snug text-app-muted">
              Put the cursor where you want the marker, search, then insert. Use{' '}
              <span className="font-semibold text-app-text">Refs block</span> (toolbar or below) to
              place the numbered list where you want — otherwise the first citation appends
              References at the bottom. Formats: APA, IEEE, MLA.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-app-md p-2 text-app-faint transition-colors hover:bg-white/8 hover:text-app-text"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-b border-white/[0.06] px-5 py-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label
              htmlFor="citation-search-q"
              className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-app-faint"
            >
              Search references
            </label>
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-app-faint"
              />
              <input
                id="citation-search-q"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void performSearch(query);
                  }
                }}
                placeholder="Title, author, keywords…"
                className="box-border w-full rounded-app-md border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-3 text-[13px] text-app-text shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none placeholder:text-app-faint focus:border-app-accent/45 focus:ring-2 focus:ring-app-accent/20"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-end gap-2">
            <div>
              <label
                htmlFor="citation-style"
                className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-app-faint"
              >
                List format
              </label>
              <select
                id="citation-style"
                value={citationStyle}
                onChange={(e) => onCitationStyleChange(e.target.value as CitationStyle)}
                className="box-border min-w-[100px] rounded-app-md border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[13px] text-app-text shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none focus:border-app-accent/40"
              >
                <option value="APA">APA</option>
                <option value="IEEE">IEEE</option>
                <option value="MLA">MLA</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="citation-marker-mode"
                className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-app-faint"
              >
                Inline marker
              </label>
              <select
                id="citation-marker-mode"
                value={citationMarkerMode}
                onChange={(e) => onCitationMarkerModeChange(e.target.value as CitationMarkerMode)}
                className="box-border min-w-[128px] rounded-app-md border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[13px] text-app-text shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none focus:border-app-accent/40"
              >
                <option value="chip">Chip [n]</option>
                <option value="raised">Raised [n]</option>
                <option value="paren">(n)</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => void performSearch(query)}
              disabled={loading || !query.trim()}
              className="self-end rounded-app-md border border-app-accent/35 bg-app-accent/12 px-4 py-2.5 text-[13px] font-semibold text-app-accent transition-colors hover:bg-app-accent/20 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Search
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden px-5 pb-4 pt-3">
          {!isLiveCitationSearchMode() && (
            <div className="mb-3 rounded-app-md border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-[10px] leading-snug text-amber-200/90">
              Static reference list — set{' '}
              <span className="font-mono text-[9px]">VITE_CITATION_SEARCH_MODE=live</span> in{' '}
              <span className="font-mono text-[9px]">apps/web/.env</span> to use the search API.
            </div>
          )}
          {unavailable && (
            <div className="mb-3 rounded-app-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200/95">
              Search service is unavailable right now. Results may be empty; you can still insert
              once search is back.
            </div>
          )}
          {error && <div className="mb-3 text-[12px] text-red-400">{error}</div>}
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-[11px] text-app-faint">
            <span>
              {loading ? 'Searching…' : hits.length ? `${hits.length} shown` : 'No results'}
              {total > hits.length
                ? ` of ${total} matches`
                : total > 0 && !loading
                  ? ` · ${total} total`
                  : null}
            </span>
            <span>{existingCitationCount} citation(s) in this draft</span>
          </div>

          <div className="max-h-[min(52vh,420px)] overflow-auto rounded-app-md border border-white/10 bg-app-bg-subtle/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            {loading && hits.length === 0 ? (
              <div className="flex items-center gap-2 p-5 text-[13px] text-app-muted">
                <Loader2 size={18} className="animate-spin shrink-0" />
                Querying search index…
              </div>
            ) : hits.length === 0 ? (
              <div className="p-5 text-[13px] text-app-faint">
                {query.trim().length < 2
                  ? 'Type at least 2 characters (or press Search) to query references.'
                  : 'No references matched. Try different keywords.'}
              </div>
            ) : (
              <ul className="m-0 list-none divide-y divide-white/[0.06] p-0">
                {hits.map((hit) => {
                  const work = toCitationWork(hit);
                  const preview = formatCitationLocal(citationStyle, work);
                  const busy = insertingId === hit.contentId;
                  return (
                    <li key={hit.contentId} className="p-4 transition-colors hover:bg-white/[0.04]">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-semibold leading-snug text-app-text">
                            {hitTitle(hit)}
                          </div>
                          <div className="mt-0.5 text-[11px] text-app-faint">{metaLine(hit)}</div>
                          {hit.snippetHtml ? (
                            <div
                              className="citation-snippet mt-2 text-[12px] leading-relaxed text-app-muted [&_em]:text-cyan-300/80 [&_em]:not-italic"
                              dangerouslySetInnerHTML={{ __html: hit.snippetHtml }}
                            />
                          ) : (
                            <div className="mt-2 text-[12px] text-app-faint">
                              No snippet — metadata may be incomplete.
                            </div>
                          )}
                          <div className="mt-2 border-l-2 border-app-accent/40 pl-2 text-[11px] leading-snug text-app-muted">
                            <span className="font-semibold text-app-faint">
                              Preview ({citationStyle}):{' '}
                            </span>
                            {preview}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleInsert(hit)}
                          className="shrink-0 self-start rounded-app-md border border-app-accent-2/35 bg-app-accent-2/10 px-3 py-2 text-[12px] font-semibold text-app-accent-2 transition-colors hover:bg-app-accent-2/18 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busy ? (
                            <span className="flex items-center gap-1.5">
                              <Loader2 size={14} className="animate-spin" />
                              Inserting…
                            </span>
                          ) : (
                            `Insert [${nextNum}]`
                          )}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] px-5 py-3">
          <button
            type="button"
            onClick={() => onPlaceReferencesHere()}
            className="rounded-app-md border border-white/12 bg-white/[0.04] px-3 py-2 text-[12px] font-medium text-app-text transition-colors hover:border-app-accent/30 hover:bg-app-accent/10"
          >
            Update References at end
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-app-md border border-white/10 bg-white/[0.04] px-4 py-2 text-[13px] text-app-muted transition-colors hover:bg-white/[0.07]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
