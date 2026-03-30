import { useState, useEffect } from 'react';
import { X, Users, CheckCircle, Clock, Loader2, MessageCircle } from 'lucide-react';
import { reviewService, type ReviewRequest } from '../services/reviewService';
import { adminUserService } from '../services/adminService';

type ReviewFeedbackInfo = {
  requestId: string;
  status: string;
  createdAt: string;
  assignments: Array<{
    id: string;
    reviewerName: string;
    reviewerEmail: string;
    status: string;
    assignedAt: string;
    completedAt: string | null;
    decision?: {
      verdict: string;
      comment: string;
    } | null;
    standaloneComments?: Array<{ text: string; time: string }>;
  }>;
};

interface ReviewFeedbackModalProps {
  contentId: string;
  contentTitle: string;
  onClose: () => void;
}

export default function ReviewFeedbackModal({
  contentId,
  contentTitle,
  onClose,
}: ReviewFeedbackModalProps) {
  const [feedbackList, setFeedbackList] = useState<ReviewFeedbackInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        // Get all users to resolve reviewer names
        let userMap: Record<string, { displayName: string; email: string }> = {};
        try {
          const usersRes = await adminUserService.getUsers();
          const rawUsers = usersRes.data as unknown as Array<{ id: string; displayName?: string; email: string }>;
          for (const u of rawUsers) {
            userMap[u.id] = { displayName: u.displayName || u.email, email: u.email };
          }
        } catch {
          // Non-critical
        }

        // Get review requests for this content
        const requests: ReviewRequest[] = await reviewService.listForContent(contentId);

        // For each request, get full details including assignments
        const feedbacks: ReviewFeedbackInfo[] = [];
        for (const req of requests) {
          try {
            const fullRequest = await reviewService.getRequestById(req.id);
            const assignments = await Promise.all((fullRequest.assignments || []).map(async (a) => {
              const reviewer = userMap[a.reviewerId];
              
              // 1. Check for standalone independent comments
              let standaloneComments = [];
              try {
                const rawComments = localStorage.getItem(`review_comments_${a.id}`);
                if (rawComments) {
                  standaloneComments = JSON.parse(rawComments);
                }
              } catch (err) {
                // Ignore parse errors
              }

              // 2. Check for final decision
              let decisionData = null;
              if (a.status === 'COMPLETED') {
                try {
                  // Fallback to local storage (Frontend-only persistence)
                  // The ReviewLayout saves decisions to localStorage under "review_decision_{assignmentId}"
                  const localDecisionRaw = localStorage.getItem(`review_decision_${a.id}`);
                  if (localDecisionRaw) {
                    const localDecision = JSON.parse(localDecisionRaw);
                    decisionData = {
                      verdict: localDecision.verdict,
                      comment: localDecision.comment || '',
                    };
                  }
                } catch (err) {
                  console.error('Failed fetching decision for', a.id, err);
                }
              }
              
              return {
                id: a.id,
                reviewerName: reviewer?.displayName || 'Unknown Reviewer',
                reviewerEmail: reviewer?.email || '',
                status: a.status,
                assignedAt: a.assignedAt,
                completedAt: a.completedAt,
                decision: decisionData,
                standaloneComments,
              };
            }));

            feedbacks.push({
              requestId: req.id,
              status: req.status,
              createdAt: typeof req.createdAt === 'string' ? req.createdAt : new Date(req.createdAt).toISOString(),
              assignments,
            });
          } catch {
            // Skip failed requests
          }
        }

        setFeedbackList(feedbacks);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load review feedback');
      } finally {
        setLoading(false);
      }
    })();
  }, [contentId]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 520,
          maxHeight: '80vh',
          background: '#1a1d2e',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <MessageCircle size={18} color="#a78bfa" />
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#e2e4f0', margin: 0 }}>
                Review Feedback
              </h2>
            </div>
            <p style={{
              fontSize: 12,
              color: '#555870',
              margin: 0,
              maxWidth: 380,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {contentTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: 'none',
              borderRadius: 8,
              padding: 8,
              color: '#8b8fa8',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <Loader2 size={24} color="#a78bfa" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : error ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#f87171', fontSize: 13 }}>
              {error}
            </div>
          ) : feedbackList.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#555870', fontSize: 13 }}>
              No review requests found for this content.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {feedbackList.map((feedback) => (
                <div
                  key={feedback.requestId}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.06)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Request Header */}
                  <div style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Users size={14} color="#8b8fa8" />
                      <span style={{ fontSize: 12, color: '#8b8fa8' }}>
                        Review Request
                      </span>
                    </div>
                    <span style={{
                      fontSize: 10,
                      padding: '2px 8px',
                      borderRadius: 8,
                      background: feedback.status === 'CLOSED'
                        ? 'rgba(16,185,129,0.15)'
                        : 'rgba(251,191,36,0.15)',
                      color: feedback.status === 'CLOSED' ? '#10b981' : '#fbbf24',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}>
                      {feedback.status}
                    </span>
                  </div>

                  {/* Assignments */}
                  <div style={{ padding: '8px 16px 16px' }}>
                    {feedback.assignments.length === 0 ? (
                      <div style={{ padding: 12, textAlign: 'center', color: '#555870', fontSize: 12 }}>
                        No reviewers assigned yet
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {feedback.assignments.map((assignment) => {
                          const isCompleted = assignment.status === 'COMPLETED';
                          return (
                            <div key={assignment.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 12,
                                  padding: '12px 14px',
                                  background: isCompleted
                                    ? 'rgba(16,185,129,0.06)'
                                    : 'rgba(255,255,255,0.02)',
                                  borderRadius: 8,
                                  border: isCompleted
                                    ? '1px solid rgba(16,185,129,0.15)'
                                    : '1px solid rgba(255,255,255,0.04)',
                                }}
                              >
                                {/* Status icon */}
                                {isCompleted ? (
                                  <CheckCircle size={18} color="#10b981" />
                                ) : (
                                  <Clock size={18} color="#fbbf24" />
                                )}

                                {/* Reviewer avatar */}
                                <div
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '50%',
                                    background: isCompleted
                                      ? 'linear-gradient(135deg, #10b981, #06b6d4)'
                                      : 'linear-gradient(135deg, #374151, #4b5563)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#fff',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    flexShrink: 0,
                                  }}
                                >
                                  {assignment.reviewerName[0].toUpperCase()}
                                </div>

                                {/* Reviewer info */}
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 500, color: '#e2e4f0' }}>
                                    {assignment.reviewerName}
                                  </div>
                                  <div style={{ fontSize: 11, color: '#555870' }}>
                                    {assignment.reviewerEmail}
                                  </div>
                                </div>

                                {/* Status label */}
                                <span style={{
                                  fontSize: 10,
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                  background: isCompleted
                                    ? 'rgba(16,185,129,0.15)'
                                    : 'rgba(251,191,36,0.15)',
                                  color: isCompleted ? '#10b981' : '#fbbf24',
                                  fontWeight: 600,
                                }}>
                                  {isCompleted
                                    ? `Reviewed ${assignment.completedAt ? new Date(assignment.completedAt).toLocaleDateString() : ''}`
                                    : 'Pending'}
                                </span>
                              </div>
                              
                              {/* Decision Feedback Details */}
                              {isCompleted && assignment.decision && (
                                <div style={{
                                  marginLeft: 44, // Align with text
                                  padding: '12px 14px',
                                  background: 'rgba(255,255,255,0.03)',
                                  borderRadius: 8,
                                  borderLeft: `3px solid ${assignment.decision.verdict === 'APPROVED' ? '#10b981' : '#f87171'}`,
                                  marginBottom: 8,
                                }}>
                                  <div style={{ 
                                    fontSize: 11, 
                                    fontWeight: 600, 
                                    color: assignment.decision.verdict === 'APPROVED' ? '#10b981' : '#f87171',
                                    marginBottom: 4,
                                    textTransform: 'uppercase'
                                  }}>
                                    {assignment.decision.verdict}
                                  </div>
                                  <div style={{ fontSize: 13, color: '#c4c7d9', lineHeight: 1.5 }}>
                                    {assignment.decision.comment}
                                  </div>
                                </div>
                              )}

                              {/* Standalone Comments */}
                              {assignment.standaloneComments && assignment.standaloneComments.length > 0 && (
                                <div style={{ marginLeft: 44, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {assignment.standaloneComments.map((comment, idx) => (
                                    <div key={idx} style={{
                                      padding: '10px 12px',
                                      background: 'rgba(255,255,255,0.02)',
                                      borderRadius: 8,
                                      border: '1px solid rgba(255,255,255,0.05)',
                                    }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: '#e2e4f0' }}>Reviewer Comment</span>
                                        <span style={{ fontSize: 10, color: '#555870' }}>
                                          {new Date(comment.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      </div>
                                      <div style={{ fontSize: 12, color: '#c4c7d9', lineHeight: 1.5 }}>
                                        {comment.text}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid rgba(255,255,255,0.07)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              color: '#8b8fa8',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
