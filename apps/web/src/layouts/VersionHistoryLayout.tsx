import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  GitCompare,
  GitCommitVertical,
  RotateCcw,
  Clock,
  FileText,
  ChevronDown,
  Users,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { PageShell } from '../components/ui/PageShell';
import { Surface } from '../components/ui/Surface';
import {
  contentService,
  ContentSaveConflictError,
  normalizeVersionListPayload,
  type ContentVersion,
} from '../services/contentService';
import { getStaticVersionHistory } from '../data/mockContentVersionHistory';
import { getVersionHistoryMode } from '../config/versionHistory';
import { tipTapJsonToPlainText } from '../lib/tipTapPlainText';
import { diffWords, type WordDiffPart } from '../lib/wordDiff';
import TipTapReadonly from '../components/editor/TipTapReadonly';

const PAGE_SIZE = 20;

const NOTICE_STATIC_PENDING = 'Sample timeline shown first. Loading live versions from the API…';
const NOTICE_STATIC_API_FAILED =
  'Sample timeline — could not load live data from the API (you can still explore the UI).';
const NOTICE_API_FIRST_FALLBACK =
  'Showing sample timeline because the content API did not respond.';
const NOTICE_STATIC_ONLY =
  'Static mode (VITE_VERSION_HISTORY_MODE=static): sample data only; enable default or api-first to integrate the API.';

function changeTypeLabel(changeType: string): string {
  switch (changeType) {
    case 'MANUAL_SAVE':
      return 'Saved';
    case 'STATE_TRANSITION':
      return 'Lifecycle change';
    case 'RESTORE':
      return 'Restored from history';
    case 'AI_GENERATED':
      return 'AI draft';
    default:
      return changeType.replace(/_/g, ' ').toLowerCase();
  }
}

function actorLabel(
  authorId: string,
  primaryAuthorId: string,
  primaryAuthorName: string,
  coAuthors: Array<{ id: string; displayName: string }>,
): string {
  if (authorId === primaryAuthorId) return primaryAuthorName || 'Primary author';
  const co = coAuthors.find((c) => c.id === authorId);
  return co?.displayName ?? 'Unknown user';
}

function versionPlainText(v: ContentVersion): string {
  if (v.body != null) return tipTapJsonToPlainText(v.body);
  const meta = v.metadataSnapshot;
  if (meta && typeof meta === 'object' && meta !== null && 'body' in meta) {
    return tipTapJsonToPlainText((meta as { body: unknown }).body);
  }
  return '';
}

function versionTipTapDoc(v: ContentVersion): unknown | null {
  if (v.body != null) return v.body;
  const meta = v.metadataSnapshot;
  if (meta && typeof meta === 'object' && meta !== null && 'body' in meta) {
    return (meta as { body: unknown }).body ?? null;
  }
  return null;
}

function normalizeServerSegments(segments: Array<{ type: string; text: string }>): WordDiffPart[] {
  return segments.map((s) => {
    const t = s.type;
    if (t === 'insert' || t === 'added') return { type: 'insert', text: s.text };
    if (t === 'delete' || t === 'removed') return { type: 'delete', text: s.text };
    return { type: 'equal', text: s.text };
  });
}

export default function VersionHistoryLayout() {
  const { contentId } = useParams<{ contentId: string }>();
  const navigate = useNavigate();

  const [contentTitle, setContentTitle] = useState<string>('');
  const [primaryAuthorId, setPrimaryAuthorId] = useState<string>('');
  const [primaryAuthorName, setPrimaryAuthorName] = useState<string>('Primary author');
  const [coAuthors, setCoAuthors] = useState<Array<{ id: string; displayName: string }>>([]);

  const [versions, setVersions] = useState<ContentVersion[]>([]);
  /** Next server `offset` for pagination (monotonic for the current content id). */
  const nextFetchOffsetRef = useRef(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [apiHydrating, setApiHydrating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** When true, timeline is demo data (or not yet replaced by API in static-then-api mode). */
  const usingStaticFallbackRef = useRef(false);
  const [isStaticHistory, setIsStaticHistory] = useState(false);
  const [demoNotice, setDemoNotice] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  const [collaborationActive, setCollaborationActive] = useState(false);
  const [serverDiffParts, setServerDiffParts] = useState<WordDiffPart[] | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const sortedVersions = useMemo(
    () => [...versions].sort((a, b) => b.versionNumber - a.versionNumber),
    [versions],
  );

  const headVersion = sortedVersions[0] ?? null;
  const selected = sortedVersions.find((v) => v.id === selectedId) ?? headVersion;
  const compareTo = compareId ? (sortedVersions.find((v) => v.id === compareId) ?? null) : null;

  const refreshCollaboration = useCallback(async () => {
    if (!contentId || usingStaticFallbackRef.current) return;
    try {
      const active = await contentService.getCollaborationActive(contentId);
      setCollaborationActive(active);
    } catch {
      setCollaborationActive(false);
    }
  }, [contentId]);

  const applyStaticData = useCallback((id: string, notice: string) => {
    usingStaticFallbackRef.current = true;
    setIsStaticHistory(true);
    const demo = getStaticVersionHistory(id);
    setContentTitle(demo.contentTitle);
    setPrimaryAuthorId(demo.primaryAuthorId);
    setCoAuthors(demo.coAuthors);
    setVersions(demo.versions);
    setHasMore(false);
    nextFetchOffsetRef.current = demo.versions.length;
    const newest = [...demo.versions].sort((a, b) => b.versionNumber - a.versionNumber)[0];
    if (newest) setSelectedId(newest.id);
    setDemoNotice(notice);
    setLoadError(null);
  }, []);

  const applyLiveFetchResult = useCallback(
    (
      detail: Awaited<ReturnType<typeof contentService.getById>>,
      rawList: unknown,
      opts: { resetList: boolean; fetchOffset: number },
    ) => {
      setContentTitle(detail.content.title);
      setPrimaryAuthorId(detail.content.authorId);
      setPrimaryAuthorName(detail.content.author?.displayName || 'Primary author');
      setCoAuthors(detail.coAuthors);
      const { items, total } = normalizeVersionListPayload(rawList);
      const { resetList, fetchOffset } = opts;

      setVersions((prev) => {
        const merged = resetList ? items : [...prev, ...items];
        const byId = new Map<string, ContentVersion>();
        for (const v of merged) byId.set(v.id, v);
        return [...byId.values()].sort((a, b) => b.versionNumber - a.versionNumber);
      });

      const nextOffset = fetchOffset + items.length;
      nextFetchOffsetRef.current = nextOffset;
      setHasMore(items.length === PAGE_SIZE && (total == null || nextOffset < total));

      setSelectedId((sid) => {
        if (!resetList) return sid;
        if (items.length === 0) return null;
        return sid && items.some((x) => x.id === sid) ? sid : items[0]!.id;
      });

      usingStaticFallbackRef.current = false;
      setIsStaticHistory(false);
      setDemoNotice(null);
    },
    [],
  );

  const loadPage = useCallback(
    async (initial: boolean) => {
      if (!contentId) return;
      if (!initial && usingStaticFallbackRef.current) return;
      if (initial) {
        setLoading(true);
        setLoadError(null);
        nextFetchOffsetRef.current = 0;
        usingStaticFallbackRef.current = false;
        setIsStaticHistory(false);
        setDemoNotice(null);
      } else {
        setLoadingMore(true);
      }
      try {
        const offset = initial ? 0 : nextFetchOffsetRef.current;
        const [detail, rawList] = await Promise.all([
          contentService.getById(contentId),
          contentService.listVersions(contentId, { limit: PAGE_SIZE, offset }),
        ]);
        applyLiveFetchResult(detail, rawList, { resetList: initial, fetchOffset: offset });
      } catch {
        if (initial) {
          applyStaticData(contentId, NOTICE_API_FIRST_FALLBACK);
        } else {
          setLoadError('Could not load older versions.');
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [contentId, applyLiveFetchResult, applyStaticData],
  );

  useEffect(() => {
    if (!contentId) return;
    const mode = getVersionHistoryMode();

    setCompareId(null);
    setShowDiff(false);
    setLoadError(null);
    setRestoreError(null);
    setApiHydrating(false);

    if (mode === 'static') {
      applyStaticData(contentId, NOTICE_STATIC_ONLY);
      setLoading(false);
      setHasMore(false);
      return;
    }

    if (mode === 'api-first') {
      setVersions([]);
      setSelectedId(null);
      nextFetchOffsetRef.current = 0;
      usingStaticFallbackRef.current = false;
      setIsStaticHistory(false);
      setDemoNotice(null);
      void loadPage(true);
      return;
    }

    // Default: static-then-api — seed UI, then hydrate from API
    applyStaticData(contentId, NOTICE_STATIC_PENDING);
    setLoading(false);
    setApiHydrating(true);
    void (async () => {
      try {
        const [detail, rawList] = await Promise.all([
          contentService.getById(contentId),
          contentService.listVersions(contentId, { limit: PAGE_SIZE, offset: 0 }),
        ]);
        applyLiveFetchResult(detail, rawList, { resetList: true, fetchOffset: 0 });
      } catch {
        setDemoNotice(NOTICE_STATIC_API_FAILED);
      } finally {
        setApiHydrating(false);
      }
    })();
  }, [contentId, applyStaticData, applyLiveFetchResult, loadPage]);

  useEffect(() => {
    if (!contentId || isStaticHistory) {
      setCollaborationActive(false);
      return;
    }
    void refreshCollaboration();
    const id = window.setInterval(() => void refreshCollaboration(), 20000);
    return () => window.clearInterval(id);
  }, [contentId, refreshCollaboration, isStaticHistory]);

  useEffect(() => {
    if (!showDiff || !selected || !compareTo || !contentId) {
      setServerDiffParts(null);
      setDiffLoading(false);
      return;
    }
    if (isStaticHistory) {
      setServerDiffParts(diffWords(versionPlainText(compareTo), versionPlainText(selected)));
      setDiffLoading(false);
      return;
    }
    let cancelled = false;
    setDiffLoading(true);
    setServerDiffParts(null);
    void (async () => {
      try {
        const fromId = compareTo.id;
        const toId = selected.id;
        const server = await contentService.getVersionsDiff(contentId, fromId, toId);
        if (cancelled) return;
        if (server && server.length > 0) {
          setServerDiffParts(normalizeServerSegments(server));
        } else {
          const a = versionPlainText(compareTo);
          const b = versionPlainText(selected);
          setServerDiffParts(diffWords(a, b));
        }
      } finally {
        if (!cancelled) setDiffLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showDiff, selected, compareTo, contentId, isStaticHistory]);

  const clientDiffParts = useMemo(() => {
    if (!selected || !compareTo) return [];
    return diffWords(versionPlainText(compareTo), versionPlainText(selected));
  }, [selected, compareTo]);

  const diffParts = serverDiffParts ?? clientDiffParts;

  const diffStats = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const p of diffParts) {
      if (p.type === 'insert') added += p.text.length;
      if (p.type === 'delete') removed += p.text.length;
    }
    return { added, removed };
  }, [diffParts]);

  const toggleCompare = () => {
    setShowDiff((d) => {
      const next = !d;
      if (next && selected && sortedVersions.length > 1) {
        const idx = sortedVersions.findIndex((v) => v.id === selected.id);
        const older = sortedVersions[idx + 1];
        setCompareId((cid) => cid ?? older?.id ?? null);
      }
      if (!next) setCompareId(null);
      return next;
    });
  };

  const onRestore = async () => {
    if (!contentId || !selected || !headVersion) return;
    if (selected.id === headVersion.id) return;
    if (isStaticHistory) return;
    if (collaborationActive) return;
    if (!window.confirm(`Restore version ${selected.versionNumber} as a new head revision?`))
      return;
    setRestoreError(null);
    setRestoreBusy(true);
    try {
      const doc = versionTipTapDoc(selected);
      const isDoc =
        doc &&
        typeof doc === 'object' &&
        doc !== null &&
        'type' in (doc as Record<string, unknown>);
      if (!isDoc) {
        throw new Error('Selected version has no body to restore.');
      }

      // Restore via dedicated endpoint (server blocks if other editors are present).
      await contentService.restoreVersion(contentId, selected.id, {
        baseVersionNumber: headVersion.versionNumber,
      });
      navigate(`/editor/${contentId}`);
    } catch (e) {
      if (e instanceof ContentSaveConflictError) {
        setRestoreError(
          `Head revision changed (now ${e.currentVersionNumber}). Refresh this page, then try restore again.`,
        );
      } else {
        setRestoreError(e instanceof Error ? e.message : 'Restore failed');
      }
    } finally {
      setRestoreBusy(false);
    }
  };

  if (!contentId) {
    return (
      <PageShell wide className="version-history-layout-root flex min-h-0 flex-1 flex-col pb-10">
        <PageHeader
          title="Version history"
          accentWord="history"
          description="Missing content id in URL."
        />
      </PageShell>
    );
  }

  return (
    <PageShell wide className="version-history-layout-root flex min-h-0 flex-1 flex-col pb-10">
      <PageHeader
        title={contentTitle ? `Version history — ${contentTitle}` : 'Version history'}
        accentWord="history"
        description="Open History from My Content, the editor toolbar, or a review assignment. Use Compare for word-level changes."
      />

      {demoNotice && (
        <Surface
          variant="muted"
          padding="md"
          className="mb-5 border border-sky-400/20 bg-sky-500/[0.08] text-sm text-sky-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md"
        >
          {demoNotice}
        </Surface>
      )}

      {loadError && (
        <Surface
          variant="muted"
          padding="md"
          className="mb-5 border border-red-400/25 bg-red-500/[0.08] text-sm text-red-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md"
        >
          {loadError}
        </Surface>
      )}

      {collaborationActive && (
        <Surface
          variant="muted"
          padding="md"
          className="mb-5 flex items-start gap-3 border border-amber-400/25 bg-amber-500/[0.1] text-sm text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md"
        >
          <Users className="mt-0.5 shrink-0 text-amber-200/90" size={18} strokeWidth={1.75} />
          <div className="min-w-0 flex-1">
            <p className="m-0 font-semibold tracking-tight">Co-author session active</p>
            <p className="mb-0 mt-1 text-xs text-amber-100/90">
              Restoring a snapshot is disabled until the live collaboration session ends
              (F-AUT-004).
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (!contentId) return;
              await contentService.requestRestore(contentId);
            }}
            className="shrink-0 rounded-lg border border-amber-300/35 bg-amber-500/[0.12] px-3 py-1.5 text-xs font-semibold text-amber-50 hover:bg-amber-500/[0.18]"
            title="Ask active editors to leave so you can restore"
          >
            Notify editors
          </button>
        </Surface>
      )}

      {restoreError && (
        <Surface
          variant="muted"
          padding="md"
          className="mb-5 border border-red-400/25 bg-red-500/[0.08] text-sm text-red-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="min-w-0">{restoreError}</span>
            {restoreError.toLowerCase().includes('ask them to leave') ? (
              <button
                type="button"
                onClick={async () => {
                  if (!contentId) return;
                  await contentService.requestRestore(contentId);
                }}
                className="shrink-0 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/[0.1]"
              >
                Notify editors
              </button>
            ) : null}
          </div>
        </Surface>
      )}

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(300px,380px)_1fr] lg:gap-10">
        <Surface
          variant="glass"
          padding="none"
          className="relative flex max-h-[min(74vh,720px)] flex-col overflow-hidden rounded-app-xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent shadow-app-lift ring-1 ring-white/[0.04] backdrop-blur-2xl supports-backdrop-filter:bg-app-bg/30 lg:max-h-none"
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-app-accent/50 to-app-accent-2/35"
            aria-hidden
          />
          <div className="flex items-start gap-3 border-b border-white/[0.08] px-5 py-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-app-lg border border-app-accent/30 bg-app-accent/10 text-app-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <GitCommitVertical size={20} strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-app-accent/90">
                Timeline
              </p>
              <h2 className="mt-1 m-0 text-base font-semibold tracking-tight text-app-text">
                Revisions
              </h2>
              <p className="mt-1 m-0 text-[11px] leading-snug text-app-muted">
                {apiHydrating
                  ? 'Connecting to API…'
                  : loading
                    ? 'Loading…'
                    : `${sortedVersions.length} loaded${hasMore ? ' · more available' : ''}`}
              </p>
            </div>
          </div>
          <div className="version-history-timeline-scroll relative min-h-0 flex-1 overflow-y-auto scroll-smooth px-3 pb-2 pt-3 [mask-image:linear-gradient(to_bottom,transparent,black_10px,black_calc(100%-8px),transparent)]">
            <div
              className="pointer-events-none absolute bottom-8 left-[1.125rem] top-6 w-[2px] rounded-full bg-gradient-to-b from-app-accent/70 via-app-accent-2/35 to-white/5 shadow-[0_0_24px_rgba(147,124,248,0.35)]"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute bottom-8 left-[1.125rem] top-6 w-5 -translate-x-1/2 bg-gradient-to-b from-app-accent/25 via-app-accent/5 to-transparent blur-md"
              aria-hidden
            />
            <div className="relative flex flex-col gap-3 pl-0.5">
              {sortedVersions.map((version) => {
                const active = selected?.id === version.id;
                const isHeadRow = headVersion?.id === version.id;
                return (
                  <button
                    type="button"
                    key={version.id}
                    onClick={() => {
                      setSelectedId(version.id);
                      if (!showDiff) setCompareId(null);
                    }}
                    className={`version-timeline-card group relative rounded-app-xl border py-3.5 pl-11 pr-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out motion-reduce:transition-none ${
                      active
                        ? 'version-timeline-card--active border-app-accent/50 bg-gradient-to-br from-app-accent/[0.14] to-white/[0.03] shadow-[inset_4px_0_0_0_rgba(147,124,248,0.85),inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-app-accent/25'
                        : 'border-white/[0.06] bg-white/[0.025] hover:-translate-y-px hover:border-white/12 hover:bg-white/[0.06] hover:shadow-[inset_3px_0_0_0_rgba(255,255,255,0.08)]'
                    }`}
                  >
                    <span
                      className={`absolute left-[1.125rem] top-1/2 z-[1] flex h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 transition-shadow duration-200 ${
                        active
                          ? 'border-app-accent bg-gradient-to-br from-white to-app-accent-muted shadow-[0_0_0_5px_rgba(147,124,248,0.22),0_0_22px_rgba(147,124,248,0.5)]'
                          : 'border-white/30 bg-app-bg/90 group-hover:border-app-accent/45 group-hover:shadow-[0_0_14px_rgba(147,124,248,0.28)]'
                      }`}
                      aria-hidden
                    >
                      {active ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-app-accent" aria-hidden />
                      ) : null}
                    </span>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span
                        className={`font-mono text-xs font-bold tabular-nums ${active ? 'text-app-accent' : 'text-app-text'}`}
                      >
                        v{version.versionNumber}
                      </span>
                      {isHeadRow && (
                        <span className="rounded-app-md border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-200">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="mb-1 text-[11px] font-medium text-app-muted">
                      {changeTypeLabel(version.changeType)}
                    </p>
                    <p className="mb-1.5 line-clamp-2 text-[11px] leading-snug text-app-faint">
                      {version.title}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] tabular-nums text-app-faint">
                      <Clock size={11} className="shrink-0 opacity-80" strokeWidth={2} />
                      {new Date(version.createdAt).toLocaleString()}
                    </div>
                    <div className="mt-1 text-[10px] text-app-muted">
                      {actorLabel(version.authorId, primaryAuthorId, primaryAuthorName, coAuthors)}
                    </div>

                    {showDiff && selected && selected.id !== version.id && (
                      <label
                        onClick={(e) => e.stopPropagation()}
                        className={`absolute right-2.5 top-2.5 flex cursor-pointer items-center gap-1.5 rounded-app-md border border-white/[0.06] bg-app-bg/50 px-2 py-1 text-[10px] font-medium backdrop-blur-sm ${
                          compareId === version.id
                            ? 'border-app-accent/40 text-app-accent'
                            : 'text-app-faint hover:border-white/12 hover:text-app-muted'
                        }`}
                      >
                        <input
                          type="radio"
                          name="compare-version"
                          checked={compareId === version.id}
                          onChange={() => setCompareId(version.id)}
                          className="accent-app-accent"
                        />
                        Baseline
                      </label>
                    )}
                  </button>
                );
              })}
            </div>
            {hasMore && (
              <div className="p-3 pt-2">
                <button
                  type="button"
                  disabled={loadingMore || loading}
                  onClick={() => void loadPage(false)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-app-lg border border-white/10 bg-white/[0.03] py-2.5 text-[11px] font-medium text-app-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:border-app-accent/30 hover:bg-white/[0.06] hover:text-app-text disabled:opacity-50"
                >
                  <ChevronDown size={14} strokeWidth={2} />
                  {loadingMore ? 'Loading…' : 'Load older versions'}
                </button>
              </div>
            )}
          </div>
        </Surface>

        <div className="flex min-h-0 min-w-0 flex-col gap-6">
          <Surface
            variant="default"
            padding="md"
            className="relative flex flex-wrap items-center justify-between gap-4 rounded-app-xl border border-white/[0.09] bg-app-surface/75 shadow-[0_12px_48px_-16px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl supports-backdrop-filter:bg-app-surface/60"
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
              aria-hidden
            />
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-app-lg border border-app-accent/25 bg-app-accent/10 text-app-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <FileText size={20} strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <h2 className="m-0 text-sm font-semibold tracking-tight text-app-text">
                  {selected ? (
                    <>
                      v{selected.versionNumber} — {changeTypeLabel(selected.changeType)}
                    </>
                  ) : (
                    'Select a version'
                  )}
                </h2>
                <p className="mt-0.5 m-0 text-[11px] text-app-muted">
                  {selected
                    ? `${new Date(selected.createdAt).toLocaleString()} · ${actorLabel(
                        selected.authorId,
                        primaryAuthorId,
                        primaryAuthorName,
                        coAuthors,
                      )}`
                    : '—'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggleCompare}
                className={`flex items-center gap-1.5 rounded-app-lg border px-3.5 py-2 text-xs font-medium transition-all duration-200 ${
                  showDiff
                    ? 'border-app-accent/40 bg-app-accent/12 text-app-accent shadow-[0_0_20px_-8px_rgba(147,124,248,0.45)]'
                    : 'border-white/10 bg-white/[0.04] text-app-muted hover:border-app-accent/25 hover:bg-white/[0.07] hover:text-app-text'
                }`}
              >
                <GitCompare size={14} strokeWidth={2} /> {showDiff ? 'Hide diff' : 'Compare'}
              </button>
              {selected && headVersion && selected.id !== headVersion.id && (
                <button
                  type="button"
                  disabled={restoreBusy || collaborationActive || isStaticHistory}
                  title={
                    isStaticHistory
                      ? 'Demo timeline — connect the API to restore for real'
                      : collaborationActive
                        ? 'Cannot restore while a co-author session is active'
                        : 'Creates a new head revision from this snapshot'
                  }
                  className="flex items-center gap-1.5 rounded-app-lg border border-emerald-400/35 bg-emerald-500/[0.1] px-3.5 py-2 text-xs font-semibold text-emerald-100 shadow-[0_0_18px_-10px_rgba(16,185,129,0.35)] transition-colors hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => void onRestore()}
                >
                  <RotateCcw size={14} strokeWidth={2} />{' '}
                  {restoreBusy ? 'Restoring…' : 'Restore as new version'}
                </button>
              )}
            </div>
          </Surface>

          <Surface
            variant="muted"
            padding="md"
            className="min-h-[280px] flex-1 overflow-auto rounded-app-xl border border-white/[0.07] bg-gradient-to-b from-app-bg/50 to-app-bg/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md lg:min-h-0"
          >
            {!selected ? (
              <p className="m-0 text-sm text-app-muted">No version selected.</p>
            ) : showDiff ? (
              <div className="version-history-canvas rounded-app-xl border border-white/[0.06] bg-white/[0.02] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                {!compareTo ? (
                  <p className="m-0 text-sm text-app-muted">
                    Pick a baseline version from the timeline (radio on another row) to compare
                    against v{selected.versionNumber}.
                  </p>
                ) : diffLoading && !serverDiffParts ? (
                  <p className="m-0 text-sm text-app-muted">Computing diff…</p>
                ) : (
                  <>
                    <h3 className="mb-1 text-sm font-semibold tracking-tight text-app-text">
                      Changes from v{compareTo.versionNumber} → v{selected.versionNumber}
                    </h3>
                    <p className="mb-4 mt-0 text-[11px] text-app-faint">
                      Word-level diff — additions and removals highlighted below.
                    </p>
                    <div className="mb-4 flex flex-wrap gap-3">
                      <div className="min-w-[120px] flex-1 rounded-app-lg border border-emerald-400/25 bg-emerald-500/[0.1] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200/95">
                          Inserted
                        </span>
                        <p className="m-0 mt-1 text-xs tabular-nums text-emerald-100">
                          {diffStats.added} characters
                        </p>
                      </div>
                      <div className="min-w-[120px] flex-1 rounded-app-lg border border-red-400/25 bg-red-500/[0.1] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-red-200/95">
                          Removed
                        </span>
                        <p className="m-0 mt-1 text-xs tabular-nums text-red-100">
                          {diffStats.removed} characters
                        </p>
                      </div>
                    </div>
                    <div className="rounded-app-xl border border-white/[0.09] bg-[#080a0f]/90 p-4 font-mono text-[13px] leading-relaxed text-app-muted shadow-[inset_0_3px_32px_rgba(0,0,0,0.45)] whitespace-pre-wrap break-words ring-1 ring-inset ring-white/[0.04]">
                      {diffParts.map((part, i) => {
                        if (part.type === 'insert') {
                          return (
                            <mark
                              key={i}
                              className="rounded px-0.5 text-emerald-100 [box-decoration-break:clone] bg-emerald-500/35"
                            >
                              {part.text}
                            </mark>
                          );
                        }
                        if (part.type === 'delete') {
                          return (
                            <del
                              key={i}
                              className="rounded bg-red-500/30 px-0.5 text-red-100/95 [box-decoration-break:clone]"
                            >
                              {part.text}
                            </del>
                          );
                        }
                        return <span key={i}>{part.text}</span>;
                      })}
                    </div>
                  </>
                )}
              </div>
            ) : (
              (() => {
                const doc = versionTipTapDoc(selected);
                const isDoc =
                  doc &&
                  typeof doc === 'object' &&
                  doc !== null &&
                  'type' in (doc as Record<string, unknown>);
                if (!isDoc) {
                  const prevWithBody = versions.find(
                    (v) => v.versionNumber < selected.versionNumber && versionTipTapDoc(v) != null,
                  );
                  const fallbackDoc = prevWithBody ? versionTipTapDoc(prevWithBody) : null;
                  const fallbackIsDoc =
                    fallbackDoc &&
                    typeof fallbackDoc === 'object' &&
                    fallbackDoc !== null &&
                    'type' in (fallbackDoc as Record<string, unknown>);
                  if (fallbackIsDoc && prevWithBody) {
                    return (
                      <div className="version-history-canvas rounded-app-xl border border-white/[0.06] bg-white/[0.02] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        <div className="version-history-body space-y-3">
                          <p className="m-0 text-[12px] text-app-faint">
                            No body was captured for this lifecycle-only snapshot. Showing body from
                            v{prevWithBody.versionNumber}.
                          </p>
                          <div className="tiptap-content">
                            <TipTapReadonly
                              doc={fallbackDoc as any}
                              className="ProseMirror version-history-prose text-[13px] leading-relaxed text-app-muted outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <p className="m-0 text-[13px] leading-relaxed text-app-faint">
                      (No body captured for this snapshot)
                    </p>
                  );
                }
                return (
                  <div className="version-history-canvas rounded-app-xl border border-white/[0.06] bg-white/[0.02] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <div className="version-history-body tiptap-content">
                      <TipTapReadonly
                        doc={doc as any}
                        className="ProseMirror version-history-prose text-[13px] leading-relaxed text-app-muted outline-none"
                      />
                    </div>
                  </div>
                );
              })()
            )}
          </Surface>
        </div>
      </div>
    </PageShell>
  );
}
