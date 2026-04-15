import { useState, useEffect } from 'react';
import { X, Users, CheckCircle, Clock, Loader2, MessageCircle } from 'lucide-react';
import { reviewService, type ReviewRequest } from '../services/reviewService';
import { adminUserService } from '../services/adminService';
import { useReviewStore } from '../store/reviewStore';

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
  const { getDecision: ctxGetDecision, getComments: ctxGetComments } = useReviewStore();
  const [feedbackList, setFeedbackList] = useState<ReviewFeedbackInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        let userMap: Record<string, { displayName: string; email: string }> = {};
        try {
          const usersRes = await adminUserService.getUsers();
          const rawUsers = usersRes.data as unknown as Array<{
            id: string;
            displayName?: string;
            email: string;
          }>;
          for (const u of rawUsers) {
            userMap[u.id] = { displayName: u.displayName || u.email, email: u.email };
          }
        } catch {
          // Non-critical
        }

        const requests: ReviewRequest[] = await reviewService.listForContent(contentId);

        const feedbacks: ReviewFeedbackInfo[] = [];
        for (const req of requests) {
          try {
            const fullRequest = await reviewService.getRequestById(req.id);
            const assignments = await Promise.all(
              (fullRequest.assignments || []).map(async (a) => {
                const reviewer = userMap[a.reviewerId];

                const standaloneComments = ctxGetComments(a.id);

                let decisionData = null;
                if (a.status === 'COMPLETED') {
                  const ctxDecision = ctxGetDecision(a.id);
                  if (ctxDecision) {
                    decisionData = {
                      verdict: ctxDecision.verdict,
                      comment: ctxDecision.comment || '',
                    };
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
              }),
            );

            feedbacks.push({
              requestId: req.id,
              status: req.status,
              createdAt:
                typeof req.createdAt === 'string'
                  ? req.createdAt
                  : new Date(req.createdAt).toISOString(),
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
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[520px] max-h-[80vh] bg-[#1a1d2e] border border-app-border rounded-2xl flex flex-col overflow-hidden shadow-[0_24px_48px_rgba(0,0,0,0.4)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-app-border flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <MessageCircle size={18} color="#a78bfa" />
              <h2 className="text-base font-bold text-app-text m-0">Review Feedback</h2>
            </div>
            <p className="text-xs text-app-faint m-0 max-w-[380px] overflow-hidden text-ellipsis whitespace-nowrap">
              {contentTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="bg-app-surface border-none rounded-lg p-2 text-app-muted cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 size={24} color="#a78bfa" className="animate-spin" />
            </div>
          ) : error ? (
            <div className="p-6 text-center text-red-400 text-[13px]">{error}</div>
          ) : feedbackList.length === 0 ? (
            <div className="p-8 text-center text-app-faint text-[13px]">
              No review requests found for this content.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {feedbackList.map((feedback) => (
                <div
                  key={feedback.requestId}
                  className="bg-app-surface rounded-xl border border-app-border overflow-hidden"
                >
                  {/* Request Header */}
                  <div className="px-4 py-3 border-b border-app-border/80 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Users size={14} color="#8b8fa8" />
                      <span className="text-xs text-app-muted">Review Request</span>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-lg font-semibold uppercase ${
                        feedback.status === 'CLOSED'
                          ? 'bg-emerald-500/15 text-emerald-500'
                          : 'bg-amber-400/15 text-amber-400'
                      }`}
                    >
                      {feedback.status}
                    </span>
                  </div>

                  {/* Assignments */}
                  <div className="px-4 py-2 pb-4">
                    {feedback.assignments.length === 0 ? (
                      <div className="p-3 text-center text-app-faint text-xs">
                        No reviewers assigned yet
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {feedback.assignments.map((assignment) => {
                          const isCompleted = assignment.status === 'COMPLETED';
                          return (
                            <div key={assignment.id} className="flex flex-col gap-2">
                              <div
                                className={`flex items-center gap-3 px-3.5 py-3 rounded-lg ${
                                  isCompleted
                                    ? 'bg-emerald-500/[0.06] border border-emerald-500/15'
                                    : 'bg-app-bg/60 border border-app-border'
                                }`}
                              >
                                {/* Status icon */}
                                {isCompleted ? (
                                  <CheckCircle size={18} color="#10b981" />
                                ) : (
                                  <Clock size={18} color="#fbbf24" />
                                )}

                                {/* Reviewer avatar */}
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[13px] font-semibold shrink-0 ${
                                    isCompleted
                                      ? 'bg-gradient-to-br from-emerald-500 to-cyan-500'
                                      : 'bg-gradient-to-br from-app-bg-subtle to-app-surface'
                                  }`}
                                >
                                  {assignment.reviewerName[0].toUpperCase()}
                                </div>

                                {/* Reviewer info */}
                                <div className="flex-1">
                                  <div className="text-[13px] font-medium text-app-text">
                                    {assignment.reviewerName}
                                  </div>
                                  <div className="text-[11px] text-app-faint">
                                    {assignment.reviewerEmail}
                                  </div>
                                </div>

                                {/* Status label */}
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                                    isCompleted
                                      ? 'bg-emerald-500/15 text-emerald-500'
                                      : 'bg-amber-400/15 text-amber-400'
                                  }`}
                                >
                                  {isCompleted
                                    ? `Reviewed ${assignment.completedAt ? new Date(assignment.completedAt).toLocaleDateString() : ''}`
                                    : 'Pending'}
                                </span>
                              </div>

                              {/* Decision Feedback Details */}
                              {isCompleted && assignment.decision && (
                                <div
                                  className="ml-11 px-3.5 py-3 bg-app-surface rounded-lg mb-2"
                                  style={{
                                    borderLeft: `3px solid ${assignment.decision.verdict === 'APPROVED' ? '#10b981' : '#f87171'}`,
                                  }}
                                >
                                  <div
                                    className={`text-[11px] font-semibold mb-1 uppercase ${
                                      assignment.decision.verdict === 'APPROVED'
                                        ? 'text-emerald-500'
                                        : 'text-red-400'
                                    }`}
                                  >
                                    {assignment.decision.verdict}
                                  </div>
                                  <div className="text-[13px] text-app-muted leading-relaxed">
                                    {assignment.decision.comment}
                                  </div>
                                </div>
                              )}

                              {/* Standalone Comments */}
                              {assignment.standaloneComments &&
                                assignment.standaloneComments.length > 0 && (
                                  <div className="ml-11 flex flex-col gap-1.5">
                                    {assignment.standaloneComments.map((comment, idx) => (
                                      <div
                                        key={idx}
                                        className="px-3 py-2.5 bg-app-bg/60 rounded-lg border border-app-border/80"
                                      >
                                        <div className="flex justify-between mb-1">
                                          <span className="text-[11px] font-semibold text-app-text">
                                            Reviewer Comment
                                          </span>
                                          <span className="text-[10px] text-app-faint">
                                            {new Date(comment.time).toLocaleTimeString([], {
                                              hour: '2-digit',
                                              minute: '2-digit',
                                            })}
                                          </span>
                                        </div>
                                        <div className="text-xs text-app-muted leading-relaxed">
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
        <div className="px-6 py-3 border-t border-app-border flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-app-surface border border-app-border rounded-lg text-app-muted text-[13px] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
