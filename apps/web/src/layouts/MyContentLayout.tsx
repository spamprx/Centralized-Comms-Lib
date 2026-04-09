import { useState } from 'react';
import { useMyContent } from '../hooks/useMyContent';
import { FileText, Video, Mic, File, Edit2, Eye, Trash2, Send, MessageCircle } from 'lucide-react';
import { contentService } from '../services/contentService';
import ManageReviewersModal from '../components/ManageReviewersModal';
import ReviewFeedbackModal from '../components/ReviewFeedbackModal';

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
      <div className="p-6">
        <div className="h-12 bg-white/[0.03] rounded-[10px] mb-6" />
        <div className="flex gap-4 mb-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 flex-1 bg-white/[0.03] rounded-[10px] animate-pulse" />
          ))}
        </div>
        <div className="h-10 bg-white/[0.03] rounded-lg mb-4" />
        <div className="bg-white/[0.03] rounded-[10px] min-h-[400px]" />
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#e2e4f0] mb-1">My Content</h1>
        <p className="text-[13px] text-[#555870] m-0">Manage and track all your content</p>
      </div>

      {/* Stats Cards */}
      <div className="flex gap-4 mb-6 flex-wrap">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="flex-1 min-w-[160px] p-4 bg-white/[0.03] border border-white/[0.07] rounded-[10px]"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-[11px] text-[#555870] uppercase font-semibold">{stat.label}</span>
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center"
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
            <div className="text-2xl font-bold text-[#e2e4f0]">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="flex-1 min-w-[250px] relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your content..."
            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#e2e4f0] text-[13px] outline-none box-border"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#e2e4f0] text-[13px] cursor-pointer"
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
          className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#e2e4f0] text-[13px] cursor-pointer"
        >
          <option value="lastModified">Last Modified</option>
          <option value="createdAt">Date Created</option>
          <option value="views">Most Views</option>
          <option value="title">Title A-Z</option>
        </select>
      </div>

      {/* Content Table */}
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-[10px] overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#555870] uppercase">Title</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#555870] uppercase">Type</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#555870] uppercase">Status</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#555870] uppercase">Views</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#555870] uppercase">Last Modified</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold text-[#555870] uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {contentItems.map((item) => {
              const TypeIcon = typeIcons[item.type];
              return (
                <tr key={item.id} className="border-b border-white/[0.04]">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-md flex items-center justify-center"
                        style={{ background: `${typeColors[item.type]}22`, color: typeColors[item.type] }}
                      >
                        <TypeIcon size={18} />
                      </div>
                      <div>
                        <div className="text-[13px] font-medium text-[#e2e4f0]">{item.title}</div>
                        <div className="text-[11px] text-[#555870]">{item.collaborators} collaborators</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-xl capitalize"
                      style={{ background: `${typeColors[item.type]}22`, color: typeColors[item.type] }}
                    >{item.type}</span>
                  </td>
                  <td className="p-4">
                    {item.status === 'in_review' ? (
                      <button
                        onClick={() => setReviewModalItem({ id: item.id, title: item.title })}
                        className="text-[11px] px-2 py-0.5 rounded-xl uppercase font-semibold cursor-pointer transition-all duration-150"
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
                        className="text-[11px] px-2 py-0.5 rounded-xl uppercase font-semibold"
                        style={{ background: `${statusColors[item.status]}22`, color: statusColors[item.status] }}
                      >{item.status.replace('_', ' ')}</span>
                    )}
                  </td>
                  <td className="p-4 text-[13px] text-[#8b8fa8]">{item.views.toLocaleString()}</td>
                  <td className="p-4 text-[13px] text-[#555870]">{new Date(item.lastModified).toLocaleDateString()}</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-1">
                      {item.status === 'draft' && (
                        <button
                          onClick={() => handleSubmitForReview(item.id)}
                          disabled={submittingId === item.id}
                          className={`flex items-center gap-1 px-2.5 py-1 bg-amber-400/15 border border-amber-400/30 rounded-md text-amber-400 text-[11px] font-semibold transition-all duration-200 ${
                            submittingId === item.id ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                          }`}
                          title="Submit for Review"
                        >
                          <Send size={12} />
                          {submittingId === item.id ? 'Submitting...' : 'Review'}
                        </button>
                      )}
                      {(item.status === 'in_review' || item.status === 'published') && (
                        <button
                          onClick={() => setFeedbackModalItem({ id: item.id, title: item.title })}
                          className="flex items-center gap-1 px-2.5 py-1 bg-violet-400/10 border border-violet-400/30 rounded-md text-violet-400 text-[11px] font-semibold cursor-pointer transition-all duration-200"
                          title="View Review Feedback"
                        >
                          <MessageCircle size={12} />
                          Feedback
                        </button>
                      )}
                      <button className="p-1.5 bg-transparent border-none text-[#555870] cursor-pointer rounded" title="Edit">
                        <Edit2 size={14} />
                      </button>
                      <button className="p-1.5 bg-transparent border-none text-[#555870] cursor-pointer rounded" title="View">
                        <Eye size={14} />
                      </button>
                      <button className="p-1.5 bg-transparent border-none text-red-400 cursor-pointer rounded" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {contentItems.length === 0 && (
          <div className="p-12 text-center text-[#555870] text-sm">
            No content found matching your filters.
          </div>
        )}
      </div>

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
  );
}
