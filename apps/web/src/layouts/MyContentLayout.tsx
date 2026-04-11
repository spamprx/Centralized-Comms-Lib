import { useState } from 'react';
import { useMyContent } from '../hooks/useMyContent';
import { FileText, Video, Mic, File, Edit2, Eye, Trash2, Send, MessageCircle } from 'lucide-react';
import { contentService } from '../services/contentService';
import ManageReviewersModal from '../components/ManageReviewersModal';
import ReviewFeedbackModal from '../components/ReviewFeedbackModal';
import { PageHeader, PageShell, Surface, formInputClass, formSelectClass } from '../components/ui';

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
  const { contentItems, stats, loading, searchQuery, setSearchQuery, statusFilter, setStatusFilter, refreshContent } = useMyContent();
  const [sortBy, setSortBy] = useState('lastModified');
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [reviewModalItem, setReviewModalItem] = useState<{ id: string; title: string } | null>(null);
  const [feedbackModalItem, setFeedbackModalItem] = useState<{ id: string; title: string } | null>(null);

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

  if (loading) {
    return (
      <PageShell wide className="animate-pulse">
        <div className="mb-8 h-10 max-w-md rounded-app-lg bg-app-surface" />
        <div className="mb-6 flex flex-wrap gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 min-w-[160px] flex-1 rounded-app-lg bg-app-surface" />
          ))}
        </div>
        <div className="mb-4 h-10 rounded-app-md bg-app-surface" />
        <div className="min-h-[400px] rounded-app-lg bg-app-surface" />
      </PageShell>
    );
  }

  return (
    <PageShell wide>
      <PageHeader
        title="My content"
        description="Manage and track everything you own."
      />

      <div className="animate-fade-in space-y-6">
      {/* Stats Cards */}
      <div className="flex flex-wrap gap-4">
        {stats.map((stat, i) => (
          <Surface
            key={i}
            padding="sm"
            className="min-w-[160px] flex-1 transition-transform duration-200 hover:-translate-y-0.5"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-app-faint">{stat.label}</span>
              <div
                className="flex h-8 w-8 items-center justify-center rounded-app-md"
                style={{ background: `${stat.color}22`, color: stat.color }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {stat.icon === 'content' && <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></>}
                  {stat.icon === 'published' && <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>}
                  {stat.icon === 'review' && <><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" /></>}
                  {stat.icon === 'views' && <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>}
                </svg>
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-app-text">{stat.value}</div>
          </Surface>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[250px] flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your content..."
            className={`${formInputClass} py-2.5 text-[13px]`}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={`${formSelectClass} w-auto min-w-[10rem] py-2.5 text-[13px]`}
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
          className={`${formSelectClass} w-auto min-w-[11rem] py-2.5 text-[13px]`}
          aria-label="Sort by"
        >
          <option value="lastModified">Last Modified</option>
          <option value="createdAt">Date Created</option>
          <option value="views">Most Views</option>
          <option value="title">Title A-Z</option>
        </select>
      </div>

      {/* Content Table */}
      <Surface padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-app-border bg-app-bg/40">
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-app-faint">Title</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-app-faint">Type</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-app-faint">Status</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-app-faint">Views</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-app-faint">Last Modified</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-app-faint">Actions</th>
            </tr>
          </thead>
          <tbody>
            {contentItems.map((item) => {
              const TypeIcon = typeIcons[item.type];
              return (
                <tr key={item.id} className="border-b border-app-border/60 transition-colors hover:bg-app-surface/40">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-app-md"
                        style={{ background: `${typeColors[item.type]}22`, color: typeColors[item.type] }}
                      >
                        <TypeIcon size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-app-text">{item.title}</div>
                        <div className="text-[11px] text-app-faint">{item.collaborators} collaborators</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] capitalize"
                      style={{ background: `${typeColors[item.type]}22`, color: typeColors[item.type] }}
                    >{item.type}</span>
                  </td>
                  <td className="p-4">
                    {item.status === 'in_review' ? (
                      <button
                        type="button"
                        onClick={() => setReviewModalItem({ id: item.id, title: item.title })}
                        className="cursor-pointer rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase transition-opacity hover:opacity-90"
                        style={{
                          background: `${statusColors[item.status]}22`,
                          color: statusColors[item.status],
                          border: `1px solid ${statusColors[item.status]}44`,
                        }}
                        title="Click to manage reviewers"
                      >
                        {item.status.replace('_', ' ')} ▸
                      </button>
                    ) : (
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase"
                        style={{ background: `${statusColors[item.status]}22`, color: statusColors[item.status] }}
                      >{item.status.replace('_', ' ')}</span>
                    )}
                  </td>
                  <td className="p-4 text-[13px] text-app-muted">{item.views.toLocaleString()}</td>
                  <td className="p-4 text-[13px] text-app-faint">{new Date(item.lastModified).toLocaleDateString()}</td>
                  <td className="p-4 text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      {item.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => handleSubmitForReview(item.id)}
                          disabled={submittingId === item.id}
                          className={`flex items-center gap-1 rounded-app-md border border-amber-400/30 bg-amber-400/15 px-2.5 py-1 text-[11px] font-semibold text-amber-400 transition-all duration-200 ${
                            submittingId === item.id ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-amber-400/20'
                          }`}
                          title="Submit for Review"
                        >
                          <Send size={12} />
                          {submittingId === item.id ? 'Submitting...' : 'Review'}
                        </button>
                      )}
                      {(item.status === 'in_review' || item.status === 'published') && (
                        <button
                          type="button"
                          onClick={() => setFeedbackModalItem({ id: item.id, title: item.title })}
                          className="flex cursor-pointer items-center gap-1 rounded-app-md border border-app-accent/35 bg-app-accent-muted px-2.5 py-1 text-[11px] font-semibold text-app-accent transition-colors hover:bg-app-accent/25"
                          title="View Review Feedback"
                        >
                          <MessageCircle size={12} />
                          Feedback
                        </button>
                      )}
                      <button type="button" className="rounded-app-md p-1.5 text-app-faint transition-colors hover:bg-app-surface-hover hover:text-app-text" title="Edit">
                        <Edit2 size={14} />
                      </button>
                      <button type="button" className="rounded-app-md p-1.5 text-app-faint transition-colors hover:bg-app-surface-hover hover:text-app-text" title="View">
                        <Eye size={14} />
                      </button>
                      <button type="button" className="rounded-app-md p-1.5 text-red-400 transition-colors hover:bg-red-500/10" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {contentItems.length === 0 && (
          <div className="p-12 text-center text-sm text-app-faint">
            No content found matching your filters.
          </div>
        )}
      </Surface>

      {/* Manage Reviewers Modal */}
      {reviewModalItem && (
        <ManageReviewersModal
          contentId={reviewModalItem.id}
          contentTitle={reviewModalItem.title}
          onClose={() => setReviewModalItem(null)}
          onAssigned={() => refreshContent()}
        />
      )}

      {/* Review Feedback Modal */}
      {feedbackModalItem && (
        <ReviewFeedbackModal
          contentId={feedbackModalItem.id}
          contentTitle={feedbackModalItem.title}
          onClose={() => setFeedbackModalItem(null)}
        />
      )}
      </div>
    </PageShell>
  );
}
