import { Link } from 'react-router-dom';
import { ArrowUpRight, Loader2, SearchX } from 'lucide-react';
import type { ContentSearchHit } from '../../services/searchService';
import {
  plainTitleFromHit,
  relevancePercentForHit,
  snippetHtmlFromHit,
  titleHtmlFromHit,
} from '../../lib/searchHitDisplay';
import { Pagination } from './Pagination';

const snippetMarkClass =
  '[&_mark]:rounded-sm [&_mark]:bg-amber-400/30 [&_mark]:px-0.5 [&_mark]:text-app-text [&_em]:italic';

export type SearchResultsListProps = {
  q: string;
  loading: boolean;
  unavailable: boolean;
  error: string | null;
  hits: ContentSearchHit[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Optional: show a smaller note when search is disabled/unavailable */
  compact?: boolean;
  onClearSearch?: () => void;
};

export function SearchResultsList({
  q,
  loading,
  unavailable,
  error,
  hits,
  total,
  page,
  pageSize,
  onPageChange,
  compact = false,
  onClearSearch,
}: SearchResultsListProps) {
  const show = q.trim().length > 0;
  if (!show) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showPager = !error && !unavailable && total > pageSize;
  const fromIdx = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const toIdx = total === 0 ? 0 : Math.min(page * pageSize, total);

  return (
    <div className="mt-4 rounded-app-lg border border-app-border bg-app-surface overflow-hidden">
      <div className="px-4 py-3 border-b border-app-border flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-app-text truncate">
            Results for “{q.trim()}”
          </div>
          {!compact && (
            <div className="text-[11px] text-app-faint mt-0.5 space-x-1">
              <span>Ranked by relevance{unavailable ? ' (search index unavailable)' : ''}.</span>
              {!error && !unavailable && !loading && total > 0 && (
                <span className="text-app-muted">
                  Showing {fromIdx}–{toIdx} of {total}.
                </span>
              )}
            </div>
          )}
        </div>
        {loading && (
          <Loader2
            size={16}
            className="animate-spin text-app-faint shrink-0"
            aria-label="Loading results"
          />
        )}
      </div>

      {error && <div className="px-4 py-3 text-[12px] text-red-400/90">{error}</div>}

      {!error && unavailable && (
        <div className="px-4 py-3 text-[12px] text-app-muted">
          Search index is unavailable right now. Showing basic filtered items below.
        </div>
      )}

      {!error && !loading && !unavailable && hits.length === 0 && (
        <div className="px-4 py-8 text-center">
          <SearchX size={18} className="text-app-faint inline-block mb-2" aria-hidden />
          <div className="text-[13px] font-medium text-app-text">
            No matches in the search index
          </div>
          <p className="mt-1.5 text-[12px] text-app-muted max-w-sm mx-auto leading-relaxed">
            Nothing ranked for this query. Try different keywords or clear the search box and use
            filters on the full library below.
          </p>
          {onClearSearch && (
            <button
              type="button"
              onClick={onClearSearch}
              className="mt-4 text-[12px] font-semibold text-app-accent bg-transparent border-none cursor-pointer hover:underline underline-offset-2"
            >
              Clear search
            </button>
          )}
        </div>
      )}

      {!error && hits.length > 0 && (
        <>
          <ul className="list-none m-0 p-0 divide-y divide-app-border">
            {hits.map((h, idx) => {
              const titlePlain = plainTitleFromHit(h);
              const titleHtml = titleHtmlFromHit(h);
              const snippetHtml = snippetHtmlFromHit(h);
              const relPct = relevancePercentForHit(hits, idx);
              return (
                <li key={`${h.contentId}:${idx}`} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/library/${h.contentId}`}
                        className="text-[13px] font-semibold text-app-accent hover:text-app-accent line-clamp-2"
                        title={titlePlain}
                      >
                        {titleHtml ? (
                          <span
                            className={snippetMarkClass}
                            dangerouslySetInnerHTML={{ __html: titleHtml }}
                          />
                        ) : (
                          titlePlain
                        )}
                        <ArrowUpRight
                          size={14}
                          className="inline-block ml-1 opacity-70 shrink-0 align-middle"
                          aria-hidden
                        />
                      </Link>
                      {snippetHtml ? (
                        <div
                          className={`text-[12px] text-app-muted mt-1.5 leading-relaxed line-clamp-3 ${snippetMarkClass}`}
                          dangerouslySetInnerHTML={{ __html: snippetHtml }}
                        />
                      ) : (
                        <div className="text-[12px] text-app-faint mt-1.5">
                          No snippet available.
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right w-[4.5rem]">
                      <div className="text-[10px] text-app-faint uppercase tracking-wide">
                        Relevance
                      </div>
                      <div className="text-[12px] font-semibold text-app-text tabular-nums">
                        {relPct}%
                      </div>
                      <div
                        className="mt-1 h-1 rounded-full bg-app-border/80 overflow-hidden"
                        title={`Blended score on this page: ${typeof h.score === 'number' ? h.score.toFixed(4) : '—'}`}
                      >
                        <div
                          className="h-full rounded-full bg-app-accent/80 transition-[width] duration-300"
                          style={{ width: `${relPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {showPager && (
            <nav className="border-t border-app-border" aria-label="Search results pages">
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={onPageChange} />
            </nav>
          )}
        </>
      )}
    </div>
  );
}
