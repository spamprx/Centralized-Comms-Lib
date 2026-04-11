import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, FileWarning, Loader2 } from 'lucide-react';
import { contentService, type Content } from '../../services/contentService';
import { fetchSimilarByContentId, type ContentCheckHit } from '../../services/searchService';
import { decodeTokenPayload } from '../../services/tokenStore';
import { htmlToPlainText, rankLocalSimilarContent } from '../../utils/contentSimilarityLocal';

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
}: SimilarContentWidgetProps) {
  const debouncedTitle = useDebounced(title, 450);
  const debouncedBody = useDebounced(bodyHtml, 450);

  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hits, setHits] = useState<DisplayHit[]>([]);
  const [source, setSource] = useState<'api' | 'local' | 'none'>('none');

  const authorId = useMemo(() => decodeTokenPayload()?.id ?? null, []);
  const listCache = useRef<Content[] | null>(null);

  const loadAuthorList = useCallback(async (): Promise<Content[]> => {
    if (!authorId) return [];
    if (listCache.current) return listCache.current;
    const rows = await contentService.list({ authorId, limit: 200, offset: 0 });
    listCache.current = rows;
    return rows;
  }, [authorId]);

  const plainLen = htmlToPlainText(debouncedBody).length;
  const shouldQuery =
    debouncedTitle.trim().length >= 3 || plainLen >= 24;

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

  return (
    <div
      className={`rounded-lg border border-app-border bg-app-bg/60 overflow-hidden ${className}`}
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left bg-transparent border-none cursor-pointer hover:bg-app-surface transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0">
          <FileWarning size={14} className="text-amber-400/90 shrink-0" />
          <span className="text-[12px] font-medium text-app-muted truncate">
            Similar content
            {count > 0 && (
              <span className="text-app-accent/90 ml-1">· {count}</span>
            )}
          </span>
          {loading && <Loader2 size={12} className="animate-spin text-app-faint shrink-0" />}
        </span>
        <ChevronDown
          size={14}
          className={`text-app-faint shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-0 border-t border-app-border">
          {!shouldQuery && (
            <p className="text-[11px] text-app-faint m-0 mt-2">
              Keep typing a title or body — we will suggest possible duplicates.
            </p>
          )}
          {shouldQuery && subtitle && count > 0 && (
            <p className="text-[10px] text-app-faint m-0 mb-2">{subtitle}</p>
          )}
          {error && (
            <p className="text-[11px] text-red-400/90 m-0 mt-1">{error}</p>
          )}
          {shouldQuery && !loading && count === 0 && !error && (
            <p className="text-[11px] text-app-faint m-0 mt-1">No close matches found.</p>
          )}
          <ul className="list-none m-0 p-0 space-y-1.5 max-h-[200px] overflow-y-auto">
            {hits.map((h) => (
              <li key={h.contentId} className="flex items-start justify-between gap-2 text-[12px]">
                <Link
                  to={`/library/${h.contentId}`}
                  className="text-app-accent/95 hover:text-app-accent truncate min-w-0 flex-1"
                  title={h.title}
                >
                  {h.title}
                </Link>
                <span className="text-[10px] tabular-nums text-app-faint shrink-0 bg-app-surface px-1.5 py-0.5 rounded">
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
