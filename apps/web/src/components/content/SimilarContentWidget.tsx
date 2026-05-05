import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, FileText, FileWarning, Loader2 } from 'lucide-react';
import { contentService, type Content } from '../../services/contentService';
import { fetchSimilarByContentId, type ContentCheckHit } from '../../services/searchService';
import { useAuth } from '../../context/AuthContext';
import { htmlToPlainText, rankLocalSimilarContent } from '../../lib/contentSimilarityLocal';

type DisplayHit = {
  contentId: string;
  title: string;
  similarityScore: number;
};

function hitTitle(hit: ContentCheckHit): string {
  const s = hit.source;
  const t = s.title ?? s.name;
  if (typeof t === 'string' && t.trim()) return t.trim();
  return 'Untitled';
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export type SimilarContentWidgetProps = {
  title: string;
  /** Rich text / HTML from the editor */
  bodyHtml: string;
  /** Set once the draft exists in the API (or route id for existing drafts). */
  contentId: string | null;
  className?: string;
  /** Muted chrome for the document editor (no warning-styled icon). */
  appearance?: 'default' | 'neutral';
  /** Open the list by default (e.g. dedicated side panel). */
  defaultExpanded?: boolean;
  /** Override max height for the hits list (Tailwind class). */
  listMaxHeightClassName?: string;
};

/**
 * Inline, non-intrusive duplicate hints: search index when `contentId` exists,
 * otherwise local overlap against the author's existing titles/body snippets.
 */
export default function SimilarContentWidget({
  title,
  bodyHtml,
  contentId,
  className = '',
  appearance = 'default',
  defaultExpanded = false,
  listMaxHeightClassName = 'max-h-[200px]',
}: SimilarContentWidgetProps) {
  const { user } = useAuth();
  const debouncedTitle = useDebounced(title, 450);
  const debouncedBody = useDebounced(bodyHtml, 450);

  const [expanded, setExpanded] = useState(defaultExpanded);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hits, setHits] = useState<DisplayHit[]>([]);
  const [source, setSource] = useState<'api' | 'local' | 'none'>('none');

  const authorId = user?.id ?? null;
  const listCache = useRef<Content[] | null>(null);

  const loadAuthorList = useCallback(async (): Promise<Content[]> => {
    if (!authorId) return [];
    if (listCache.current) return listCache.current;
    const rows = await contentService.list({ authorId, limit: 200, offset: 0 });
    listCache.current = rows;
    return rows;
  }, [authorId]);

  const plainBodyDebounced = htmlToPlainText(debouncedBody).trim();
  const plainLen = plainBodyDebounced.length;
  /** Match title threshold so short phrases in the body (e.g. a product name) still trigger a check. */
  const shouldQuery = debouncedTitle.trim().length >= 3 || plainLen >= 3;

  const run = useCallback(async () => {
    if (!shouldQuery) {
      setHits([]);
      setSource('none');
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (contentId) {
        const raw = await fetchSimilarByContentId(contentId, { size: 10 });
        if (raw && raw.hits.length) {
          const max = Math.max(...raw.hits.map((h) => h.score), 1e-6);
          setHits(
            raw.hits.map((h) => ({
              contentId: h.contentId,
              title: hitTitle(h),
              similarityScore: Math.min(100, Math.round((h.score / max) * 100)),
            })),
          );
          setSource('api');
          setLoading(false);
          return;
        }

        const items = await loadAuthorList();
        const local = rankLocalSimilarContent(debouncedTitle, debouncedBody, items, {
          excludeContentId: contentId,
          limit: 8,
        });
        setHits(local);
        setSource(local.length ? 'local' : 'none');
        setLoading(false);
        return;
      }

      const items = await loadAuthorList();
      const local = rankLocalSimilarContent(debouncedTitle, debouncedBody, items, { limit: 8 });
      setHits(local);
      setSource(local.length ? 'local' : 'none');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not check for similar content');
      setHits([]);
      setSource('none');
    } finally {
      setLoading(false);
    }
  }, [shouldQuery, contentId, debouncedTitle, debouncedBody, loadAuthorList]);

  useEffect(() => {
    void run();
  }, [run]);

  if (!authorId) return null;

  const count = hits.length;
  const subtitle =
    source === 'api'
      ? 'Search index'
      : source === 'local'
        ? 'Quick match on your existing drafts'
        : null;

  const neutral = appearance === 'neutral';

  return (
    <div
      className={`similar-content-widget overflow-hidden rounded-app-xl border border-white/10 bg-app-bg/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] shadow-app-soft backdrop-blur-xl supports-backdrop-filter:bg-app-bg/40 ${className}`}
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className={`flex w-full cursor-pointer items-center justify-between gap-2 border-none px-3.5 py-2.5 text-left transition-[background-color] duration-200 ${
          neutral ? 'bg-transparent hover:bg-white/[0.04]' : 'bg-transparent hover:bg-white/[0.04]'
        }`}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {neutral ? (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-app-md border border-white/10 bg-white/[0.04] text-app-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <FileText size={15} strokeWidth={2} className="shrink-0" />
            </span>
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-app-md border border-amber-400/25 bg-amber-500/10 text-amber-200/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <FileWarning size={15} strokeWidth={2} className="shrink-0" />
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium tracking-tight text-app-text">
            Similar content
            {count > 0 && (
              <span
                className={`ml-1.5 tabular-nums ${neutral ? 'text-app-accent' : 'text-amber-200/90'}`}
              >
                · {count}
              </span>
            )}
          </span>
          {loading && <Loader2 size={14} className="shrink-0 animate-spin text-app-accent/80" />}
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          className={`shrink-0 text-app-faint transition-transform duration-200 ease-out ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-white/[0.08] bg-white/[0.02] px-3 pb-3.5 pt-1">
          {!shouldQuery && (
            <p className="m-0 mt-2 text-[11px] leading-relaxed text-app-muted">
              Type at least 3 characters in the title or body — we will suggest possible duplicates.
            </p>
          )}
          {shouldQuery && subtitle && count > 0 && (
            <p className="m-0 mb-2 mt-1 text-[10px] font-medium uppercase tracking-wider text-app-faint">
              {subtitle}
            </p>
          )}
          {error && <p className="m-0 mt-1 text-[11px] text-red-400">{error}</p>}
          {shouldQuery && !loading && count === 0 && !error && (
            <p className="m-0 mt-1 text-[11px] text-app-muted">No close matches found.</p>
          )}
          <ul
            className={`m-0 list-none space-y-1 overflow-y-auto p-0 pt-1 ${listMaxHeightClassName}`}
          >
            {hits.map((h) => (
              <li
                key={h.contentId}
                className="flex items-start justify-between gap-2 rounded-app-md border border-transparent px-2 py-2 text-[12px] transition-[border-color,background-color] duration-150 hover:border-white/10 hover:bg-white/[0.04]"
              >
                <Link
                  to={`/library/${h.contentId}`}
                  className={`min-w-0 flex-1 truncate font-medium no-underline transition-colors ${
                    neutral
                      ? 'text-app-accent hover:text-app-accent-hover'
                      : 'text-app-accent/95 hover:text-app-accent'
                  }`}
                  title={h.title}
                >
                  {h.title}
                </Link>
                <span className="shrink-0 rounded-app-md border border-white/10 bg-app-bg/60 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-app-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  {h.similarityScore}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
