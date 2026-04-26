import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Bookmark,
  Copy,
  Share2,
  MessageSquare,
  ThumbsUp,
  ChevronLeft,
  ChevronRight,
  Type,
  Languages,
} from 'lucide-react';
import { Surface } from '../components/ui/Surface';
import TipTapReadonly from '../components/editor/TipTapReadonly';
import TranslatePlainTextModal from '../components/common/TranslatePlainTextModal';
import {
  contentService,
  type ContentComment,
  type ReadingProgressStatus,
  type ReactionEmoji,
} from '../services/contentService';
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

const REACTION_CHOICES: Array<{ emoji: ReactionEmoji; label: string; glyph: string }> = [
  { emoji: 'LIKE', label: 'Like', glyph: '👍' },
  { emoji: 'LOVE', label: 'Love', glyph: '❤️' },
  { emoji: 'CLAP', label: 'Clap', glyph: '👏' },
  { emoji: 'INSIGHTFUL', label: 'Insightful', glyph: '💡' },
  { emoji: 'LAUGH', label: 'Laugh', glyph: '😂' },
  { emoji: 'CELEBRATE', label: 'Celebrate', glyph: '🎉' },
];

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
  const [readingPercent, setReadingPercent] = useState(0);
  const [readingStatus, setReadingStatus] = useState<ReadingProgressStatus>('NOT_STARTED');
  const [progressSaving, setProgressSaving] = useState(false);
  const [progressHydrated, setProgressHydrated] = useState(false);
  const mainScrollRef = useRef<HTMLDivElement | null>(null);
  const skipNextScrollSyncRef = useRef(false);
  const appliedInitialProgressRef = useRef(false);
  const [fontSize, setFontSize] = useState(16);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [viewsCount, setViewsCount] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);
  const [likedByMe, setLikedByMe] = useState(false);
  const [engagementLoading, setEngagementLoading] = useState(false);

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [comments, setComments] = useState<ContentComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyOpenFor, setReplyOpenFor] = useState<string | null>(null);
  const [commentSaving, setCommentSaving] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Array<{ emoji: ReactionEmoji; count: number }>>(
    REACTION_CHOICES.map((r) => ({ emoji: r.emoji, count: 0 })),
  );
  const [myReaction, setMyReaction] = useState<ReactionEmoji | null>(null);
  const [reactionBusy, setReactionBusy] = useState(false);

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
  const [translateOpen, setTranslateOpen] = useState(false);
  const [translateSource, setTranslateSource] = useState<{ text: string; modeLabel: string } | null>(
    null,
  );

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const denom = scrollHeight - clientHeight;
    const progress = denom > 0 ? (scrollTop / denom) * 100 : 0;
    setScrollProgress(progress);
    const nextPercent = Math.max(0, Math.min(100, Math.round(progress)));
    setReadingPercent(nextPercent);
    if (nextPercent >= 100) setReadingStatus('DONE');
    else if (nextPercent > 0 && readingStatus === 'NOT_STARTED') setReadingStatus('READING');
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
    appliedInitialProgressRef.current = false;
    setProgressHydrated(false);
    void (async () => {
      try {
        const p = await contentService.getReadingProgress(contentId);
        if (cancelled) return;
        setReadingPercent(p.percent);
        setReadingStatus(p.status);
        setScrollProgress(p.percent);
      } catch {
        if (cancelled) return;
        setReadingPercent(0);
        setReadingStatus('NOT_STARTED');
      } finally {
        if (!cancelled) setProgressHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contentId]);

  useEffect(() => {
    if (!progressHydrated || !mainScrollRef.current || loading) return;
    if (appliedInitialProgressRef.current) return;
    const el = mainScrollRef.current;
    const maxScrollable = Math.max(0, el.scrollHeight - el.clientHeight);
    if (maxScrollable <= 0) {
      appliedInitialProgressRef.current = true;
      return;
    }
    const target = Math.round((readingPercent / 100) * maxScrollable);
    skipNextScrollSyncRef.current = true;
    el.scrollTop = target;
    appliedInitialProgressRef.current = true;
    window.setTimeout(() => {
      skipNextScrollSyncRef.current = false;
    }, 120);
  }, [progressHydrated, loading, contentId]);

  useEffect(() => {
    if (!contentId || !progressHydrated) return;
    if (skipNextScrollSyncRef.current) return;
    const timer = window.setTimeout(() => {
      setProgressSaving(true);
      void contentService
        .patchReadingProgress(contentId, { percent: readingPercent })
        .then((row) => {
          setReadingPercent(row.percent);
          setReadingStatus(row.status);
          setScrollProgress(row.percent);
        })
        .catch(() => undefined)
        .finally(() => setProgressSaving(false));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [contentId, readingPercent, progressHydrated]);

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
        const total = rows.reduce((acc, item) => acc + 1 + (item.replies?.length ?? 0), 0);
        setCommentsCount(total);
      } catch {
        setComments([]);
      } finally {
        setCommentsLoading(false);
      }
    };
  }, []);

  const loadReactions = useMemo(() => {
    return async (id: string) => {
      try {
        const summary = await contentService.getReactions(id);
        setReactions(summary.counts);
        setMyReaction(summary.myReaction);
      } catch {
        setReactions(REACTION_CHOICES.map((r) => ({ emoji: r.emoji, count: 0 })));
        setMyReaction(null);
      }
    };
  }, []);

  useEffect(() => {
    if (!contentId) return;
    void loadReactions(contentId);
  }, [contentId, loadReactions]);

  useEffect(() => {
    if (!contentId) return;
    const timer = window.setInterval(() => {
      void loadReactions(contentId);
      if (commentsOpen) void loadComments(contentId);
      setEngagementLoading(true);
      void contentService
        .getEngagement(contentId)
        .then((e) => {
          setViewsCount(e.views);
          setLikesCount(e.likes);
          setCommentsCount(e.comments);
          setLikedByMe(!!e.likedByMe);
        })
        .catch(() => undefined)
        .finally(() => setEngagementLoading(false));
    }, 15000);
    return () => window.clearInterval(timer);
  }, [contentId, commentsOpen, loadComments, loadReactions]);

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

  const submitComment = async (parentId?: string) => {
    if (!contentId) return;
    const body = (parentId ? replyDrafts[parentId] : newComment).trim();
    if (!body) {
      setCommentError('Comment text is required');
      return;
    }
    setCommentSaving(true);
    setCommentError(null);
    try {
      await contentService.addComment(contentId, body, parentId ?? null);
      if (parentId) {
        setReplyDrafts((prev) => ({ ...prev, [parentId]: '' }));
        setReplyOpenFor(null);
      } else {
        setNewComment('');
      }
      await loadComments(contentId);
    } catch (e) {
      setCommentError(e instanceof Error ? e.message : 'Failed to add comment');
    } finally {
      setCommentSaving(false);
    }
  };

  const toggleReaction = async (emoji: ReactionEmoji) => {
    if (!contentId || reactionBusy) return;
    setReactionBusy(true);
    try {
      const summary = await contentService.toggleReaction(contentId, emoji);
      setReactions(summary.counts);
      setMyReaction(summary.myReaction);
    } catch {
      // ignore transient failures
    } finally {
      setReactionBusy(false);
    }
  };

  const setManualReadingStatus = async (status: ReadingProgressStatus) => {
    if (!contentId) return;
    setProgressSaving(true);
    try {
      const payload: { status: ReadingProgressStatus; percent?: number } = { status };
      if (status === 'DONE') payload.percent = 100;
      if (status === 'NOT_STARTED') payload.percent = 0;
      const row = await contentService.patchReadingProgress(contentId, payload);
      setReadingPercent(row.percent);
      setReadingStatus(row.status);
      setScrollProgress(row.percent);
    } catch {
      // ignore transient failures; polling/debounce will reconcile later
    } finally {
      setProgressSaving(false);
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
        const cards = primaryIds.length ? await hydrateCards(primaryIds) : [];

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

  const openReadingTranslate = () => {
    const sel = selection.text.trim();
    if (sel) {
      setTranslateSource({ text: sel, modeLabel: 'Selected text in the article' });
      setTranslateOpen(true);
      return;
    }
    if (hasTipTapDoc) {
      setTranslateSource({
        text: tipTapJsonToPlainText(bodyDoc),
        modeLabel: 'Full article (plain text extracted from layout)',
      });
      setTranslateOpen(true);
    }
  };

  const copySourceText = useMemo(() => {
    const selected = selection.text.trim();
    if (selected) return selected;
    if (hasTipTapDoc) {
      return tipTapJsonToPlainText(bodyDoc).trim();
    }
    return '';
  }, [selection.text, hasTipTapDoc, bodyDoc]);

  const writeClipboardWithFallback = async (text: string): Promise<void> => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch {
        // fallback below
      }
    }
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    area.style.top = '0';
    document.body.appendChild(area);
    area.focus();
    area.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(area);
    if (!copied) {
      throw new Error('Clipboard copy failed');
    }
  };

  const handleCopyWithAttribution = async () => {
    if (!contentId || !copySourceText || copyBusy) return;
    setCopyBusy(true);
    setCopyMessage(null);
    try {
      const policy = await contentService.getCopyPolicy(contentId);
      const textToCopy =
        policy.enabled && policy.footer
          ? `${copySourceText}\n\n${policy.footer}`
          : copySourceText;
      await writeClipboardWithFallback(textToCopy);
      setCopyMessage(policy.enabled && policy.footer ? 'Copied with attribution' : 'Copied');
    } catch (e) {
      setCopyMessage(e instanceof Error ? e.message : 'Copy failed');
    } finally {
      setCopyBusy(false);
      window.setTimeout(() => setCopyMessage(null), 2200);
    }
  };

  const handleShare = async () => {
    if (!contentId) return;
    const canonicalUrl = `${window.location.origin}/library/${contentId}`;
    const shareText = `${title} — ${canonicalUrl}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text: title,
          url: canonicalUrl,
        });
        return;
      }
      await writeClipboardWithFallback(shareText);
      setCopyMessage('Link copied');
      window.setTimeout(() => setCopyMessage(null), 2200);
    } catch {
      // user cancel or share unavailable failure
    }
  };

  return (
    <div className="reading-layout-root relative flex h-screen min-h-0 flex-col overflow-hidden bg-app-bg text-app-text">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute left-1/2 top-0 h-[38vh] w-[min(100%,680px)] -translate-x-1/2 bg-[radial-gradient(ellipse_at_50%_0%,rgba(147,124,248,0.06),transparent_60%)]" />
        <div className="absolute bottom-0 right-0 h-56 w-56 rounded-full bg-app-accent-2/8 blur-[88px]" />
      </div>

      <div className="relative z-20 h-[2px] shrink-0 bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-app-accent via-app-accent-hover to-app-accent-2 shadow-[0_0_12px_rgba(147,124,248,0.35)] transition-[width] duration-150 ease-out"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      <header className="relative z-20 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] bg-app-bg/70 px-4 py-2.5 backdrop-blur-2xl supports-backdrop-filter:bg-app-bg/50 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => navigate('/library')}
            className="rounded-app-md p-2 text-app-faint transition-colors hover:bg-white/[0.06] hover:text-app-text"
            aria-label="Back to library"
          >
            <ChevronLeft size={20} strokeWidth={2} />
          </button>
          <span className="text-[12px] font-medium tracking-wide text-app-muted">
            Back to library
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-2 rounded-app-md border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[11px] sm:text-xs">
            <span className="hidden pl-1 font-medium text-app-faint sm:inline">Progress</span>
            <div className="flex items-center rounded-app-sm border border-white/10 bg-app-bg/40 p-0.5">
              {([
                { value: 'NOT_STARTED', label: 'Not Started' },
                { value: 'READING', label: 'Reading' },
                { value: 'DONE', label: 'Done' },
              ] as const).map((opt) => {
                const active = readingStatus === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => void setManualReadingStatus(opt.value)}
                    disabled={!contentId || progressSaving}
                    className={`rounded-app-sm px-2 py-1 text-[10px] font-medium transition-colors sm:px-2.5 sm:text-[11px] ${
                      active
                        ? 'bg-app-accent/20 text-app-accent'
                        : 'text-app-faint hover:bg-white/[0.06] hover:text-app-text'
                    }`}
                    title={`Set status: ${opt.label}`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <span className="tabular-nums text-app-faint">{readingPercent}%</span>
          </div>
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
            className={`flex items-center gap-1.5 rounded-app-md border px-3 py-2 text-[11px] font-semibold transition-colors sm:text-xs ${
              bookmarked
                ? 'border-app-accent/40 bg-app-accent/12 text-app-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                : 'border-white/10 bg-white/[0.04] text-app-muted hover:border-app-accent/25 hover:text-app-text'
            }`}
          >
            <Bookmark
              size={16}
              strokeWidth={2}
              className={bookmarked ? 'fill-app-accent text-app-accent' : ''}
            />
            {bookmarkBusy ? 'Saving…' : bookmarked ? 'Saved' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => void handleCopyWithAttribution()}
            disabled={copyBusy || !copySourceText}
            className="flex items-center gap-1.5 rounded-app-md border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-medium text-app-muted transition-colors hover:border-white/16 hover:text-app-text disabled:cursor-not-allowed disabled:opacity-60 sm:text-xs"
            title={
              copySourceText
                ? 'Copy selected text (or full article) with attribution policy'
                : 'No readable content to copy'
            }
          >
            <Copy size={16} strokeWidth={2} />
            {copyBusy ? 'Copying…' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={() => void handleShare()}
            className="flex items-center gap-1.5 rounded-app-md border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-medium text-app-muted transition-colors hover:border-white/16 hover:text-app-text sm:text-xs"
          >
            <Share2 size={16} strokeWidth={2} /> Share
          </button>
          <button
            type="button"
            onClick={openReadingTranslate}
            disabled={!hasTipTapDoc && !selection.text.trim()}
            title="Translate selection or full article as plain text (not saved)"
            className="flex items-center gap-1.5 rounded-app-md border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-100 transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-40 sm:text-xs"
          >
            <Languages size={16} strokeWidth={2} />
            <span className="hidden sm:inline">Translate</span>
          </button>
          <div className="flex items-center gap-0.5 rounded-app-md border border-white/10 bg-white/[0.03] px-1 py-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <button
              type="button"
              onClick={() => setFontSize(Math.max(12, fontSize - 2))}
              className="cursor-pointer rounded-app-sm border-none bg-transparent px-2 py-1 text-[11px] font-medium text-app-faint transition-colors hover:bg-white/[0.06] hover:text-app-text"
            >
              A−
            </button>
            <Type size={15} className="text-app-muted opacity-80" aria-hidden strokeWidth={2} />
            <button
              type="button"
              onClick={() => setFontSize(Math.min(24, fontSize + 2))}
              className="cursor-pointer rounded-app-sm border-none bg-transparent px-2 py-1 text-[12px] font-medium text-app-faint transition-colors hover:bg-white/[0.06] hover:text-app-text"
            >
              A+
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <main
          ref={mainScrollRef}
          className="reading-main-scroll min-h-0 flex-1 scroll-smooth overflow-y-auto px-4 py-8 sm:px-8 sm:py-10 md:px-12 md:py-12"
          onScroll={handleScroll}
        >
          <Surface
            variant="glass"
            padding="none"
            className="mx-auto max-w-[min(100%,42rem)] overflow-hidden border border-white/[0.09] shadow-app-lift"
          >
            <div className="border-b border-white/[0.06] px-6 pb-8 pt-10 sm:px-10 sm:pb-10 sm:pt-12">
              {loading ? (
                <div className="mb-3 h-3 w-24 animate-pulse rounded bg-white/10" />
              ) : (
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-app-faint">
                  {contentTypeLabel(currentType)}
                </p>
              )}
              <header className="mb-0">
                {loading ? (
                  <div className="mb-6 space-y-2">
                    <div className="h-9 w-full animate-pulse rounded bg-white/10" />
                    <div className="h-9 w-2/3 animate-pulse rounded bg-white/10" />
                  </div>
                ) : (
                  <h1 className="mb-6 font-serif text-[clamp(1.65rem,4vw,2.25rem)] font-semibold leading-[1.15] tracking-[-0.03em] text-app-text">
                    {title}
                  </h1>
                )}
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-app-accent/90 to-app-accent-deep text-sm font-bold text-white shadow-[0_0_20px_-6px_rgba(147,124,248,0.5)]">
                      {(authorName || title || 'U')
                        .split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()}
                    </div>
                    {loading ? (
                      <div className="space-y-1.5">
                        <div className="h-4 w-28 animate-pulse rounded bg-white/10" />
                        <div className="h-3 w-20 animate-pulse rounded bg-white/10" />
                      </div>
                    ) : (
                      <div>
                        <div className="text-[14px] font-medium tracking-tight text-app-text">
                          {authorName}
                        </div>
                        <div className="mt-0.5 text-[11px] text-app-muted">
                          {loadError ? 'Error' : 'Loaded'} · {readTimeLabel}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </header>
            </div>

            <div className="border-b border-white/[0.06] px-6 py-10 sm:px-10 sm:py-12">
              <div
                className="leading-[1.8] text-[15px] text-app-muted/95 sm:text-base"
                style={{ fontSize }}
              >
                {loadError ? (
                  <p className="m-0 text-sm leading-relaxed text-red-400">{loadError}</p>
                ) : loading ? (
                  <div className="space-y-3">
                    <div className="h-4 w-full animate-pulse rounded bg-white/10" />
                    <div className="h-4 w-11/12 animate-pulse rounded bg-white/10" />
                    <div className="h-4 w-10/12 animate-pulse rounded bg-white/10" />
                    <div className="h-4 w-9/12 animate-pulse rounded bg-white/10" />
                    <div className="h-4 w-10/12 animate-pulse rounded bg-white/10" />
                  </div>
                ) : hasTipTapDoc ? (
                  <div className="tiptap-content" style={{ fontSize }}>
                    <TipTapReadonly
                      doc={bodyDoc as any}
                      className="ProseMirror reading-body-prose leading-[1.75] outline-none antialiased"
                      onSelectionChange={setSelection}
                    />
                  </div>
                ) : (
                  <p className="m-0 text-[15px] leading-relaxed text-app-faint">
                    {loading ? 'Loading content…' : 'No published body found for this item.'}
                  </p>
                )}
              </div>
            </div>

            <div className="border-b border-white/[0.06] px-6 py-5 sm:px-10">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-app-accent/25 bg-app-accent/10 px-3 py-1 text-[11px] font-medium text-app-accent">
                  {contentId ? `ID ${contentId.slice(0, 8)}…` : '—'}
                </span>
              </div>
            </div>

            {/* ─── Engagement Bar ─────────────────────────────────────────────── */}
            <div className="border-t border-white/[0.06] px-6 pb-2 pt-5 sm:px-10">
              {/* Reaction pills row */}
              <div className="mb-4">
                <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-app-faint">
                  React to this article
                </p>
                <div className="flex flex-wrap gap-2">
                  {REACTION_CHOICES.map((item) => {
                    const count = reactions.find((r) => r.emoji === item.emoji)?.count ?? 0;
                    const active = myReaction === item.emoji;
                    return (
                      <button
                        key={item.emoji}
                        type="button"
                        disabled={reactionBusy}
                        onClick={() => void toggleReaction(item.emoji)}
                        title={item.label}
                        aria-pressed={active}
                        className={[
                          'group/rxn relative flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-all duration-200 select-none',
                          active
                            ? 'border-app-accent/50 bg-gradient-to-br from-app-accent/20 to-app-accent-2/15 text-app-text shadow-[0_0_18px_-6px_rgba(147,124,248,0.45),inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-app-accent/25'
                            : 'border-white/10 bg-white/[0.04] text-app-muted hover:border-white/20 hover:bg-white/[0.08] hover:text-app-text',
                        ].join(' ')}
                      >
                        <span
                          className="text-[18px] leading-none transition-transform duration-150 group-hover/rxn:scale-125"
                          style={{ display: 'inline-block' }}
                        >
                          {item.glyph}
                        </span>
                        {count > 0 && (
                          <span
                            className={`tabular-nums text-[11px] font-semibold leading-none ${active ? 'text-app-accent' : 'text-app-muted'}`}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action row: like · comments · views */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={[
                      'flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold transition-all duration-200',
                      likedByMe
                        ? 'border-app-accent/40 bg-app-accent/12 text-app-accent shadow-[0_0_16px_-6px_rgba(147,124,248,0.4)]'
                        : 'border-white/10 bg-white/[0.04] text-app-muted hover:border-app-accent/25 hover:bg-app-accent/8 hover:text-app-text',
                    ].join(' ')}
                    onClick={() => void toggleLike()}
                    title={engagementLoading ? 'Loading…' : likedByMe ? 'Unlike' : 'Like'}
                  >
                    <ThumbsUp
                      size={14}
                      strokeWidth={2.5}
                      className={likedByMe ? 'fill-app-accent text-app-accent' : ''}
                    />
                    Helpful
                    {likesCount > 0 && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums leading-none ${likedByMe ? 'bg-app-accent/20 text-app-accent' : 'bg-white/[0.06] text-app-faint'}`}
                      >
                        {likesCount}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    className={[
                      'flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-medium transition-all duration-200',
                      commentsOpen
                        ? 'border-white/18 bg-white/[0.07] text-app-text'
                        : 'border-white/10 bg-white/[0.04] text-app-muted hover:border-white/18 hover:bg-white/[0.07] hover:text-app-text',
                    ].join(' ')}
                    onClick={() => {
                      const next = !commentsOpen;
                      setCommentsOpen(next);
                      if (next && contentId) void loadComments(contentId);
                    }}
                    title={commentsOpen ? 'Hide comments' : 'Show comments'}
                  >
                    <MessageSquare size={14} strokeWidth={2.5} />
                    Discussion
                    {commentsCount > 0 && (
                      <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold tabular-nums leading-none text-app-faint">
                        {commentsCount}
                      </span>
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] tabular-nums text-app-faint">
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <span className="font-medium">{viewsCount.toLocaleString()}</span>
                  <span className="text-app-faint/60">views</span>
                </div>
              </div>
            </div>

            {commentsOpen ? (
              <div className="border-t border-white/[0.06] bg-white/[0.015] px-6 py-8 sm:px-10">
                <div className="mb-5 flex items-center gap-2">
                  <MessageSquare size={16} strokeWidth={2} className="text-app-accent" />
                  <h3 className="font-serif text-lg font-semibold tracking-tight text-app-text">
                    Discussion
                  </h3>
                  {commentsCount > 0 && (
                    <span className="rounded-full border border-app-accent/30 bg-app-accent/12 px-2.5 py-0.5 text-[11px] font-semibold text-app-accent">
                      {commentsCount}
                    </span>
                  )}
                </div>

                {/* New comment composer */}
                <div className="mb-6 overflow-hidden rounded-app-xl border border-white/10 bg-app-bg/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <textarea
                    id="reading-new-comment"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Share your thoughts on this article…"
                    className="w-full resize-none bg-transparent px-4 py-4 text-[13px] leading-relaxed text-app-text placeholder-app-faint outline-none"
                    rows={3}
                  />
                  <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2.5">
                    {commentError ? (
                      <p className="text-[11px] text-red-400">{commentError}</p>
                    ) : (
                      <span className="text-[11px] text-app-faint">
                        {newComment.length > 0 ? `${newComment.length} chars` : 'Be respectful and constructive'}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => void submitComment()}
                      disabled={commentSaving || !newComment.trim()}
                      className="rounded-full bg-gradient-to-r from-app-accent to-app-accent-2 px-5 py-1.5 text-[12px] font-semibold text-app-bg shadow-[0_0_18px_-8px_rgba(147,124,248,0.5)] transition-[filter,opacity] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {commentSaving ? 'Posting…' : 'Post'}
                    </button>
                  </div>
                </div>

                {/* Comments list */}
                <div className="flex flex-col gap-3">
                  {commentsLoading ? (
                    <div className="space-y-3">
                      {[1, 2].map((i) => (
                        <div key={i} className="rounded-app-xl border border-white/[0.06] bg-white/[0.02] p-4">
                          <div className="flex gap-3">
                            <div className="app-skeleton-shimmer size-8 shrink-0 rounded-full" />
                            <div className="flex-1 space-y-2">
                              <div className="app-skeleton-shimmer h-3 w-28 rounded-full" />
                              <div className="app-skeleton-shimmer h-3 w-full rounded-full" />
                              <div className="app-skeleton-shimmer h-3 w-3/4 rounded-full" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : comments.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-app-xl border border-dashed border-white/10 py-10 text-center">
                      <MessageSquare size={24} strokeWidth={1.5} className="text-app-faint" />
                      <p className="text-[13px] text-app-muted">No comments yet. Start the discussion!</p>
                    </div>
                  ) : (
                    comments.map((c) => {
                      const authorInitials = (c.author?.displayName || c.author?.email || 'U')
                        .split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase();
                      return (
                        <div
                          key={c.id}
                          className="group/comment overflow-hidden rounded-app-xl border border-white/[0.07] bg-white/[0.025] transition-[border-color] duration-200 hover:border-white/12"
                        >
                          <div className="p-4">
                            <div className="mb-3 flex items-start gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-app-accent/70 to-app-accent-deep/80 text-[11px] font-bold text-white shadow-[0_0_14px_-4px_rgba(147,124,248,0.4)]">
                                {authorInitials}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-baseline gap-2">
                                  <span className="text-[13px] font-semibold text-app-text">
                                    {(c.author?.displayName || c.author?.email || '—') as string}
                                  </span>
                                  <span className="text-[11px] tabular-nums text-app-faint">
                                    {new Date(c.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </span>
                                </div>
                                <p className="mt-2 text-[13px] leading-relaxed text-app-text/85">
                                  {c.body}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 pl-11">
                              <button
                                type="button"
                                className="text-[11px] font-medium text-app-faint transition-colors hover:text-app-accent"
                                onClick={() => setReplyOpenFor(replyOpenFor === c.id ? null : c.id)}
                              >
                                {replyOpenFor === c.id ? '↩ Cancel' : '↩ Reply'}
                              </button>
                              {(c.replies ?? []).length > 0 && (
                                <span className="text-[11px] text-app-faint">
                                  {(c.replies ?? []).length} {(c.replies ?? []).length === 1 ? 'reply' : 'replies'}
                                </span>
                              )}
                            </div>
                          </div>

                          {replyOpenFor === c.id ? (
                            <div className="border-t border-white/[0.06] bg-white/[0.02] px-4 pb-4 pt-3">
                              <div className="flex gap-2">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-app-muted">
                                  Me
                                </div>
                                <div className="flex-1 overflow-hidden rounded-app-lg border border-white/10 bg-app-bg/50">
                                  <textarea
                                    value={replyDrafts[c.id] ?? ''}
                                    onChange={(e) =>
                                      setReplyDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))
                                    }
                                    placeholder="Write a reply…"
                                    className="w-full resize-none bg-transparent px-3 py-2.5 text-[12px] leading-relaxed text-app-text placeholder-app-faint outline-none"
                                    rows={2}
                                  />
                                  <div className="flex justify-end border-t border-white/[0.06] px-3 py-2">
                                    <button
                                      type="button"
                                      onClick={() => void submitComment(c.id)}
                                      disabled={commentSaving || !(replyDrafts[c.id] ?? '').trim()}
                                      className="rounded-full bg-gradient-to-r from-app-accent to-app-accent-2 px-4 py-1 text-[11px] font-semibold text-app-bg transition-[filter,opacity] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      {commentSaving ? 'Posting…' : 'Reply'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : null}

                          {(c.replies ?? []).length > 0 ? (
                            <div className="border-t border-white/[0.04] bg-white/[0.01] px-4 py-3">
                              <div className="space-y-3 pl-8 border-l border-white/[0.07]">
                                {(c.replies ?? []).map((r) => {
                                  const replyInitials = (r.author?.displayName || r.author?.email || 'U')
                                    .split(' ')
                                    .filter(Boolean)
                                    .slice(0, 2)
                                    .map((n) => n[0])
                                    .join('')
                                    .toUpperCase();
                                  return (
                                    <div key={r.id} className="flex items-start gap-2.5">
                                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-app-accent-2/60 to-teal-500/50 text-[9px] font-bold text-white">
                                        {replyInitials}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-baseline gap-1.5">
                                          <span className="text-[12px] font-semibold text-app-text">
                                            {(r.author?.displayName || r.author?.email || '—') as string}
                                          </span>
                                          <span className="text-[10px] tabular-nums text-app-faint">
                                            {new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                          </span>
                                        </div>
                                        <p className="mt-1 text-[12px] leading-relaxed text-app-text/80">
                                          {r.body}
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}

            <div className="border-t border-white/[0.06] px-6 pb-10 pt-10 sm:px-10 sm:pb-12">
              <h2 className="mb-6 font-serif text-xl font-semibold tracking-tight text-app-text">
                Related content
              </h2>
              <div className="flex flex-col gap-2.5">
                {relatedLoading ? (
                  <div className="rounded-app-xl border border-white/10 bg-white/[0.03] p-5 text-[13px] text-app-faint">
                    Loading related content…
                  </div>
                ) : related.length === 0 ? (
                  <div className="rounded-app-xl border border-white/10 bg-white/[0.03] p-5 text-[13px] text-app-muted">
                    No related content found.
                  </div>
                ) : (
                  related.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigate(`/library/${item.id}`)}
                      className="group cursor-pointer rounded-app-xl border border-white/[0.08] bg-white/[0.03] p-5 text-left transition-[border-color,background-color,transform] duration-200 ease-out hover:border-app-accent/30 hover:bg-app-accent/8 active:scale-[0.99]"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="mb-1.5 truncate font-medium leading-snug tracking-tight text-app-text group-hover:text-app-accent">
                            {item.title}
                          </h3>
                          <span className="text-[12px] text-app-muted">
                            {item.type} · {item.readTime} · {item.authorName}
                          </span>
                        </div>
                        <ChevronRight
                          size={20}
                          strokeWidth={2}
                          className="shrink-0 text-app-faint transition-transform group-hover:translate-x-0.5 group-hover:text-app-accent"
                        />
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
          className="max-h-[40vh] w-full shrink-0 overflow-y-auto scroll-smooth border-t border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] lg:max-h-none lg:w-[272px] lg:border-l lg:border-t-0"
        >
          <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-app-faint">
            Annotations
          </h3>
          <div className="rounded-app-xl border border-white/10 bg-white/[0.03] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <label
              htmlFor="reading-new-annotation"
              className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-app-faint"
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
              className="mt-2 w-full rounded-app-md border border-white/10 bg-app-bg/50 px-3 py-2.5 text-[12px] leading-relaxed text-app-text outline-none focus:border-app-accent/40 focus:ring-2 focus:ring-app-accent/15"
              rows={3}
            />
            {annotationError ? (
              <p className="mt-2 mb-0 text-[11px] text-red-400">{annotationError}</p>
            ) : null}
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void submitAnnotation({ attachToSelection: true })}
                disabled={annotationSaving || !canAttachSelection}
                className="w-full rounded-app-md border border-app-accent/40 bg-app-accent/12 px-4 py-2.5 text-[12px] font-semibold text-app-accent transition-colors hover:bg-app-accent/18 disabled:cursor-not-allowed disabled:opacity-50"
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
                className="w-full rounded-app-md border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[12px] font-medium text-app-muted transition-colors hover:border-white/16 hover:bg-white/[0.06] hover:text-app-text disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add general annotation
              </button>
            </div>
          </div>

          <h4 className="mb-2 mt-6 text-[10px] font-semibold uppercase tracking-[0.14em] text-app-faint">
            Recent
          </h4>
          {annotationsLoading ? (
            <div className="rounded-app-lg border border-white/10 bg-white/[0.03] p-3 text-[12px] text-app-faint">
              Loading annotations…
            </div>
          ) : annotations.length === 0 ? (
            <div className="rounded-app-lg border border-white/10 bg-white/[0.03] p-3 text-[12px] text-app-muted">
              No annotations yet.
            </div>
          ) : (
            <div className="mt-2 flex flex-col gap-2.5">
              {annotations.map((note) => (
                <div
                  key={note.id}
                  className="rounded-app-lg border border-white/[0.08] border-l-[3px] border-l-app-accent bg-white/[0.03] p-3.5"
                >
                  {note.selectionText ? (
                    <p className="mb-2 text-[11px] leading-relaxed text-app-muted">
                      “{note.selectionText.slice(0, 140)}
                      {note.selectionText.length > 140 ? '…' : ''}”
                    </p>
                  ) : null}
                  <p className="mb-2 text-[12px] leading-relaxed text-app-text/90">{note.body}</p>
                  <div className="text-[10px] text-app-faint">
                    {note.authorName} · {new Date(note.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Surface>
      </div>
      <TranslatePlainTextModal
        open={translateOpen}
        onClose={() => {
          setTranslateOpen(false);
          setTranslateSource(null);
        }}
        subjectLabel={title}
        contextHint="Library · reading view"
        sourceModeLabel={translateSource?.modeLabel ?? ''}
        sourceText={translateSource?.text ?? ''}
        cautionText="This translation runs in your browser only. It is not saved to this article and does not change what other readers see. To publish translated text, edit the content in the editor and save a new version. Only plain text is sent — formatting and embedded media are not preserved."
      />
      {copyMessage ? (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50 rounded-app-md border border-white/12 bg-app-bg/90 px-3 py-2 text-xs text-app-text shadow-app-lift backdrop-blur-md">
          {copyMessage}
        </div>
      ) : null}
    </div>
  );
}
