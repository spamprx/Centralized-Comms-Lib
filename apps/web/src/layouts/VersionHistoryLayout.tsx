import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GitCompare, RotateCcw, Clock, FileText, ChevronDown, Users } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { PageShell } from '../components/ui/PageShell';
import { Surface } from '../components/ui/Surface';
import {
  contentService,
  normalizeVersionListPayload,
  type ContentVersion,
} from '../services/contentService';
import { getStaticVersionHistory } from '../data/mockContentVersionHistory';
import { getVersionHistoryMode } from '../config/versionHistory';
import { tipTapJsonToPlainText } from '../lib/tipTapPlainText';
import { diffWords, type WordDiffPart } from '../lib/wordDiff';
import TipTapReadonly from '../components/editor/TipTapReadonly';

const PAGE_SIZE = 20;

const NOTICE_STATIC_PENDING =
  'Sample timeline shown first. Loading live versions from the API…';
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

function normalizeServerSegments(
  segments: Array<{ type: string; text: string }>,
): WordDiffPart[] {
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
  const compareTo = compareId ? sortedVersions.find((v) => v.id === compareId) ?? null : null;

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
    if (!window.confirm(`Restore version ${selected.versionNumber} as a new head revision?`)) return;
    setRestoreError(null);
    setRestoreBusy(true);
    try {
      const doc = versionTipTapDoc(selected);
      const isDoc =
        doc && typeof doc === 'object' && doc !== null && 'type' in (doc as Record<string, unknown>);
      if (!isDoc) {
        throw new Error('Selected version has no body to restore.');
      }

      // Restore by rewriting the head body (creates a new MANUAL_SAVE version server-side).
      await contentService.saveDraft(contentId, { body: doc });
      navigate(`/editor/${contentId}`);
    } catch (e) {
      setRestoreError(e instanceof Error ? e.message : 'Restore failed');
    } finally {
      setRestoreBusy(false);
    }
  };

  if (!contentId) {
    return (
      <PageShell wide className="flex min-h-0 flex-1 flex-col pb-10">
        <PageHeader title="Version history" accentWord="history" description="Missing content id in URL." />
      </PageShell>
    );
  }

  return (
    <PageShell wide className="flex min-h-0 flex-1 flex-col pb-10">
      <PageHeader
        title={contentTitle ? `Version history — ${contentTitle}` : 'Version history'}
        accentWord="history"
        description="Open History from My Content, the editor toolbar, or a review assignment. Use Compare for word-level changes."
      />

      {demoNotice && (
        <Surface variant="muted" padding="md" className="mb-4 border border-sky-500/25 bg-sky-500/10 text-sm text-sky-100">
          {demoNotice}
        </Surface>
      )}

      {loadError && (
        <Surface variant="muted" padding="md" className="mb-4 border border-red-500/30 bg-red-500/10 text-sm text-red-200">
          {loadError}
        </Surface>
      )}

      {collaborationActive && (
        <Surface variant="muted" padding="md" className="mb-4 flex items-start gap-3 border border-amber-400/25 bg-amber-500/10 text-sm text-amber-100">
          <Users className="mt-0.5 shrink-0 opacity-90" size={18} />
          <div>
            <p className="m-0 font-semibold">Co-author session active</p>
            <p className="mt-1 mb-0 text-xs text-amber-100/85">
              Restoring a snapshot is disabled until the live collaboration session ends (F-AUT-004).
            </p>
          </div>
        </Surface>
      )}

      {restoreError && (
        <Surface variant="muted" padding="md" className="mb-4 border border-red-500/30 bg-red-500/10 text-sm text-red-200">
          {restoreError}
        </Surface>
      )}

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(260px,320px)_1fr]">
        <Surface variant="glass" padding="none" className="flex max-h-[min(70vh,640px)] flex-col overflow-hidden lg:max-h-none">
          <div className="border-b border-app-border/80 px-5 py-4">
            <h2 className="m-0 text-sm font-semibold text-app-text">Timeline</h2>
            <p className="mt-1 m-0 text-[11px] text-app-faint">
              {apiHydrating
                ? 'Connecting to API…'
                : loading
                  ? 'Loading…'
                  : `${sortedVersions.length} loaded${hasMore ? ' · more available' : ''}`}
            </p>
          </div>
          <div className="relative flex-1 overflow-y-auto p-3">
            <div
              className="pointer-events-none absolute bottom-4 left-[1.35rem] top-4 w-px bg-gradient-to-b from-app-accent/45 via-app-border to-transparent"
              aria-hidden
            />
            <div className="relative flex flex-col gap-2">
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
                    className={`relative rounded-app-lg border p-3.5 pl-10 text-left transition-all duration-200 ${
                      active
                        ? 'border-app-accent/40 bg-app-accent-muted shadow-app-soft'
                        : 'border-app-border/60 bg-app-bg/35 hover:border-app-border-strong hover:bg-app-elevated'
                    }`}
                  >
                    <span
                      className={`absolute left-3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 ${
                        active
                          ? 'border-app-accent bg-app-accent shadow-[0_0_12px_rgba(147,124,248,0.45)]'
                          : 'border-app-border-strong bg-app-bg-subtle'
                      }`}
                      aria-hidden
                    />
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className={`text-xs font-bold ${active ? 'text-app-accent' : 'text-app-text'}`}>
                        v{version.versionNumber}
                      </span>
                      {isHeadRow && (
                        <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-300">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="mb-1 text-[11px] font-medium text-app-muted">{changeTypeLabel(version.changeType)}</p>
                    <p className="mb-1.5 line-clamp-2 text-[11px] leading-snug text-app-faint">{version.title}</p>
                    <div className="flex items-center gap-2 text-[10px] text-app-faint">
                      <Clock size={10} className="shrink-0 opacity-80" />
                      {new Date(version.createdAt).toLocaleString()}
                    </div>
                    <div className="mt-1 text-[10px] text-app-faint">
                      {actorLabel(version.authorId, primaryAuthorId, primaryAuthorName, coAuthors)}
                    </div>

                    {showDiff && selected && selected.id !== version.id && (
                      <label
                        onClick={(e) => e.stopPropagation()}
                        className={`absolute right-3 top-3 flex cursor-pointer items-center gap-1 text-[10px] ${
                          compareId === version.id ? 'text-app-accent' : 'text-app-faint'
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
              <div className="p-3 pt-1">
                <button
                  type="button"
                  disabled={loadingMore || loading}
                  onClick={() => void loadPage(false)}
                  className="flex w-full items-center justify-center gap-1 rounded-app-md border border-app-border/70 bg-app-bg/40 py-2 text-[11px] font-medium text-app-muted hover:border-app-accent/30 hover:text-app-text disabled:opacity-50"
                >
                  <ChevronDown size={14} />
                  {loadingMore ? 'Loading…' : 'Load older versions'}
                </button>
              </div>
            )}
          </div>
        </Surface>

        <div className="flex min-h-0 min-w-0 flex-col gap-4">
          <Surface variant="default" padding="md" className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-app-lg bg-app-accent-muted text-app-accent">
                <FileText size={20} strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <h2 className="m-0 text-sm font-semibold text-app-text">
                  {selected ? (
                    <>
                      v{selected.versionNumber} — {changeTypeLabel(selected.changeType)}
                    </>
                  ) : (
                    'Select a version'
                  )}
                </h2>
                <p className="mt-0.5 m-0 text-[11px] text-app-faint">
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
                className={`flex items-center gap-1.5 rounded-app-md px-3.5 py-2 text-xs transition-colors ${
                  showDiff
                    ? 'bg-app-accent-muted text-app-accent shadow-[0_0_0_1px_rgba(147,124,248,0.2)]'
                    : 'border border-app-border/80 bg-app-bg/40 text-app-muted hover:border-app-accent/25 hover:text-app-text'
                }`}
              >
                <GitCompare size={14} /> {showDiff ? 'Hide diff' : 'Compare'}
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
                  className="flex items-center gap-1.5 rounded-app-md border border-emerald-400/35 bg-emerald-500/10 px-3.5 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => void onRestore()}
                >
                  <RotateCcw size={14} /> {restoreBusy ? 'Restoring…' : 'Restore as new version'}
                </button>
              )}
            </div>
          </Surface>

          <Surface variant="muted" padding="md" className="min-h-[280px] flex-1 overflow-auto lg:min-h-0">
            {!selected ? (
              <p className="m-0 text-sm text-app-muted">No version selected.</p>
            ) : showDiff ? (
              <div>
                {!compareTo ? (
                  <p className="m-0 text-sm text-app-muted">
                    Pick a baseline version from the timeline (radio on another row) to compare against v
                    {selected.versionNumber}.
                  </p>
                ) : diffLoading && !serverDiffParts ? (
                  <p className="m-0 text-sm text-app-muted">Computing diff…</p>
                ) : (
                  <>
                    <h3 className="mb-3 text-sm font-semibold text-app-text">
                      Changes from v{compareTo.versionNumber} → v{selected.versionNumber}
                    </h3>
                    <div className="mb-4 flex flex-wrap gap-3">
                      <div className="min-w-[120px] flex-1 rounded-app-md bg-emerald-500/10 px-3 py-2">
                        <span className="text-[10px] uppercase tracking-wide text-emerald-200/90">Inserted</span>
                        <p className="m-0 mt-0.5 text-xs text-emerald-100">{diffStats.added} characters</p>
                      </div>
                      <div className="min-w-[120px] flex-1 rounded-app-md bg-red-500/10 px-3 py-2">
                        <span className="text-[10px] uppercase tracking-wide text-red-200/90">Removed</span>
                        <p className="m-0 mt-0.5 text-xs text-red-100">{diffStats.removed} characters</p>
                      </div>
                    </div>
                    <div
                      className="rounded-app-lg bg-app-bg/50 p-4 text-[13px] leading-relaxed text-app-muted"
                      style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                    >
                      {diffParts.map((part, i) => {
                        if (part.type === 'insert') {
                          return (
                            <mark
                              key={i}
                              className="bg-emerald-500/25 text-emerald-100"
                              style={{ padding: '0 2px', borderRadius: 2 }}
                            >
                              {part.text}
                            </mark>
                          );
                        }
                        if (part.type === 'delete') {
                          return (
                            <del key={i} className="bg-red-500/20 text-red-100/95">
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
                  doc && typeof doc === 'object' && doc !== null && 'type' in (doc as Record<string, unknown>);
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
                      <div className="space-y-3">
                        <p className="m-0 text-[12px] text-app-faint">
                          No body was captured for this lifecycle-only snapshot. Showing body from v{prevWithBody.versionNumber}.
                        </p>
                        <div className="tiptap-content">
                          <TipTapReadonly
                            doc={fallbackDoc as any}
                            className="ProseMirror text-[13px] leading-relaxed text-app-muted outline-none"
                          />
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
                  <div className="tiptap-content">
                    <TipTapReadonly
                      doc={doc as any}
                      className="ProseMirror text-[13px] leading-relaxed text-app-muted outline-none"
                    />
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
