import { useState } from 'react';
import { CheckCircle, XCircle, MessageSquare, Edit3, History, AlertCircle } from 'lucide-react';

const mockReviewItem = {
  id: '1',
  title: 'Q1 Marketing Strategy Document',
  author: 'Alice Johnson',
  submittedAt: 'March 8, 2025',
  type: 'Document',
  content: `Executive Summary

This document outlines our marketing strategy for Q1 2025.

Key Objectives:
1. Increase digital presence by 40%
2. Launch new customer loyalty program
3. Expand into two new markets

Budget Allocation:
- Digital Marketing: 45%
- Content Creation: 25%
- Events & Sponsorships: 20%
- Research & Analytics: 10%`,
};

const mockComments = [
  { id: '1', author: 'Bob Smith', text: 'Great overall strategy! I think we should increase the digital marketing budget to 50%.', time: '2 hours ago', resolved: false },
  { id: '2', author: 'Carol Williams', text: 'The timeline looks aggressive. Can we add a buffer week?', time: '4 hours ago', resolved: true },
  { id: '3', author: 'David Brown', text: 'Should we consider TikTok for the digital campaign?', time: '1 day ago', resolved: false },
];

const versionsData = [
  { id: '1', version: 'v1.0', date: 'March 8, 2025', author: 'Alice Johnson', changes: 'Initial submission' },
  { id: '2', version: 'v1.1', date: 'March 9, 2025', author: 'Alice Johnson', changes: 'Updated budget section' },
];

const screeningData = {
  score: 85,
  issues: [
    { type: 'warning', text: 'Consider adding more specific metrics for success measurement' },
    { type: 'info', text: 'Document structure follows best practices' },
    { type: 'success', text: 'No grammar or spelling errors detected' },
  ],
};

export default function ReviewLayout() {
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState(mockComments);
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null);

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    setComments([...comments, {
      id: String(Date.now()),
      author: 'You',
      text: commentText,
      time: 'Just now',
      resolved: false,
    }]);
    setCommentText('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0b0d14' }}>
      {/* Topbar */}
      <div style={{
        padding: '12px 24px',
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: '#e2e4f0', margin: '0 0 2px' }}>{mockReviewItem.title}</h1>
          <p style={{ fontSize: 12, color: '#555870', margin: 0 }}>
            Submitted by {mockReviewItem.author} • {mockReviewItem.submittedAt}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{
            padding: '8px 14px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6,
            color: '#8b8fa8',
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <Edit3 size={14} /> Request Changes
          </button>
          <button style={{
            padding: '8px 14px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6,
            color: '#8b8fa8',
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <History size={14} /> View History
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Content View Panel */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          <div style={{
            maxWidth: 800,
            background: '#1a1d2e',
            borderRadius: 12,
            padding: 32,
          }}>
            <pre style={{
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              fontSize: 14,
              color: '#c4c7d9',
              lineHeight: 1.8,
              margin: 0,
              fontFamily: 'inherit',
            }}>{mockReviewItem.content}</pre>
          </div>
        </div>

        {/* Right Sidebar */}
        <div style={{
          width: 400,
          background: 'rgba(255,255,255,0.02)',
          borderLeft: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}>
          {/* Approval Buttons */}
          <div style={{ padding: 20, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ fontSize: 12, fontWeight: 600, color: '#555870', textTransform: 'uppercase', marginBottom: 12 }}>
              Review Decision
            </h3>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setDecision('approved')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px 20px',
                  background: decision === 'approved' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)',
                  border: decision === 'approved' ? '2px solid #10b981' : '2px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: 8,
                  color: decision === 'approved' ? '#10b981' : '#059669',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <CheckCircle size={18} /> Approve
              </button>
              <button
                onClick={() => setDecision('rejected')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px 20px',
                  background: decision === 'rejected' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                  border: decision === 'rejected' ? '2px solid #f87171' : '2px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 8,
                  color: decision === 'rejected' ? '#f87171' : '#dc2626',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <XCircle size={18} /> Reject
              </button>
            </div>
            {decision && (
              <p style={{ fontSize: 11, color: decision === 'approved' ? '#10b981' : '#f87171', marginTop: 8, textAlign: 'center' }}>
                ✓ Decision recorded - {decision === 'approved' ? 'Content will be published' : 'Changes will be requested'}
              </p>
            )}
          </div>

          {/* AI Screening Panel */}
          <div style={{ padding: 20, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ fontSize: 12, fontWeight: 600, color: '#555870', textTransform: 'uppercase', marginBottom: 12 }}>
              AI Screening
            </h3>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#8b8fa8' }}>Quality Score</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: screeningData.score > 80 ? '#10b981' : '#fbbf24' }}>{screeningData.score}/100</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  width: `${screeningData.score}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, ${screeningData.score > 80 ? '#10b981' : '#fbbf24'}, ${screeningData.score > 80 ? '#34d399' : '#f59e0b'})`,
                  borderRadius: 3,
                }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {screeningData.issues.map((issue, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  {issue.type === 'warning' && <AlertCircle size={14} color="#fbbf24" style={{ marginTop: 2 }} />}
                  {issue.type === 'info' && <AlertCircle size={14} color="#06b6d4" style={{ marginTop: 2 }} />}
                  {issue.type === 'success' && <CheckCircle size={14} color="#10b981" style={{ marginTop: 2 }} />}
                  <span style={{ fontSize: 11, color: '#8b8fa8' }}>{issue.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Version Comparison */}
          <div style={{ padding: 20, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ fontSize: 12, fontWeight: 600, color: '#555870', textTransform: 'uppercase', marginBottom: 12 }}>
              Versions
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {versionsData.map((v) => (
                <div key={v.id} style={{
                  padding: 10,
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 6,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#a78bfa' }}>{v.version}</span>
                    <span style={{ fontSize: 10, color: '#555870' }}>{v.date}</span>
                  </div>
                  <p style={{ fontSize: 11, color: '#8b8fa8', margin: '0 0 2px' }}>{v.changes}</p>
                  <p style={{ fontSize: 10, color: '#555870', margin: 0 }}>by {v.author}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Comments Thread */}
          <div style={{ padding: 20, flex: 1 }}>
            <h3 style={{ fontSize: 12, fontWeight: 600, color: '#555870', textTransform: 'uppercase', marginBottom: 12 }}>
              Comments ({comments.filter(c => !c.resolved).length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              {comments.map((comment) => (
                <div key={comment.id} style={{
                  padding: 12,
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 8,
                  opacity: comment.resolved ? 0.5 : 1,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e4f0' }}>{comment.author}</span>
                    <span style={{ fontSize: 10, color: '#555870' }}>{comment.time}</span>
                  </div>
                  <p style={{ fontSize: 12, color: '#c4c7d9', margin: '0 0 6px' }}>{comment.text}</p>
                  {comment.resolved && (
                    <span style={{ fontSize: 10, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle size={10} /> Resolved
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Add Comment Box */}
            <div>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                rows={3}
                style={{
                  width: '100%',
                  padding: 12,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  color: '#e2e4f0',
                  fontSize: 12,
                  resize: 'none',
                  marginBottom: 8,
                  boxSizing: 'border-box',
                }}
              />
              <button
                onClick={handleAddComment}
                disabled={!commentText.trim()}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  background: commentText.trim() ? 'linear-gradient(135deg, #8b5cf6, #06b6d4)' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: 6,
                  color: commentText.trim() ? '#fff' : '#555870',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: commentText.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <MessageSquare size={14} /> Post Comment
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
