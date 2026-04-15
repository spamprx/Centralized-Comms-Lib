import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMyContent } from '../hooks/useMyContent';
import {
  FileText,
  Video,
  Mic,
  File,
  Edit2,
  Eye,
  Trash2,
  Send,
  MessageCircle,
  History,
  Search,
  Users,
} from 'lucide-react';
import { contentService } from '../services/contentService';
import ManageReviewersModal from '../components/ManageReviewersModal';
import ReviewFeedbackModal from '../components/ReviewFeedbackModal';
import ManageCoAuthorsModal from '../components/content/ManageCoAuthorsModal';
import CoAuthorInvitationsModal from '../components/content/CoAuthorInvitationsModal';
import { PageHeader, PageShell, Surface, formInputClass, formSelectClass } from '../components/ui';
import { useAuth } from '../context/AuthContext';

const typeIcons = {
  article: FileText,
  video: Video,
  podcast: Mic,
  document: File,
};

const typeColors = {
  article: '#8b5cf6',
  video: '#06b6d4',
  podcast: '#f59e0b',
  document: '#10b981',
};

const statusColors = {
  draft: '#6b7280',
  in_review: '#fbbf24',
  published: '#10b981',
  archived: '#555870',
};

export default function MyContentLayout() {
  const { user } = useAuth();
  const {
    contentItems,
    stats,
    loading,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    refreshContent,
  } = useMyContent();
  const [sortBy, setSortBy] = useState('lastModified');
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [reviewModalItem, setReviewModalItem] = useState<{ id: string; title: string } | null>(
    null,
  );
  const [feedbackModalItem, setFeedbackModalItem] = useState<{ id: string; title: string } | null>(
    null,
  );
  const [coAuthorsModalItem, setCoAuthorsModalItem] = useState<{
    id: string;
    title: string;
    canInvite: boolean;
  } | null>(null);
  const [coAuthorInvitesOpen, setCoAuthorInvitesOpen] = useState(false);
  const [pendingCoAuthorInvites, setPendingCoAuthorInvites] = useState<
    Array<{
      contentId: string;
      title: string;
      requestedBy: { displayName: string; email: string };
    }>
  >([]);
  const [pendingCoAuthorLoading, setPendingCoAuthorLoading] = useState(false);
  const [inviteRespondBusy, setInviteRespondBusy] = useState<string | null>(null);
  const [inviteToastVisible, setInviteToastVisible] = useState(false);
  const pendingInviteInitRef = useRef(true);
  const prevPendingLenRef = useRef(0);
  const navigate = useNavigate();

  const loadPendingCoAuthorInvites = useCallback(async () => {
    if (!user?.id) {
      setPendingCoAuthorInvites([]);
      return [];
    }
    setPendingCoAuthorLoading(true);
    try {
      const rows = await contentService.listPendingCoAuthorInvitations();
      setPendingCoAuthorInvites(rows);
      return rows;
    } catch {
      setPendingCoAuthorInvites([]);
      return [];
    } finally {
      setPendingCoAuthorLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadPendingCoAuthorInvites();
  }, [loadPendingCoAuthorInvites]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void loadPendingCoAuthorInvites();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [loadPendingCoAuthorInvites]);

  useEffect(() => {
    if (pendingCoAuthorLoading) return;
    if (pendingInviteInitRef.current) {
      pendingInviteInitRef.current = false;
      prevPendingLenRef.current = pendingCoAuthorInvites.length;
      if (pendingCoAuthorInvites.length > 0) {
        setInviteToastVisible(true);
        globalThis.setTimeout(() => setInviteToastVisible(false), 6500);
      }
      return;
    }
    if (pendingCoAuthorInvites.length > prevPendingLenRef.current) {
      setInviteToastVisible(true);
      globalThis.setTimeout(() => setInviteToastVisible(false), 6500);
    }
    prevPendingLenRef.current = pendingCoAuthorInvites.length;
  }, [pendingCoAuthorInvites.length, pendingCoAuthorLoading]);

  const syncAfterCoAuthorChange = useCallback(async () => {
    await refreshContent();
    await loadPendingCoAuthorInvites();
  }, [refreshContent, loadPendingCoAuthorInvites]);

  const handleCoAuthorInviteRespond = useCallback(
    async (contentId: string, decision: 'APPROVE' | 'REJECT') => {
      setInviteRespondBusy(contentId);
      try {
        await contentService.respondToCoAuthorRequest(contentId, decision);
        await refreshContent();
        const remaining = await loadPendingCoAuthorInvites();
        if (remaining.length === 0) setCoAuthorInvitesOpen(false);
      } catch (e) {
        console.error(e);
      } finally {
        setInviteRespondBusy(null);
      }
    },
    [refreshContent, loadPendingCoAuthorInvites],
  );

  const sortedItems = useMemo(() => {
    const items = [...contentItems];
    switch (sortBy) {
      case 'createdAt':
        return items.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      case 'title':
        return items.sort((a, b) => a.title.localeCompare(b.title));
      case 'views':
        return items.sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
      case 'lastModified':
      default:
        return items.sort((a, b) => +new Date(b.lastModified) - +new Date(a.lastModified));
    }
  }, [contentItems, sortBy]);

  const handleSubmitForReview = async (itemId: string) => {
    setSubmittingId(itemId);
    try {
      await contentService.transitionState(itemId, 'IN_REVIEW');
      await refreshContent();
    } catch (err) {
      console.error('Failed to submit for review:', err);
    } finally {
      setSubmittingId(null);
    }
  };

  const handleDelete = async (itemId: string, title: string) => {
    const ok = globalThis.window?.confirm(`Delete "${title}"? This cannot be undone.`);
    if (!ok) return;
    try {
      await contentService.delete(itemId);
      await refreshContent();
    } catch (err) {
      console.error('Failed to delete content:', err);
    }
  };

  const handleCreateContent = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const r = await contentService.createDraft('Untitled draft', undefined, {
        contentType: 'ARTICLE',
      });
      await refreshContent();
      navigate(`/editor/${r.content.id}`);
    } catch (err) {
      console.error('Failed to create content:', err);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <PageShell wide className="app-main-canvas">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
          <div className="absolute -left-24 top-16 h-64 w-64 rounded-full bg-app-accent/12 blur-[100px]" />
          <div className="absolute right-0 top-1/3 h-56 w-56 rounded-full bg-app-accent-2/10 blur-[90px]" />
        </div>
        <div className="space-y-8">
          <div className="space-y-3">
            <div className="app-skeleton-shimmer h-3 w-28 rounded-full" />
            <div className="app-skeleton-shimmer h-10 max-w-md rounded-app-lg" />
            <div className="app-skeleton-shimmer h-3 max-w-lg rounded-full" />
          </div>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
            <div className="relative w-full max-w-md shrink-0 overflow-hidden rounded-app-xl border border-white/[0.08] bg-app-bg/35 p-5 shadow-app-lift backdrop-blur-xl supports-backdrop-filter:bg-app-bg/25 lg:max-w-[26rem]">
              <div className="flex flex-col gap-3">
                <div className="app-skeleton-shimmer h-11 w-full rounded-app-md" />
                <div className="app-skeleton-shimmer h-11 w-full rounded-app-md" />
                <div className="app-skeleton-shimmer h-11 w-full rounded-app-md" />
              </div>
            </div>
            <div className="grid w-full max-w-md grid-cols-2 gap-3 self-center lg:w-[20.5rem] lg:max-w-none lg:shrink-0 lg:self-start">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="relative overflow-hidden rounded-app-xl border border-white/[0.08] bg-app-bg/30 p-4 shadow-app-lift backdrop-blur-xl supports-backdrop-filter:bg-app-bg/22"
                >
                  <div className="app-skeleton-shimmer mb-3 h-2 w-20 rounded-full" />
                  <div className="app-skeleton-shimmer h-7 w-16 rounded-app-md" />
                </div>
              ))}
            </div>
          </div>
          <div className="relative min-h-[22rem] overflow-hidden rounded-app-xl border border-white/[0.08] bg-app-bg/30 shadow-app-lift backdrop-blur-xl supports-backdrop-filter:bg-app-bg/22">
            <div className="app-skeleton-shimmer h-11 w-full rounded-none rounded-t-app-xl" />
            <div className="space-y-2 p-3">
              {[1, 2, 3, 4, 5].map((j) => (
                <div key={j} className="app-skeleton-shimmer h-12 rounded-app-md" />
              ))}
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell wide className="app-main-canvas">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute -left-24 top-16 h-64 w-64 rounded-full bg-app-accent/12 blur-[100px]" />
        <div className="absolute right-0 top-1/3 h-56 w-56 rounded-full bg-app-accent-2/10 blur-[90px]" />
        <div className="absolute bottom-0 left-1/2 h-48 w-[min(90%,42rem)] -translate-x-1/2 rounded-full bg-app-accent-deep/18 blur-[110px]" />
      </div>

      <PageHeader
        title="My content"
        accentWord="content"
        description="Manage content you own and items where you are a co-author."
        actions={
          <button
            type="button"
            onClick={() => void handleCreateContent()}
            disabled={creating}
            className={`relative inline-flex h-10 items-center justify-center overflow-hidden rounded-app-lg bg-gradient-to-r from-app-accent to-app-accent-2 px-4 py-2.5 text-[13px] font-semibold text-app-bg shadow-[0_0_28px_-8px_rgba(147,124,248,0.55),inset_0_1px_0_rgba(255,255,255,0.25)] ring-1 ring-white/15 transition-[transform,box-shadow,filter] duration-(--duration-app-slow) ease-(--ease-app-out) before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/20 before:to-transparent before:opacity-60 hover:shadow-[0_0_36px_-4px_rgba(45,212,191,0.35)] hover:brightness-105 active:scale-[0.98] motion-reduce:transition-shadow motion-reduce:hover:brightness-100 ${
              creating ? 'cursor-not-allowed opacity-70' : ''
            }`}
            title="Create a new draft"
          >
            {creating ? 'Creating…' : 'Create content'}
          </button>
        }
      />

      <div className="animate-fade-in space-y-8">
        {pendingCoAuthorInvites.length > 0 ? (
          <Surface
            variant="muted"
            padding="md"
            className="flex flex-col gap-3 border border-amber-400/35 bg-amber-500/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:flex-row sm:items-center sm:justify-between"
            role="status"
          >
            <div className="min-w-0">
              <p className="m-0 text-[13px] font-semibold text-amber-100">
                Co-author requests ({pendingCoAuthorInvites.length})
              </p>
              <p className="mt-1 text-[12px] text-amber-100/80">
                Someone invited you to co-author their content. Review and accept from here.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCoAuthorInvitesOpen(true)}
              className="shrink-0 rounded-app-lg border border-amber-300/40 bg-amber-500/25 px-4 py-2 text-[13px] font-semibold text-amber-50 hover:bg-amber-500/35"
            >
              Review invitations
            </button>
          </Surface>
        ) : null}

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
          <Surface
            variant="glass"
            padding="md"
            className="w-full max-w-md min-w-0 overflow-hidden shadow-app-lift transition-shadow duration-(--duration-app-slow) ease-app-out hover:shadow-app-soft lg:max-w-[26rem]"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 top-0 h-36 w-36 rounded-full bg-app-accent/12 blur-3xl"
            />
            <div className="relative z-1 flex flex-col gap-3">
              <div className="relative w-full">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 z-1 -translate-y-1/2 text-app-accent/70"
                  aria-hidden
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search your content..."
                  className={`${formInputClass} box-border w-full py-2.5 pl-10 pr-3 text-[13px]`}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`${formSelectClass} box-border w-full py-2.5 text-[13px]`}
                aria-label="Filter by status"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="in_review">In Review</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className={`${formSelectClass} box-border w-full py-2.5 text-[13px]`}
                aria-label="Sort by"
              >
                <option value="lastModified">Last Modified</option>
                <option value="createdAt">Date Created</option>
                <option value="views">Most Views</option>
                <option value="title">Title A-Z</option>
              </select>
            </div>
          </Surface>

          <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-3 [grid-auto-rows:1fr] lg:mx-0 lg:w-[20.5rem] lg:max-w-none lg:shrink-0 lg:self-start">
            {stats.map((stat) => (
              <Surface
                key={stat.label}
                variant="glass"
                padding="sm"
                className="group/stat relative flex h-full min-h-[5.25rem] min-w-0 overflow-hidden shadow-app-lift transition-[transform,box-shadow,border-color] duration-(--duration-app-slow) ease-(--ease-app-out) hover:-translate-y-0.5 hover:border-white/14 hover:shadow-app-glow motion-reduce:transform-none"
              >
                <div
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-px opacity-90"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${stat.color}, transparent)`,
                  }}
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover/stat:opacity-40"
                  style={{ background: stat.color }}
                />
                <div className="relative z-1 flex h-full min-h-0 w-full items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-app-faint">
                      {stat.label}
                    </div>
                    <div className="text-[16px] font-bold tracking-tight text-app-text">
                      {stat.value}
                    </div>
                  </div>
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-app-md ring-1 ring-white/10 transition-transform duration-(--duration-app-slow) ease-(--ease-app-out) group-hover/stat:scale-105"
                    style={{ background: `${stat.color}28`, color: stat.color }}
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden
                    >
                      {stat.icon === 'content' ? (
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      ) : null}
                      {stat.icon === 'published' ? (
                        <>
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </>
                      ) : null}
                      {stat.icon === 'review' ? (
                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                      ) : null}
                      {stat.icon === 'views' ? (
                        <>
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </>
                      ) : null}
                    </svg>
                  </div>
                </div>
              </Surface>
            ))}
          </div>
        </div>

        <Surface
          variant="glass"
          padding="none"
          className="overflow-hidden shadow-app-lift transition-shadow duration-(--duration-app-slow) ease-app-out hover:shadow-app-soft"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-app-accent/40 to-transparent"
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-white/[0.08] bg-app-bg/35 backdrop-blur-md">
                  <th className="px-4 py-3.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-app-faint">
                    Title
                  </th>
                  <th className="px-4 py-3.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-app-faint">
                    Type
                  </th>
                  <th className="px-4 py-3.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-app-faint">
                    Status
                  </th>
                  <th className="px-4 py-3.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-app-faint">
                    Views
                  </th>
                  <th className="px-4 py-3.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-app-faint">
                    Last Modified
                  </th>
                  <th className="px-4 py-3.5 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-app-faint">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item) => {
                  const TypeIcon = typeIcons[item.type];
                  return (
                    <tr
                      key={item.id}
                      className="group/row border-b border-white/[0.05] transition-[background-color,box-shadow] duration-(--duration-app) ease-(--ease-app-material) hover:bg-white/[0.04]"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-app-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-white/5 backdrop-blur-sm transition-transform duration-(--duration-app-slow) ease-(--ease-app-out) group-hover/row:scale-[1.03]"
                            style={{
                              background: `${typeColors[item.type]}26`,
                              color: typeColors[item.type],
                            }}
                          >
                            <TypeIcon size={18} />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-semibold text-app-text">
                              {item.title}
                            </div>
                            <div className="text-[11px] leading-snug text-app-muted">
                              {item.workspaceRole === 'author' ? (
                                <>
                                  <span className="font-medium text-app-text/90">You</span> — primary
                                  author
                                  {item.collaborators > 0
                                    ? ` · ${item.collaborators} co-author(s)`
                                    : ''}
                                </>
                              ) : (
                                <>
                                  <span className="font-medium text-app-text/90">You</span> —{' '}
                                  co-author · Primary:{' '}
                                  {item.primaryAuthor?.displayName ?? '—'}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className="inline-flex rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] font-medium capitalize shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm"
                          style={{
                            background: `${typeColors[item.type]}22`,
                            color: typeColors[item.type],
                          }}
                        >
                          {item.type}
                        </span>
                      </td>
                      <td className="p-4">
                        {item.status === 'in_review' && item.workspaceRole === 'author' ? (
                          <button
                            type="button"
                            onClick={() => setReviewModalItem({ id: item.id, title: item.title })}
                            className="cursor-pointer rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-white/10 transition-[transform,opacity] duration-(--duration-app) ease-app-out hover:opacity-95 active:scale-[0.98]"
                            style={{
                              background: `${statusColors[item.status]}28`,
                              color: statusColors[item.status],
                              border: `1px solid ${statusColors[item.status]}55`,
                            }}
                            title="Click to manage reviewers"
                          >
                            {item.status.replace('_', ' ')} ▸
                          </button>
                        ) : item.status === 'in_review' ? (
                          <span
                            className="inline-flex rounded-full border border-white/8 px-2.5 py-0.5 text-[11px] font-semibold uppercase ring-1 ring-white/5"
                            style={{
                              background: `${statusColors[item.status]}22`,
                              color: statusColors[item.status],
                            }}
                          >
                            {item.status.replace('_', ' ')}
                          </span>
                        ) : (
                          <span
                            className="inline-flex rounded-full border border-white/8 px-2.5 py-0.5 text-[11px] font-semibold uppercase ring-1 ring-white/5"
                            style={{
                              background: `${statusColors[item.status]}22`,
                              color: statusColors[item.status],
                            }}
                          >
                            {item.status.replace('_', ' ')}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-[13px] tabular-nums text-app-muted">
                        {item.views.toLocaleString()}
                      </td>
                      <td className="p-4 text-[13px] tabular-nums text-app-faint">
                        {new Date(item.lastModified).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {item.status === 'draft' && item.workspaceRole === 'author' && (
                            <button
                              type="button"
                              onClick={() => handleSubmitForReview(item.id)}
                              disabled={submittingId === item.id}
                              className={`flex items-center gap-1 rounded-app-md border border-amber-400/35 bg-amber-400/18 px-2.5 py-1 text-[11px] font-semibold text-amber-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-[transform,background-color,opacity] duration-(--duration-app) ease-(--ease-app-material) hover:bg-amber-400/26 active:scale-[0.98] ${
                                submittingId === item.id
                                  ? 'cursor-not-allowed opacity-60'
                                  : 'cursor-pointer'
                              }`}
                              title="Submit for Review"
                            >
                              <Send size={12} aria-hidden />
                              {submittingId === item.id ? 'Submitting...' : 'Review'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setCoAuthorsModalItem({
                                id: item.id,
                                title: item.title,
                                canInvite: item.workspaceRole === 'author',
                              })
                            }
                            className="flex cursor-pointer items-center gap-1 rounded-app-md border border-violet-400/35 bg-violet-500/15 px-2.5 py-1 text-[11px] font-semibold text-violet-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-[transform,background-color] duration-(--duration-app) ease-(--ease-app-material) hover:bg-violet-500/22 active:scale-[0.98]"
                            title={
                              item.workspaceRole === 'author'
                                ? 'Manage co-authors'
                                : 'View authors and co-authors'
                            }
                          >
                            <Users size={12} aria-hidden />
                            Co-authors
                          </button>
                          {(item.status === 'in_review' || item.status === 'published') && (
                            <button
                              type="button"
                              onClick={() =>
                                setFeedbackModalItem({ id: item.id, title: item.title })
                              }
                              className="flex cursor-pointer items-center gap-1 rounded-app-md border border-app-accent/40 bg-app-accent-muted px-2.5 py-1 text-[11px] font-semibold text-app-accent shadow-[0_0_20px_-10px_rgba(147,124,248,0.45)] transition-[transform,background-color,box-shadow] duration-(--duration-app) ease-(--ease-app-material) hover:bg-app-accent/20 hover:shadow-[0_0_24px_-8px_rgba(147,124,248,0.5)] active:scale-[0.98]"
                              title="View Review Feedback"
                            >
                              <MessageCircle size={12} aria-hidden />
                              Feedback
                            </button>
                          )}
                          <Link
                            to={`/history/${item.id}`}
                            className="rounded-app-md border border-transparent p-1.5 text-app-muted transition-[color,background-color,border-color,transform] duration-(--duration-app) ease-app-out hover:border-white/10 hover:bg-white/6 hover:text-app-text active:scale-95"
                            title="Version history for this item"
                          >
                            <History size={14} aria-hidden />
                          </Link>
                          <button
                            type="button"
                            onClick={() => navigate(`/editor/${item.id}`)}
                            className="rounded-app-md border border-transparent p-1.5 text-app-muted transition-[color,background-color,border-color,transform] duration-(--duration-app) ease-app-out hover:border-white/10 hover:bg-white/6 hover:text-app-text active:scale-95"
                            title="Edit"
                          >
                            <Edit2 size={14} aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/preview/${item.id}`)}
                            className="rounded-app-md border border-transparent p-1.5 text-app-muted transition-[color,background-color,border-color,transform] duration-(--duration-app) ease-app-out hover:border-white/10 hover:bg-white/6 hover:text-app-text active:scale-95"
                            title="View"
                          >
                            <Eye size={14} aria-hidden />
                          </button>
                          {item.workspaceRole === 'author' ? (
                            <button
                              type="button"
                              onClick={() => void handleDelete(item.id, item.title)}
                              className="rounded-app-md border border-transparent p-1.5 text-red-400/90 transition-[color,background-color,border-color,transform] duration-(--duration-app) ease-app-out hover:border-red-400/25 hover:bg-red-500/12 active:scale-95"
                              title="Delete"
                            >
                              <Trash2 size={14} aria-hidden />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {contentItems.length === 0 && (
            <div className="border-t border-dashed border-white/12 bg-app-bg/25 px-6 py-14 text-center backdrop-blur-sm">
              <p className="text-sm text-app-muted">No content found matching your filters.</p>
            </div>
          )}
        </Surface>

        {reviewModalItem && (
          <ManageReviewersModal
            contentId={reviewModalItem.id}
            contentTitle={reviewModalItem.title}
            onClose={() => setReviewModalItem(null)}
            onAssigned={() => void syncAfterCoAuthorChange()}
          />
        )}

        {feedbackModalItem && (
          <ReviewFeedbackModal
            contentId={feedbackModalItem.id}
            contentTitle={feedbackModalItem.title}
            onClose={() => setFeedbackModalItem(null)}
          />
        )}

        {coAuthorsModalItem && user?.id ? (
          <ManageCoAuthorsModal
            contentId={coAuthorsModalItem.id}
            contentTitle={coAuthorsModalItem.title}
            currentUserId={user.id}
            canInvite={coAuthorsModalItem.canInvite}
            onClose={() => setCoAuthorsModalItem(null)}
            onUpdated={() => void syncAfterCoAuthorChange()}
          />
        ) : null}

        {coAuthorInvitesOpen ? (
          <CoAuthorInvitationsModal
            invitations={pendingCoAuthorInvites}
            loading={pendingCoAuthorLoading}
            busyContentId={inviteRespondBusy}
            onClose={() => setCoAuthorInvitesOpen(false)}
            onRespond={(contentId, decision) => void handleCoAuthorInviteRespond(contentId, decision)}
          />
        ) : null}

        {inviteToastVisible && pendingCoAuthorInvites.length > 0 ? (
          <div
            className="fixed bottom-6 right-6 z-[8500] max-w-sm rounded-app-lg border border-amber-400/40 bg-app-bg/95 px-4 py-3 shadow-app-lift backdrop-blur-xl"
            role="alert"
          >
            <p className="m-0 text-[13px] font-semibold text-app-text">Co-author invitation</p>
            <p className="mt-1 text-[12px] text-app-muted">
              You have {pendingCoAuthorInvites.length} pending request
              {pendingCoAuthorInvites.length === 1 ? '' : 's'}.
            </p>
            <button
              type="button"
              onClick={() => {
                setInviteToastVisible(false);
                setCoAuthorInvitesOpen(true);
              }}
              className="mt-2 text-[12px] font-semibold text-app-accent hover:underline"
            >
              Open requests
            </button>
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}
