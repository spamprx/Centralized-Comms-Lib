import { Link } from 'react-router-dom';
import { ArrowUpRight, Loader2, SearchX } from 'lucide-react';
import type { ContentSearchHit } from '../../services/searchService';

function titleFromSource(source: Record<string, unknown>): string {
  const t = source.title ?? source.name;
  if (typeof t === 'string' && t.trim()) return t.trim();
  return 'Untitled';
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export type SearchResultsListProps = {
  q: string;
  loading: boolean;
  unavailable: boolean;
  error: string | null;
  hits: ContentSearchHit[];
  /** Optional: show a smaller note when search is disabled/unavailable */
  compact?: boolean;
};

export function SearchResultsList({
  q,
  loading,
  unavailable,
  error,
  hits,
  compact = false,
}: SearchResultsListProps) {
  const show = q.trim().length > 0;
  if (!show) return null;

  return (
    <div className="mt-4 rounded-[10px] border border-white/[0.07] bg-white/[0.03] overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-[#e2e4f0] truncate">
            Results for “{q.trim()}”
          </div>
          {!compact && (
            <div className="text-[11px] text-[#555870] mt-0.5">
              Ranked by relevance{unavailable ? ' (search index unavailable)' : ''}.
            </div>
          )}
        </div>
        {loading && <Loader2 size={16} className="animate-spin text-[#555870] shrink-0" />}
      </div>

      {error && (
        <div className="px-4 py-3 text-[12px] text-red-400/90">
          {error}
        </div>
      )}

      {!error && unavailable && (
        <div className="px-4 py-3 text-[12px] text-[#8b8fa8]">
          Search index is unavailable right now. Showing basic filtered items below.
        </div>
      )}

      {!error && !loading && !unavailable && hits.length === 0 && (
        <div className="px-4 py-8 text-center">
          <SearchX size={18} className="text-[#555870] inline-block mb-2" />
          <div className="text-[12px] text-[#8b8fa8]">No results found.</div>
        </div>
      )}

      {!error && hits.length > 0 && (
        <ul className="list-none m-0 p-0 divide-y divide-white/[0.06]">
          {hits.map((h, idx) => {
            const title = titleFromSource(h.source);
            const scorePct = clampScore(h.score);
            return (
              <li key={`${h.contentId}:${idx}`} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/library/${h.contentId}`}
                      className="text-[13px] font-semibold text-violet-300 hover:text-violet-200 truncate block"
                      title={title}
                    >
                      {title}
                      <ArrowUpRight size={14} className="inline-block ml-1 opacity-70" />
                    </Link>
                    {h.snippetHtml ? (
                      <div
                        className="text-[12px] text-[#8b8fa8] mt-1 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: h.snippetHtml }}
                      />
                    ) : (
                      <div className="text-[12px] text-[#555870] mt-1">
                        No snippet available.
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[10px] text-[#555870] uppercase">Score</div>
                    <div className="text-[12px] font-semibold text-[#e2e4f0] tabular-nums">
                      {scorePct}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

