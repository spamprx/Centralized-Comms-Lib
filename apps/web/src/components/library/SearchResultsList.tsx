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
    <div className="relative mt-2 overflow-hidden rounded-app-xl border border-white/10 bg-app-bg/35 shadow-app-lift backdrop-blur-xl supports-backdrop-filter:bg-app-bg/28">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-0 h-48 w-48 rounded-full bg-app-accent/12 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-app-accent/40 to-transparent"
      />
      <div className="relative z-1 flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3.5">
        <div className="min-w-0">
          <div className="truncate text-[12px] font-semibold tracking-tight text-app-text">
            Results for “{q.trim()}”
          </div>
          {!compact && (
            <div className="mt-1 space-x-1 text-[11px] text-app-faint">
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
            size={18}
            className="shrink-0 animate-spin text-app-accent"
            aria-label="Loading results"
          />
        )}
      </div>

      {error && (
        <div className="relative z-1 border-b border-white/[0.05] px-4 py-3.5 text-[12px] text-red-400/95">
          {error}
        </div>
      )}

      {!error && unavailable && (
        <div className="relative z-1 border-b border-white/[0.05] px-4 py-3.5 text-[12px] text-app-muted">
          Search index is unavailable right now. Showing basic filtered items below.
        </div>
      )}

      {!error && !loading && !unavailable && hits.length === 0 && (
        <div className="relative z-1 px-4 py-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-app-bg/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm">
            <SearchX size={20} className="text-app-accent/80" aria-hidden />
          </div>
          <div className="text-[13px] font-semibold text-app-text">
            No matches in the search index
          </div>
          <p className="mx-auto mt-2 max-w-sm text-[12px] leading-relaxed text-app-muted">
            Nothing ranked for this query. Try different keywords or clear the search box and use
            filters on the full library below.
          </p>
          {onClearSearch && (
            <button
              type="button"
              onClick={onClearSearch}
              className="mt-5 cursor-pointer rounded-full border border-app-accent/35 bg-app-accent/15 px-4 py-2 text-[12px] font-semibold text-app-accent shadow-[0_0_24px_-10px_rgba(147,124,248,0.5)] transition-[transform,background-color,border-color,box-shadow] duration-(--duration-app-slow) ease-(--ease-app-material) hover:border-app-accent/50 hover:bg-app-accent/22 active:scale-[0.98]"
            >
              Clear search
            </button>
          )}
        </div>
      )}

      {!error && hits.length > 0 && (
        <>
          <ul className="relative z-1 m-0 list-none space-y-2 p-3">
            {hits.map((h, idx) => {
              const titlePlain = plainTitleFromHit(h);
              const titleHtml = titleHtmlFromHit(h);
              const snippetHtml = snippetHtmlFromHit(h);
              const relPct = relevancePercentForHit(hits, idx);
              return (
                <li key={`${h.contentId}:${idx}`}>
                  <div className="group/hit flex items-start justify-between gap-3 rounded-app-lg border border-white/[0.07] bg-app-bg/25 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm transition-[border-color,transform,box-shadow] duration-(--duration-app-slow) ease-(--ease-app-material) hover:-translate-y-px hover:border-white/12 hover:bg-white/[0.04] hover:shadow-[0_16px_48px_-24px_rgba(0,0,0,0.55)] motion-reduce:transition-colors motion-reduce:hover:transform-none">
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/library/${h.contentId}`}
                        className="line-clamp-2 text-[13px] font-semibold text-app-accent transition-[color,gap] duration-(--duration-app) ease-app-out hover:text-app-accent-hover"
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
                          className="ml-1 inline-block shrink-0 align-middle opacity-60 transition-transform duration-(--duration-app) ease-app-out group-hover/hit:translate-x-0.5 group-hover/hit:-translate-y-0.5 group-hover/hit:opacity-100"
                          aria-hidden
                        />
                      </Link>
                      {snippetHtml ? (
                        <div
                          className={`mt-2 line-clamp-3 text-[12px] leading-relaxed text-app-muted ${snippetMarkClass}`}
                          dangerouslySetInnerHTML={{ __html: snippetHtml }}
                        />
                      ) : (
                        <div className="mt-2 text-[12px] text-app-faint">No snippet available.</div>
                      )}
                    </div>
                    <div className="w-[4.75rem] shrink-0 text-right">
                      <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-app-faint">
                        Relevance
                      </div>
                      <div className="text-[12px] font-semibold tabular-nums text-app-text">
                        {relPct}%
                      </div>
                      <div
                        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/5"
                        title={`Blended score on this page: ${typeof h.score === 'number' ? h.score.toFixed(4) : '—'}`}
                      >
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-app-accent via-app-accent-2 to-app-accent transition-[width] duration-500 ease-out"
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
            <nav
              className="border-t border-white/[0.06] bg-app-bg/20 backdrop-blur-md"
              aria-label="Search results pages"
            >
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={onPageChange} />
            </nav>
          )}
        </>
      )}
    </div>
  );
}
