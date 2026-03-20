import { useState } from 'react';
import { useMyContent } from '../hooks/useMyContent';
import { FileText, Video, Mic, File, Edit2, Eye, Trash2, Send } from 'lucide-react';
import { contentService } from '../services/contentService';

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
      <div style={{ padding: 24 }}>
        <div style={{ height: 48, background: 'rgba(255,255,255,0.03)', borderRadius: 10, marginBottom: 24 }} />
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ height: 80, flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: 10, animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
        <div style={{ height: 40, background: 'rgba(255,255,255,0.03)', borderRadius: 8, marginBottom: 16 }} />
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, minHeight: 400 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e2e4f0', margin: '0 0 4px' }}>My Content</h1>
        <p style={{ fontSize: 13, color: '#555870', margin: 0 }}>Manage and track all your content</p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        {stats.map((stat, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              minWidth: 160,
              padding: 16,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: '#555870', textTransform: 'uppercase', fontWeight: 600 }}>{stat.label}</span>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: `${stat.color}22`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: stat.color,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {stat.icon === 'content' && <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></>}
                  {stat.icon === 'published' && <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>}
                  {stat.icon === 'review' && <><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" /></>}
                  {stat.icon === 'views' && <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>}
                </svg>
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#e2e4f0' }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 250, position: 'relative' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your content..."
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              color: '#e2e4f0',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '10px 12px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            color: '#e2e4f0',
            fontSize: 13,
            cursor: 'pointer',
          }}
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
          style={{
            padding: '10px 12px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            color: '#e2e4f0',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <option value="lastModified">Last Modified</option>
          <option value="createdAt">Date Created</option>
          <option value="views">Most Views</option>
          <option value="title">Title A-Z</option>
        </select>
      </div>

      {/* Content Table */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 10,
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#555870', textTransform: 'uppercase' }}>Title</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#555870', textTransform: 'uppercase' }}>Type</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#555870', textTransform: 'uppercase' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#555870', textTransform: 'uppercase' }}>Views</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#555870', textTransform: 'uppercase' }}>Last Modified</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#555870', textTransform: 'uppercase' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {contentItems.map((item) => {
              const TypeIcon = typeIcons[item.type];
              return (
                <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: 6,
                        background: `${typeColors[item.type]}22`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: typeColors[item.type],
                      }}>
                        <TypeIcon size={18} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#e2e4f0' }}>{item.title}</div>
                        <div style={{ fontSize: 11, color: '#555870' }}>{item.collaborators} collaborators</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{
                      fontSize: 11,
                      padding: '3px 8px',
                      background: `${typeColors[item.type]}22`,
                      borderRadius: 12,
                      color: typeColors[item.type],
                      textTransform: 'capitalize',
                    }}>{item.type}</span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{
                      fontSize: 11,
                      padding: '3px 8px',
                      background: `${statusColors[item.status]}22`,
                      borderRadius: 12,
                      color: statusColors[item.status],
                      textTransform: 'uppercase',
                      fontWeight: 600,
                    }}>{item.status.replace('_', ' ')}</span>
                  </td>
                  <td style={{ padding: '16px', fontSize: 13, color: '#8b8fa8' }}>{item.views.toLocaleString()}</td>
                  <td style={{ padding: '16px', fontSize: 13, color: '#555870' }}>{new Date(item.lastModified).toLocaleDateString()}</td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                      {item.status === 'draft' && (
                        <button
                          onClick={() => handleSubmitForReview(item.id)}
                          disabled={submittingId === item.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 10px',
                            background: submittingId === item.id
                              ? 'rgba(251, 191, 36, 0.1)'
                              : 'rgba(251, 191, 36, 0.15)',
                            border: '1px solid rgba(251, 191, 36, 0.3)',
                            borderRadius: 6,
                            color: '#fbbf24',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: submittingId === item.id ? 'not-allowed' : 'pointer',
                            opacity: submittingId === item.id ? 0.6 : 1,
                            transition: 'all 0.2s ease',
                          }}
                          title="Submit for Review"
                        >
                          <Send size={12} />
                          {submittingId === item.id ? 'Submitting...' : 'Review'}
                        </button>
                      )}
                      <button style={{
                        padding: 6,
                        background: 'none',
                        border: 'none',
                        color: '#555870',
                        cursor: 'pointer',
                        borderRadius: 4,
                      }} title="Edit">
                        <Edit2 size={14} />
                      </button>
                      <button style={{
                        padding: 6,
                        background: 'none',
                        border: 'none',
                        color: '#555870',
                        cursor: 'pointer',
                        borderRadius: 4,
                      }} title="View">
                        <Eye size={14} />
                      </button>
                      <button style={{
                        padding: 6,
                        background: 'none',
                        border: 'none',
                        color: '#f87171',
                        cursor: 'pointer',
                        borderRadius: 4,
                      }} title="Delete">
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
          <div style={{ padding: 48, textAlign: 'center', color: '#555870', fontSize: 14 }}>
            No content found matching your filters.
          </div>
        )}
      </div>
    </div>
  );
}
