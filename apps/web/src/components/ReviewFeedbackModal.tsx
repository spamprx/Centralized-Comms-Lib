import { useState, useEffect } from 'react';
import { X, Users, CheckCircle, Clock, Loader2, MessageCircle } from 'lucide-react';
import { reviewService, type ReviewRequest } from '../services/reviewService';
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

        const requests: ReviewRequest[] = await reviewService.listForContent(contentId);

        const idSet = new Set<string>();
        const fullRequests: Awaited<ReturnType<typeof reviewService.getRequestById>>[] = [];
        for (const req of requests) {
          try {
            const fullRequest = await reviewService.getRequestById(req.id);
            fullRequests.push(fullRequest);
            idSet.add(fullRequest.requestedById);
            for (const a of fullRequest.assignments || []) {
              idSet.add(a.reviewerId);
            }
          } catch {
            // Skip failed requests
          }
        }

        const userMap: Record<string, { displayName: string; email: string }> = {};
        try {
          const rows = await reviewService.lookupUserDisplayNames([...idSet]);
          for (const u of rows) {
            userMap[u.id] = {
              displayName: (u.displayName && String(u.displayName)) || u.email,
              email: u.email,
            };
          }
        } catch {
          // Non-critical
        }

        const feedbacks: ReviewFeedbackInfo[] = [];
        for (const fullRequest of fullRequests) {
          try {
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
              requestId: fullRequest.id,
              status: fullRequest.status,
              createdAt:
                typeof fullRequest.createdAt === 'string'
                  ? fullRequest.createdAt
                  : new Date(fullRequest.createdAt).toISOString(),
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
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[80vh] w-full max-w-[520px] flex-col overflow-hidden rounded-app-xl border border-white/10 bg-app-bg/90 shadow-app-lift backdrop-blur-2xl supports-backdrop-filter:bg-app-bg/75"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-app-accent/50 to-app-accent-2/35"
          aria-hidden
        />
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-6 py-5">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-app-md border border-app-accent/30 bg-app-accent/10 text-app-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <MessageCircle size={18} strokeWidth={2} />
              </span>
              <h2 className="m-0 text-base font-semibold tracking-tight text-app-text">
                Review Feedback
              </h2>
            </div>
            <p className="m-0 max-w-[380px] truncate text-xs text-app-muted">{contentTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-app-md border border-transparent p-2 text-app-faint transition-colors hover:border-white/10 hover:bg-white/[0.06] hover:text-app-text"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto scroll-smooth px-6 py-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={26} className="animate-spin text-app-accent" />
            </div>
          ) : error ? (
            <div className="rounded-app-md border border-red-400/20 bg-red-500/10 px-4 py-6 text-center text-[13px] text-red-200">
              {error}
            </div>
          ) : feedbackList.length === 0 ? (
            <div className="rounded-app-lg border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center text-[13px] text-app-muted">
              No review requests found for this content.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {feedbackList.map((feedback) => (
                <div
                  key={feedback.requestId}
                  className="overflow-hidden rounded-app-xl border border-white/[0.08] bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                >
                  {/* Request Header */}
                  <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Users size={14} strokeWidth={2} className="text-app-accent/80" />
                      <span className="text-xs font-medium text-app-muted">Review Request</span>
                    </div>
                    <span
                      className={`rounded-app-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        feedback.status === 'CLOSED'
                          ? 'border border-emerald-400/25 bg-emerald-500/12 text-emerald-200'
                          : 'border border-amber-400/25 bg-amber-400/12 text-amber-200'
                      }`}
                    >
                      {feedback.status}
                    </span>
                  </div>

                  {/* Assignments */}
                  <div className="px-4 py-3 pb-4">
                    {feedback.assignments.length === 0 ? (
                      <div className="py-4 text-center text-xs text-app-faint">
                        No reviewers assigned yet
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2.5">
                        {feedback.assignments.map((assignment) => {
                          const isCompleted = assignment.status === 'COMPLETED';
                          return (
                            <div key={assignment.id} className="flex flex-col gap-2">
                              <div
                                className={`flex items-center gap-3 rounded-app-lg border px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
                                  isCompleted
                                    ? 'border-emerald-400/20 bg-emerald-500/[0.07]'
                                    : 'border-white/[0.08] bg-white/[0.02]'
                                }`}
                              >
                                {isCompleted ? (
                                  <CheckCircle
                                    size={18}
                                    className="shrink-0 text-emerald-400"
                                    strokeWidth={2}
                                  />
                                ) : (
                                  <Clock
                                    size={18}
                                    className="shrink-0 text-amber-400"
                                    strokeWidth={2}
                                  />
                                )}

                                <div
                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white shadow-inner ${
                                    isCompleted
                                      ? 'bg-gradient-to-br from-emerald-500 to-app-accent-2'
                                      : 'bg-gradient-to-br from-white/12 to-white/[0.04]'
                                  }`}
                                >
                                  {assignment.reviewerName[0].toUpperCase()}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-[13px] font-medium text-app-text">
                                    {assignment.reviewerName}
                                  </div>
                                  <div className="truncate text-[11px] text-app-faint">
                                    {assignment.reviewerEmail}
                                  </div>
                                </div>

                                <span
                                  className={`shrink-0 rounded-app-md px-2 py-0.5 text-[10px] font-semibold ${
                                    isCompleted
                                      ? 'border border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
                                      : 'border border-amber-400/20 bg-amber-400/10 text-amber-200'
                                  }`}
                                >
                                  {isCompleted
                                    ? `Reviewed ${assignment.completedAt ? new Date(assignment.completedAt).toLocaleDateString() : ''}`
                                    : 'Pending'}
                                </span>
                              </div>

                              {isCompleted && assignment.decision && (
                                <div
                                  className={`mb-1 ml-11 rounded-app-md border border-white/[0.07] bg-white/[0.03] px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
                                    assignment.decision.verdict === 'APPROVED'
                                      ? 'border-l-[3px] border-l-emerald-500'
                                      : 'border-l-[3px] border-l-red-400'
                                  }`}
                                >
                                  <div
                                    className={`mb-1 text-[11px] font-semibold uppercase tracking-wide ${
                                      assignment.decision.verdict === 'APPROVED'
                                        ? 'text-emerald-400'
                                        : 'text-red-300'
                                    }`}
                                  >
                                    {assignment.decision.verdict}
                                  </div>
                                  <div className="text-[13px] leading-relaxed text-app-muted">
                                    {assignment.decision.comment}
                                  </div>
                                </div>
                              )}

                              {assignment.standaloneComments &&
                                assignment.standaloneComments.length > 0 && (
                                  <div className="ml-11 flex flex-col gap-1.5">
                                    {assignment.standaloneComments.map((comment, idx) => (
                                      <div
                                        key={idx}
                                        className="rounded-app-md border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                                      >
                                        <div className="mb-1 flex justify-between gap-2">
                                          <span className="text-[11px] font-semibold text-app-text">
                                            Reviewer Comment
                                          </span>
                                          <span className="shrink-0 text-[10px] tabular-nums text-app-faint">
                                            {new Date(comment.time).toLocaleTimeString([], {
                                              hour: '2-digit',
                                              minute: '2-digit',
                                            })}
                                          </span>
                                        </div>
                                        <div className="text-xs leading-relaxed text-app-muted">
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
        <div className="flex justify-end border-t border-white/[0.08] px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-app-md border border-white/10 bg-white/[0.04] px-5 py-2 text-[13px] font-medium text-app-muted transition-colors hover:bg-white/[0.07]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
