import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, FileText, FileWarning, Loader2 } from 'lucide-react';
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
  /** Muted chrome for the document editor (no warning-styled icon). */
  appearance?: 'default' | 'neutral';
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

  const neutral = appearance === 'neutral';

  return (
    <div
      className={`overflow-hidden rounded-[var(--editor-radius-input,0.5rem)] border-[0.5px] border-[var(--editor-border,rgba(0,0,0,0.12))] bg-[var(--editor-card-bg,transparent)] ${className}`}
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className={`flex w-full cursor-pointer items-center justify-between gap-2 border-none px-3 py-2 text-left transition-colors ${
          neutral
            ? 'bg-transparent hover:bg-[var(--editor-canvas-bg)]'
            : 'bg-transparent hover:bg-app-surface'
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {neutral ? (
            <FileText size={14} className="shrink-0 text-[var(--editor-muted)]" />
          ) : (
            <FileWarning size={14} className="shrink-0 text-amber-400/90" />
          )}
          <span
            className={`truncate text-[12px] font-medium ${neutral ? 'text-[var(--editor-muted)]' : 'text-app-muted'}`}
          >
            Similar content
            {count > 0 && (
              <span
                className={`ml-1 ${neutral ? 'text-[var(--editor-primary)]' : 'text-app-accent/90'}`}
              >
                · {count}
              </span>
            )}
          </span>
          {loading && (
            <Loader2
              size={12}
              className={`shrink-0 animate-spin ${neutral ? 'text-[var(--editor-faint)]' : 'text-app-faint'}`}
            />
          )}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 transition-transform ${neutral ? 'text-[var(--editor-faint)]' : 'text-app-faint'} ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div
          className={`border-t px-3 pb-3 pt-0 ${neutral ? 'border-[var(--editor-border)]' : 'border-app-border'}`}
        >
          {!shouldQuery && (
            <p
              className={`m-0 mt-2 text-[11px] ${neutral ? 'text-[var(--editor-faint)]' : 'text-app-faint'}`}
            >
              Keep typing a title or body — we will suggest possible duplicates.
            </p>
          )}
          {shouldQuery && subtitle && count > 0 && (
            <p
              className={`m-0 mb-2 text-[10px] ${neutral ? 'text-[var(--editor-faint)]' : 'text-app-faint'}`}
            >
              {subtitle}
            </p>
          )}
          {error && (
            <p className="m-0 mt-1 text-[11px] text-red-500/90">{error}</p>
          )}
          {shouldQuery && !loading && count === 0 && !error && (
            <p
              className={`m-0 mt-1 text-[11px] ${neutral ? 'text-[var(--editor-faint)]' : 'text-app-faint'}`}
            >
              No close matches found.
            </p>
          )}
          <ul className="m-0 max-h-[200px] list-none space-y-1.5 overflow-y-auto p-0">
            {hits.map((h) => (
              <li key={h.contentId} className="flex items-start justify-between gap-2 text-[12px]">
                <Link
                  to={`/library/${h.contentId}`}
                  className={`min-w-0 flex-1 truncate no-underline hover:underline ${
                    neutral ? 'text-[var(--editor-primary)]' : 'text-app-accent/95 hover:text-app-accent'
                  }`}
                  title={h.title}
                >
                  {h.title}
                </Link>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] tabular-nums ${
                    neutral
                      ? 'bg-[var(--editor-canvas-bg)] text-[var(--editor-faint)]'
                      : 'rounded bg-app-surface text-app-faint'
                  }`}
                >
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
