import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Bookmark,
  Share2,
  MessageSquare,
  ThumbsUp,
  ChevronLeft,
  ChevronRight,
  Type,
} from 'lucide-react';
import { Surface } from '../components/ui/Surface';
import TipTapReadonly from '../components/editor/TipTapReadonly';
import { contentService, type ContentComment } from '../services/contentService';
import { fetchSimilarByContentId } from '../services/searchService';
import { tipTapJsonToPlainText } from '../lib/tipTapPlainText';

function contentTypeLabel(t: string | undefined): string {
  switch (t) {
    case 'VIDEO':
      return 'Video';
    case 'PODCAST':
      return 'Podcast';
    case 'DOCUMENT':
      return 'Document';
    case 'ARTICLE':
    default:
      return 'Article';
  }
}

function estimateReadTimeLabel(doc: unknown): string {
  const text = tipTapJsonToPlainText(doc);
  const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  const mins = Math.max(1, Math.round(words / 200));
  return `${mins} min`;
}

const STOP = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'to',
  'in',
  'for',
  'on',
  'with',
  'is',
  'are',
  'was',
  'were',
  'be',
  'this',
  'that',
  'it',
  'as',
  'at',
  'by',
]);

function tokenize(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
  return new Set(words);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export default function ReadingLayout() {
  const { contentId } = useParams<{ contentId: string }>();
  const navigate = useNavigate();
  const [scrollProgress, setScrollProgress] = useState(0);
  const [fontSize, setFontSize] = useState(16);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [viewsCount, setViewsCount] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);
  const [likedByMe, setLikedByMe] = useState(false);
  const [engagementLoading, setEngagementLoading] = useState(false);

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [comments, setComments] = useState<ContentComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('Loading…');
  const [bodyDoc, setBodyDoc] = useState<unknown>(null);
  const [authorName, setAuthorName] = useState<string>('—');
  const [currentType, setCurrentType] = useState<'ARTICLE' | 'VIDEO' | 'PODCAST' | 'DOCUMENT'>(
    'ARTICLE',
  );
  const [related, setRelated] = useState<
    Array<{ id: string; title: string; type: string; authorName: string; readTime: string }>
  >([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [annotations, setAnnotations] = useState<
    Array<{
      id: string;
      body: string;
      authorName: string;
      createdAt: string;
      selectionText: string | null;
      selectionFrom: number | null;
      selectionTo: number | null;
    }>
  >([]);
  const [annotationsLoading, setAnnotationsLoading] = useState(false);
  const [annotationBody, setAnnotationBody] = useState('');
  const [annotationSaving, setAnnotationSaving] = useState(false);
  const [annotationError, setAnnotationError] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ from: number; to: number; text: string }>({
    from: 0,
    to: 0,
    text: '',
  });

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const denom = scrollHeight - clientHeight;
    const progress = denom > 0 ? (scrollTop / denom) * 100 : 0;
    setScrollProgress(progress);
  };

  useEffect(() => {
    if (!contentId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        const details = await contentService.getById(contentId);
        if (cancelled) return;
        setTitle(details.content.title || 'Untitled');
        setAuthorName(details.content.author?.displayName || '—');
        setCurrentType(details.content.contentType ?? 'ARTICLE');

        // Pick latest body-carrying version (same logic as review, but keep the doc, don't flatten).
        const bodyVersions = (details.versions ?? []).filter(
          (v) =>
            (v.changeType === 'MANUAL_SAVE' || v.changeType === 'AI_GENERATED') && v.body != null,
        );
        if (bodyVersions.length === 0) {
          setBodyDoc(null);
        } else {
          const latestWithBody = bodyVersions.reduce((prev, curr) =>
            curr.versionNumber > prev.versionNumber ? curr : prev,
          );
          setBodyDoc(latestWithBody.body ?? null);
        }
      } catch (e) {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : 'Failed to load content');
        setTitle('Unable to load');
        setBodyDoc(null);
        setAuthorName('—');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contentId]);

  useEffect(() => {
    if (!contentId) return;
    let cancelled = false;
    void (async () => {
      try {
        const state = await contentService.getBookmarkState(contentId);
        if (!cancelled) setBookmarked(!!state.bookmarked);
      } catch {
        if (!cancelled) setBookmarked(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contentId]);

  useEffect(() => {
    if (!contentId) return;
    let cancelled = false;
    setEngagementLoading(true);
    void (async () => {
      try {
        const e = await contentService.getEngagement(contentId);
        if (cancelled) return;
        setViewsCount(e.views);
        setLikesCount(e.likes);
        setCommentsCount(e.comments);
        setLikedByMe(!!e.likedByMe);
      } catch {
        if (cancelled) return;
        setViewsCount(0);
        setLikesCount(0);
        setCommentsCount(0);
        setLikedByMe(false);
      } finally {
        if (!cancelled) setEngagementLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contentId]);

  useEffect(() => {
    if (!contentId) return;
    if (typeof window === 'undefined') return;
    if (!('sessionStorage' in window)) return;

    const SESSION_KEY = 'content_view_session_id';
    const VIEWED_KEY = `content_viewed:${contentId}`;

    let sessionId = window.sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      sessionId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      window.sessionStorage.setItem(SESSION_KEY, sessionId);
    }

    void (async () => {
      try {
        const r = await contentService.recordView(contentId, sessionId!);
        setViewsCount(r.views);
        window.sessionStorage.setItem(VIEWED_KEY, '1');
      } catch {
        // If the request fails (e.g. backend restarting), don't mark it as viewed yet.
      }
    })();
  }, [contentId]);

  const loadComments = useMemo(() => {
    return async (id: string) => {
      setCommentsLoading(true);
      try {
        const rows = await contentService.listComments(id);
        setComments(rows);
        setCommentsCount(rows.length);
      } catch {
        setComments([]);
      } finally {
        setCommentsLoading(false);
      }
    };
  }, []);

  const toggleLike = async () => {
    if (!contentId) return;
    try {
      if (likedByMe) {
        const r = await contentService.unlike(contentId);
        setLikedByMe(false);
        setLikesCount(r.likes);
      } else {
        const r = await contentService.like(contentId);
        setLikedByMe(true);
        setLikesCount(r.likes);
      }
    } catch {
      // ignore
    }
  };

  const submitComment = async () => {
    if (!contentId) return;
    const body = newComment.trim();
    if (!body) {
      setCommentError('Comment text is required');
      return;
    }
    setCommentSaving(true);
    setCommentError(null);
    try {
      await contentService.addComment(contentId, body);
      setNewComment('');
      await loadComments(contentId);
    } catch (e) {
      setCommentError(e instanceof Error ? e.message : 'Failed to add comment');
    } finally {
      setCommentSaving(false);
    }
  };

  const loadAnnotations = useMemo(() => {
    return async (id: string) => {
      setAnnotationsLoading(true);
      try {
        const rows = await contentService.listAnnotations(id);
        setAnnotations(
          rows.map((r) => ({
            id: r.id,
            body: r.body,
            authorName: r.author.displayName || r.author.email,
            createdAt: r.createdAt,
            selectionText: r.selectionText,
            selectionFrom: r.selectionFrom,
            selectionTo: r.selectionTo,
          })),
        );
      } catch {
        setAnnotations([]);
      } finally {
        setAnnotationsLoading(false);
      }
    };
  }, []);

  useEffect(() => {
    if (!contentId) return;
    void loadAnnotations(contentId);
  }, [contentId, loadAnnotations]);

  const canAttachSelection = selection.text.trim().length > 0 && selection.from !== selection.to;

  const submitAnnotation = async (opts: { attachToSelection: boolean }) => {
    if (!contentId) return;
    const body = annotationBody.trim();
    if (!body) {
      setAnnotationError('Annotation text is required');
      return;
    }
    setAnnotationSaving(true);
    setAnnotationError(null);
    try {
      await contentService.addAnnotation(contentId, {
        body,
        ...(opts.attachToSelection && canAttachSelection
          ? {
              selectionFrom: selection.from,
              selectionTo: selection.to,
              selectionText: selection.text,
            }
          : {}),
      });
      setAnnotationBody('');
      await loadAnnotations(contentId);
    } catch (e) {
      setAnnotationError(e instanceof Error ? e.message : 'Failed to add annotation');
    } finally {
      setAnnotationSaving(false);
    }
  };

  useEffect(() => {
    if (!contentId) return;
    let cancelled = false;
    setRelatedLoading(true);
    void (async () => {
      try {
        const raw = await fetchSimilarByContentId(contentId, { size: 8 });
        if (cancelled) return;
        const hits = (raw?.hits ?? []).filter((h) => h.contentId !== contentId);
        const primaryIds = Array.from(new Set(hits.map((h) => h.contentId))).slice(0, 3);

        const hydrateCards = async (ids: string[]) => {
          const settled = await Promise.allSettled(
            ids.map(async (id) => {
              const d = await contentService.getById(id);
              const bodyVersions = (d.versions ?? []).filter(
                (v) =>
                  (v.changeType === 'MANUAL_SAVE' || v.changeType === 'AI_GENERATED') &&
                  v.body != null,
              );
              const latestWithBody =
                bodyVersions.length > 0
                  ? bodyVersions.reduce((prev, curr) =>
                      curr.versionNumber > prev.versionNumber ? curr : prev,
                    )
                  : null;
              const doc = latestWithBody?.body ?? null;
              return {
                id,
                title: d.content.title || `Content ${id.slice(0, 8)}…`,
                type: contentTypeLabel(d.content.contentType),
                authorName: d.content.author?.displayName || '—',
                readTime: doc ? estimateReadTimeLabel(doc) : '—',
                bodyDoc: doc,
              };
            }),
          );
          const ok = settled
            .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
            .map((r) => r.value);
          return ok;
        };

        // Start with primary (index) results.
        let cards = primaryIds.length ? await hydrateCards(primaryIds) : [];

        // Fallback: body-to-body similarity using DB list + getById bodies.
        if (cards.length < 3) {
          const currentPlain = bodyDoc ? tipTapJsonToPlainText(bodyDoc) : '';
          const currentTokens = tokenize(currentPlain);
          try {
            const pool = await contentService.list({
              lifecycleState: 'PUBLISHED',
              contentType: currentType,
              limit: 30,
              offset: 0,
            });
            const candidateIds = pool.map((c) => c.id).filter((id) => id !== contentId);
            const candCards = await hydrateCards(candidateIds.slice(0, 12));
            const scored = candCards
              .map((c) => {
                const plain = c.bodyDoc ? tipTapJsonToPlainText(c.bodyDoc) : '';
                const score = jaccard(currentTokens, tokenize(plain));
                return { ...c, score };
              })
              .filter((c) => c.score > 0.05)
              .sort((a, b) => b.score - a.score);

            const seen = new Set(cards.map((c: { id: string }) => c.id));
            for (const c of scored) {
              if (seen.has(c.id)) continue;
              cards.push(c);
              seen.add(c.id);
              if (cards.length >= 3) break;
            }

            // Last resort fill: recent items (same type), even if score is low.
            if (cards.length < 3) {
              for (const c of candCards) {
                if (seen.has(c.id)) continue;
                cards.push({ ...c, score: 0 });
                seen.add(c.id);
                if (cards.length >= 3) break;
              }
            }
          } catch {
            // ignore fallback failure
          }
        }

        if (cancelled) return;
        setRelated(cards.slice(0, 3).map(({ bodyDoc: _bd, score: _s, ...rest }) => rest));
      } catch {
        if (!cancelled) setRelated([]);
      } finally {
        if (!cancelled) setRelatedLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contentId, currentType, bodyDoc]);

  const hasTipTapDoc =
    bodyDoc &&
    typeof bodyDoc === 'object' &&
    bodyDoc !== null &&
    'type' in (bodyDoc as Record<string, unknown>);

  const readTimeLabel = useMemo(() => (hasTipTapDoc ? 'Read' : '—'), [hasTipTapDoc]);

  return (
    <div className="flex h-screen min-h-0 flex-col bg-app-bg">
      <div className="relative h-[3px] shrink-0 bg-app-elevated">
        <div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-app-accent to-app-accent-2 transition-[width] duration-100"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      <header className="sticky top-0 z-10 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-app-border/80 bg-app-surface/70 px-4 py-3 backdrop-blur-xl supports-[backdrop-filter]:bg-app-surface/50 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => navigate('/library')}
            className="rounded-app-md p-2 text-app-faint transition-colors hover:bg-app-elevated hover:text-app-text"
            aria-label="Back to library"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-[13px] text-app-muted">Back to library</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (!contentId) return;
              if (bookmarkBusy) return;
              setBookmarkBusy(true);
              void (async () => {
                try {
                  if (!bookmarked) {
                    await contentService.bookmark(contentId);
                    setBookmarked(true);
                  } else {
                    await contentService.unbookmark(contentId);
                    setBookmarked(false);
                  }
                } finally {
                  setBookmarkBusy(false);
                }
              })();
            }}
            disabled={bookmarkBusy || !contentId}
            className={`flex items-center gap-1.5 rounded-app-md px-3 py-2 text-xs transition-colors ${
              bookmarked
                ? 'border border-app-accent/35 bg-app-accent-muted text-app-accent'
                : 'border border-app-border/80 bg-app-bg/40 text-app-muted hover:border-app-accent/20'
            }`}
          >
            <Bookmark size={16} className={bookmarked ? 'fill-app-accent text-app-accent' : ''} />
            {bookmarkBusy ? 'Saving…' : bookmarked ? 'Saved' : 'Save'}
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-app-md border border-app-border/80 bg-app-bg/40 px-3 py-2 text-xs text-app-muted hover:border-app-accent/25 hover:text-app-text"
          >
            <Share2 size={16} /> Share
          </button>
          <div className="flex items-center gap-1 rounded-app-md border border-app-border/60 px-2 py-1">
            <button
              type="button"
              onClick={() => setFontSize(Math.max(12, fontSize - 2))}
              className="cursor-pointer border-none bg-transparent p-1 text-xs text-app-faint hover:text-app-text"
            >
              A−
            </button>
            <Type size={16} className="text-app-muted" aria-hidden />
            <button
              type="button"
              onClick={() => setFontSize(Math.min(24, fontSize + 2))}
              className="cursor-pointer border-none bg-transparent p-1 text-sm text-app-faint hover:text-app-text"
            >
              A+
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <main
          className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-6 sm:py-10"
          onScroll={handleScroll}
        >
          <Surface variant="default" padding="lg" className="mx-auto max-w-3xl">
            <header className="mb-8">
              <h1 className="mb-4 text-[28px] font-extrabold leading-tight tracking-tight text-app-text sm:text-[32px]">
                {title}
              </h1>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-app-accent to-app-accent-deep text-sm font-bold text-white">
                    {(authorName || title || 'U')
                      .split(' ')
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()}
                  </div>
                  <div>
                    <div className="text-[13px] font-medium text-app-text">{authorName}</div>
                    <div className="text-[11px] text-app-faint">
                      {loading ? 'Loading…' : loadError ? 'Error' : 'Loaded'} · {readTimeLabel}
                    </div>
                  </div>
                </div>
              </div>
            </header>

            <div className="leading-relaxed text-app-muted" style={{ fontSize }}>
              {loadError ? (
                <p className="m-0 text-sm text-red-300">{loadError}</p>
              ) : hasTipTapDoc ? (
                <div className="tiptap-content" style={{ fontSize }}>
                  <TipTapReadonly
                    doc={bodyDoc as any}
                    className="ProseMirror text-app-muted leading-relaxed outline-none"
                    onSelectionChange={setSelection}
                  />
                </div>
              ) : (
                <p className="m-0 text-sm text-app-faint">
                  {loading ? 'Loading content…' : 'No published body found for this item.'}
                </p>
              )}
            </div>

            <div className="mt-8 border-t border-app-border/80 pt-6">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-app-accent-muted px-3 py-1 text-xs text-app-accent">
                  {contentId ? `ID ${contentId.slice(0, 8)}…` : '—'}
                </span>
              </div>
            </div>

            <div className="mt-8 flex justify-between rounded-app-xl border border-app-border/70 bg-app-bg/40 px-5 py-5">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-full border-none bg-app-accent-muted px-4 py-2 text-[13px] text-app-accent"
                  onClick={() => void toggleLike()}
                  title={engagementLoading ? 'Loading…' : likedByMe ? 'Unlike' : 'Like'}
                >
                  <ThumbsUp
                    size={16}
                    className={likedByMe ? 'fill-app-accent text-app-accent' : ''}
                  />{' '}
                  Helpful
                  <span className="ml-1 text-[11px] text-app-faint">({likesCount})</span>
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-full border border-app-border/80 bg-app-bg/50 px-4 py-2 text-[13px] text-app-muted"
                  onClick={() => {
                    const next = !commentsOpen;
                    setCommentsOpen(next);
                    if (next && contentId) void loadComments(contentId);
                  }}
                  title={commentsOpen ? 'Hide comments' : 'Show comments'}
                >
                  <MessageSquare size={16} /> Comments
                  <span className="ml-1 text-[11px] text-app-faint">({commentsCount})</span>
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-app-faint">
                <span className="rounded-full bg-app-bg/40 px-3 py-1">Views: {viewsCount}</span>
              </div>
            </div>

            {commentsOpen ? (
              <div className="mt-5 rounded-app-xl border border-app-border/70 bg-app-bg/30 p-5">
                <h3 className="mb-3 text-sm font-semibold text-app-text">Comments</h3>

                <div className="rounded-app-lg border border-app-border/60 bg-app-bg/35 p-3">
                  <label
                    htmlFor="reading-new-comment"
                    className="block text-[10px] font-semibold uppercase tracking-wide text-app-faint"
                  >
                    Add a comment
                  </label>
                  <textarea
                    id="reading-new-comment"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write your comment…"
                    className="mt-2 w-full rounded-app-md border border-app-border bg-app-bg/40 px-3 py-2 text-xs text-app-text outline-none"
                    rows={3}
                  />
                  {commentError ? (
                    <p className="mt-2 mb-0 text-[11px] text-red-300">{commentError}</p>
                  ) : null}
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => void submitComment()}
                      disabled={commentSaving}
                      className="rounded-app-md border border-app-accent/35 bg-app-accent-muted px-4 py-2 text-xs font-medium text-app-accent transition-colors hover:bg-app-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {commentSaving ? 'Posting…' : 'Post comment'}
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3">
                  {commentsLoading ? (
                    <div className="rounded-app-lg border border-app-border/60 bg-app-bg/35 p-3 text-xs text-app-faint">
                      Loading comments…
                    </div>
                  ) : comments.length === 0 ? (
                    <div className="rounded-app-lg border border-app-border/60 bg-app-bg/35 p-3 text-xs text-app-faint">
                      No comments yet.
                    </div>
                  ) : (
                    comments.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-app-lg border border-app-border/60 bg-app-bg/35 p-3"
                      >
                        <p className="mb-2 text-xs text-app-muted">{c.body}</p>
                        <div className="text-[10px] text-app-faint">
                          {(c.author?.displayName || c.author?.email || '—') as string} ·{' '}
                          {new Date(c.createdAt).toLocaleString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}

            <div className="mt-12">
              <h2 className="mb-5 text-lg font-bold text-app-text">Related content</h2>
              <div className="flex flex-col gap-3">
                {relatedLoading ? (
                  <div className="rounded-app-lg border border-app-border/80 bg-app-bg/30 p-4 text-sm text-app-faint">
                    Loading related content…
                  </div>
                ) : related.length === 0 ? (
                  <div className="rounded-app-lg border border-app-border/80 bg-app-bg/30 p-4 text-sm text-app-faint">
                    No related content found.
                  </div>
                ) : (
                  related.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigate(`/library/${item.id}`)}
                      className="cursor-pointer rounded-app-lg border border-app-border/80 bg-app-bg/30 p-4 text-left transition-all duration-200 hover:border-app-accent/30 hover:bg-app-accent-muted/50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="mb-1 truncate text-sm font-semibold text-app-text">
                            {item.title}
                          </h3>
                          <span className="text-xs text-app-faint">
                            {item.type} · {item.readTime} · {item.authorName}
                          </span>
                        </div>
                        <ChevronRight size={20} className="shrink-0 text-app-faint" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </Surface>
        </main>

        <Surface
          variant="glass"
          padding="md"
          className="max-h-[42vh] w-full shrink-0 overflow-y-auto border-t border-app-border/80 lg:max-h-none lg:w-[280px] lg:border-l lg:border-t-0"
        >
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-app-faint">
            Annotations
          </h3>
          <div className="rounded-app-lg border border-app-border/60 bg-app-bg/35 p-3">
            <label
              htmlFor="reading-new-annotation"
              className="block text-[10px] font-semibold uppercase tracking-wide text-app-faint"
            >
              New annotation
            </label>
            <textarea
              id="reading-new-annotation"
              value={annotationBody}
              onChange={(e) => setAnnotationBody(e.target.value)}
              placeholder={
                canAttachSelection ? 'Add a note for the selected text…' : 'Add a general note…'
              }
              className="mt-2 w-full rounded-app-md border border-app-border bg-app-bg/40 px-3 py-2 text-xs text-app-text outline-none"
              rows={3}
            />
            {annotationError ? (
              <p className="mt-2 mb-0 text-[11px] text-red-300">{annotationError}</p>
            ) : null}
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void submitAnnotation({ attachToSelection: true })}
                disabled={annotationSaving || !canAttachSelection}
                className="w-full rounded-app-md border border-app-accent/35 bg-app-accent-muted px-4 py-2 text-xs font-medium text-app-accent transition-colors hover:bg-app-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
                title={
                  canAttachSelection
                    ? 'Attach to selected text'
                    : 'Select text in the article to enable'
                }
              >
                {annotationSaving ? 'Saving…' : 'Add annotation to selection'}
              </button>
              <button
                type="button"
                onClick={() => void submitAnnotation({ attachToSelection: false })}
                disabled={annotationSaving}
                className="w-full rounded-app-md border border-app-border/70 bg-app-bg/40 px-4 py-2 text-xs font-medium text-app-muted transition-colors hover:border-app-accent/25 hover:text-app-text disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add general annotation
              </button>
            </div>
          </div>

          <h4 className="mt-5 mb-2 text-[10px] font-semibold uppercase tracking-wide text-app-faint">
            Recent
          </h4>
          {annotationsLoading ? (
            <div className="rounded-app-lg border border-app-border/60 bg-app-bg/35 p-3 text-xs text-app-faint">
              Loading annotations…
            </div>
          ) : annotations.length === 0 ? (
            <div className="rounded-app-lg border border-app-border/60 bg-app-bg/35 p-3 text-xs text-app-faint">
              No annotations yet.
            </div>
          ) : (
            <div className="mt-2 flex flex-col gap-3">
              {annotations.map((note) => (
                <div
                  key={note.id}
                  className="rounded-app-lg border border-app-border/60 border-l-[3px] border-l-app-accent bg-app-bg/35 p-3"
                >
                  {note.selectionText ? (
                    <p className="mb-2 text-[11px] text-app-faint">
                      “{note.selectionText.slice(0, 140)}
                      {note.selectionText.length > 140 ? '…' : ''}”
                    </p>
                  ) : null}
                  <p className="mb-2 text-xs text-app-muted">{note.body}</p>
                  <div className="text-[10px] text-app-faint">
                    {note.authorName} · {new Date(note.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Surface>
      </div>
    </div>
  );
}
