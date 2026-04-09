import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, MessageSquare, AlertCircle, Loader2, FileText, Send, Check } from 'lucide-react';
import { reviewService, type ReviewAssignment } from '../services/reviewService';
import { contentService } from '../services/contentService';
import { adminUserService } from '../services/adminService';
import { useReviewStore } from '../store/reviewStore';

const screeningData = {
  score: 85,
  issues: [
    { type: 'warning', text: 'Consider adding more specific metrics for success measurement' },
    { type: 'info', text: 'Document structure follows best practices' },
    { type: 'success', text: 'No grammar or spelling errors detected' },
  ],
};

type ReviewItem = {
  id: string;
  assignmentId: string;
  title: string;
  author: string;
  authorEmail: string;
  submittedAt: string;
  status: string;
  contentId: string;
  contentBody?: string;
  requestedBy: string;
  verdict?: 'APPROVED' | 'DENIED';
  savedComment?: string;
  reviewRequestStatus?: string;
};

export default function ReviewLayout() {
  const {
    addDecision: ctxAddDecision,
    addComment: ctxAddComment,
    getComments: ctxGetComments,
    draftDecisions,
    draftDecisionComments,
    draftComments,
    setDraftDecision,
    setDraftDecisionComment,
    setDraftComment,
    clearDrafts,
  } = useReviewStore();
  const [comments, setComments] = useState<Array<{ id: string; author: string; text: string; time: string; resolved: boolean }>>([]);
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionSuccess, setDecisionSuccess] = useState(false);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);
  
  const currentAssignmentId = selectedItem?.assignmentId;
  const decision = selectedItem?.verdict || (currentAssignmentId ? draftDecisions[currentAssignmentId] : null) || null;
  const decisionComment = selectedItem?.savedComment || (currentAssignmentId ? draftDecisionComments[currentAssignmentId] : '') || '';
  const commentText = (currentAssignmentId ? draftComments[currentAssignmentId] : '') || '';
  const [loading, setLoading] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);

  const fetchAssignments = useCallback(async () => {
    try {
      setLoading(true);

      // Step 1: Get raw assignments (flat data — no nested relations)
      const assignments: ReviewAssignment[] = await reviewService.listMyAssignments();
      if (assignments.length === 0) {
        setReviewItems([]);
        setLoading(false);
        return;
      }

      // Step 2: Fetch all users up front (to look up requestedBy names)
      let userMap: Record<string, { displayName: string; email: string }> = {};
      try {
        const usersRes = await adminUserService.getUsers();
        const rawUsers = usersRes.data as unknown as Array<{ id: string; displayName?: string; email: string }>;
        for (const u of rawUsers) {
          userMap[u.id] = { displayName: u.displayName || u.email, email: u.email };
        }
      } catch {
        // Non-critical — we just won't show the requestedBy name
      }

      // Step 3: For each assignment, fetch the review request to get contentId + requester
      const items: ReviewItem[] = [];
      for (const assignment of assignments) {
        try {
          const reviewReq = await reviewService.getRequestById(assignment.reviewRequestId);
          const contentId = reviewReq.contentId;

          // Step 4: Fetch content details via getById (backend now allows reviewers)
          let title = 'Untitled';
          let authorName = 'Unknown';
          let authorEmail = '';
          try {
            const contentDetails = await contentService.getById(contentId);
            title = contentDetails.content.title || 'Untitled';
            const authorUser = userMap[contentDetails.content.authorId];
            if (authorUser) {
              authorName = authorUser.displayName;
              authorEmail = authorUser.email;
            }
          } catch {
            // Content fetch may fail — use fallback
          }

          const requestedByUser = userMap[reviewReq.requestedById];
          items.push({
            id: assignment.reviewRequestId,
            assignmentId: assignment.id,
            title,
            author: authorName,
            authorEmail,
            submittedAt: new Date(assignment.assignedAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
            status: assignment.status,
            contentId,
            requestedBy: requestedByUser?.displayName || 'Unknown',
          });
        } catch {
          // Skip assignments we can't fully resolve
        }
      }

      setReviewItems(items);
      if (items.length > 0) {
        setSelectedItem(items[0]);
      }
    } catch (err) {
      console.error('Failed to load review assignments:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  // Fetch content body when selectedItem changes
  useEffect(() => {
    if (!selectedItem?.contentId || selectedItem.contentBody) return;
    (async () => {
      try {
        setLoadingContent(true);
        const details = await contentService.getById(selectedItem.contentId);
        let bodyText = `${selectedItem.title}\n\nThis content is pending your review.`;

        const versions = details.versions;
        if (versions && versions.length > 0) {
          const bodyVersions = versions.filter(
            (v) => v.changeType === 'MANUAL_SAVE' || v.changeType === 'AI_GENERATED'
          );
          const versionWithBody = bodyVersions.length > 0
            ? bodyVersions.reduce((prev, curr) => curr.versionNumber > prev.versionNumber ? curr : prev)
            : null;

          if (versionWithBody) {
            const body = (versionWithBody as unknown as { body?: { type: string; content: unknown[] } })?.body;
            if (body && typeof body === 'object' && 'content' in body) {
              const extractText = (node: unknown): string => {
                if (!node || typeof node !== 'object') return '';
                const n = node as { type?: string; text?: string; content?: unknown[] };
                if (n.type === 'text' && n.text) return n.text;
                if (Array.isArray(n.content)) return n.content.map(extractText).join('');
                return '';
              };
              const paragraphs = (body.content as unknown[]).map(extractText).filter(Boolean);
              if (paragraphs.length > 0) {
                bodyText = paragraphs.join('\n\n');
              }
            }
          }
        }

        setSelectedItem((prev) =>
          prev && prev.contentId === selectedItem.contentId
            ? { ...prev, contentBody: bodyText }
            : prev
        );
      } catch {
        setSelectedItem((prev) =>
          prev ? { ...prev, contentBody: 'Unable to load content.' } : prev
        );
      } finally {
        setLoadingContent(false);
      }
    })();
  }, [selectedItem?.contentId, selectedItem?.contentBody]);

  useEffect(() => {
    if (!selectedItem?.assignmentId) return;
    const storedComments = ctxGetComments(selectedItem.assignmentId);
    let loadedComments: any[] = storedComments.map((c: { text: string; time: string | number | Date }, index: number) => ({
      id: `ctx_${index}_${Date.now()}`,
      author: 'You',
      text: c.text,
      time: new Date(c.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      resolved: false,
    }));

    if (selectedItem.verdict && selectedItem.savedComment) {
      loadedComments.push({
        id: `decision_ctx_${Date.now()}`,
        author: 'You',
        text: `[${selectedItem.verdict}] ${selectedItem.savedComment}`,
        time: 'Previously',
        resolved: false,
      });
    }

    setComments(loadedComments);
  }, [selectedItem?.assignmentId, selectedItem?.verdict, selectedItem?.savedComment, ctxGetComments]);

  const handleSelectItem = (item: ReviewItem) => {
    setSelectedItem(item);
    if (item.verdict) {
      setDecisionSuccess(true);
    } else {
      setDecisionSuccess(false);
    }
    setDecisionError(null);
  };

  const handleSubmitDecision = async () => {
    if (!selectedItem || !decision) return;
    if (!decisionComment.trim()) {
      setDecisionError('Please add a comment explaining your decision');
      return;
    }
    setSubmittingDecision(true);
    setDecisionError(null);
    try {
      await reviewService.decide(selectedItem.assignmentId, decision, decisionComment.trim());
      setDecisionSuccess(true);

      try {
        await reviewService.addComment(
          selectedItem.assignmentId,
          `[${decision}] ${decisionComment.trim()}`
        );
      } catch {
        // Non-critical — decision was already recorded
      }

      setComments((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          author: 'You',
          text: `[${decision}] ${decisionComment.trim()}`,
          time: 'Just now',
          resolved: false,
        },
      ]);

      let requestStatus = 'OPEN';
      try {
        const reviewReq = await reviewService.getRequestById(selectedItem.id);
        requestStatus = reviewReq.status || 'OPEN';
      } catch {
        // Non-critical
      }

      const updatedItem = {
        ...selectedItem,
        status: 'COMPLETED',
        verdict: decision,
        savedComment: decisionComment.trim(),
        reviewRequestStatus: requestStatus,
      };

      ctxAddDecision(selectedItem.assignmentId, decision, decisionComment.trim());

      setReviewItems((prev) =>
        prev.map((item) =>
          item.assignmentId === selectedItem.assignmentId
            ? updatedItem
            : item
        )
      );
      setSelectedItem(updatedItem);
      clearDrafts(selectedItem.assignmentId);
    } catch (err) {
      setDecisionError(err instanceof Error ? err.message : 'Failed to submit decision');
    } finally {
      setSubmittingDecision(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !selectedItem) return;

    try {
      await reviewService.addComment(selectedItem.assignmentId, commentText.trim());

      const newComment = {
        id: String(Date.now()),
        author: 'You',
        text: commentText.trim(),
        time: 'Just now',
        resolved: false,
      };

      setComments([...comments, newComment]);
      ctxAddComment(selectedItem.assignmentId, commentText.trim());
      setDraftComment(selectedItem.assignmentId, '');
    } catch (err) {
      console.error('Failed to post comment', err);
      alert('Failed to post comment: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0b0d14] gap-3">
        <Loader2 size={32} color="#a78bfa" className="animate-spin" />
        <p className="text-[13px] text-[#555870]">Loading your review assignments...</p>
      </div>
    );
  }

  if (reviewItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0b0d14] gap-4">
        <FileText size={48} color="#555870" />
        <h2 className="text-xl font-semibold text-[#e2e4f0] m-0">No Reviews Assigned</h2>
        <p className="text-sm text-[#555870] m-0">You don't have any content to review yet.</p>
      </div>
    );
  }

  const isAlreadyDecided = selectedItem?.status === 'COMPLETED';

  return (
    <div className="flex flex-col h-screen bg-[#0b0d14]">
      {/* Topbar */}
      <div className="px-6 py-3 bg-white/[0.03] border-b border-white/5 flex justify-between items-center">
        <div>
          <h1 className="text-base font-semibold text-[#e2e4f0] mb-1">
            {selectedItem?.title || 'Select a review'}
          </h1>
          <p className="text-xs text-[#555870] m-0">
            {selectedItem
              ? `Author: ${selectedItem.author}${selectedItem.authorEmail ? ` (${selectedItem.authorEmail})` : ''} • Shared by: ${selectedItem.requestedBy} • ${selectedItem.submittedAt}`
              : ''}
          </p>
        </div>
        {isAlreadyDecided && (
          <span className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-500 text-xs font-semibold">
            <Check size={14} /> Decision Submitted
          </span>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Review Items Sidebar */}
        <div className="w-[300px] border-r border-white/5 bg-white/[0.02] overflow-y-auto p-3">
          <h3 className="text-[11px] font-semibold text-[#555870] uppercase mx-2 mt-2 mb-3 tracking-wide">
            Content For Review ({reviewItems.length})
          </h3>
          <div className="flex flex-col gap-1">
            {reviewItems.map((item) => {
              const isActive = selectedItem?.assignmentId === item.assignmentId;
              const isPending = item.status === 'PENDING';
              return (
                <button
                  key={item.assignmentId}
                  onClick={() => handleSelectItem(item)}
                  className={`p-3.5 rounded-[10px] text-left cursor-pointer transition-all duration-150 ${
                    isActive
                      ? 'bg-violet-500/[0.12] border border-violet-500/30'
                      : 'bg-transparent border border-transparent'
                  } ${isPending ? 'opacity-100' : 'opacity-60'}`}
                >
                  <div className={`text-[13px] font-semibold mb-1.5 overflow-hidden text-ellipsis whitespace-nowrap ${isActive ? 'text-[#e2e4f0]' : 'text-[#c4c7d9]'}`}>
                    {item.title}
                  </div>
                  <div className="text-[11px] text-[#555870] mb-1">
                    by {item.author}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-[#555870]">{item.submittedAt}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-lg font-semibold uppercase ${
                      isPending ? 'bg-amber-400/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-500'
                    }`}>
                      {isPending ? 'PENDING' : 'REVIEWED'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content View Panel */}
        <div className="flex-1 overflow-y-auto p-6">
          {loadingContent ? (
            <div className="flex justify-center p-16">
              <Loader2 size={24} color="#a78bfa" className="animate-spin" />
            </div>
          ) : (
            <div className="max-w-[800px] bg-[#1a1d2e] rounded-xl p-8">
              {/* Content header */}
              <div className="mb-6">
                <h2 className="text-[22px] font-bold text-[#e2e4f0] mb-2">
                  {selectedItem?.title}
                </h2>
                <div className="flex gap-4 flex-wrap items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white text-xs font-semibold">
                      {(selectedItem?.author || 'U')[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-[#c4c7d9]">
                        {selectedItem?.author}
                      </div>
                      {selectedItem?.authorEmail && (
                        <div className="text-[10px] text-[#555870]">
                          {selectedItem.authorEmail}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-white/15">•</span>
                  <span className="text-[11px] text-[#555870]">
                    Shared by {selectedItem?.requestedBy}
                  </span>
                  <span className="text-white/15">•</span>
                  <span className="text-[11px] text-[#555870]">
                    {selectedItem?.submittedAt}
                  </span>
                </div>
              </div>

              <div className="h-px bg-white/[0.06] mb-6" />

              {/* Content body */}
              <pre className="whitespace-pre-wrap break-words text-[15px] text-[#c4c7d9] leading-relaxed m-0 font-[inherit]">
                {selectedItem?.contentBody || 'Loading content...'}
              </pre>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="w-[380px] bg-white/[0.02] border-l border-white/5 flex flex-col overflow-y-auto">
          {/* Review Decision */}
          <div className="p-5 border-b border-white/5">
            <h3 className="text-xs font-semibold text-[#555870] uppercase mb-3">
              Review Decision
            </h3>

            {isAlreadyDecided || decisionSuccess ? (
              <div className={`p-4 rounded-[10px] text-center ${
                selectedItem?.verdict === 'DENIED'
                  ? 'bg-red-500/10 border border-red-500/20'
                  : 'bg-emerald-500/10 border border-emerald-500/20'
              }`}>
                {selectedItem?.verdict === 'DENIED' ? (
                  <XCircle size={24} color="#f87171" className="mb-2 mx-auto" />
                ) : (
                  <CheckCircle size={24} color="#10b981" className="mb-2 mx-auto" />
                )}
                <p className={`text-[13px] font-semibold mb-1 ${
                  selectedItem?.verdict === 'DENIED' ? 'text-red-400' : 'text-emerald-500'
                }`}>
                  {selectedItem?.verdict === 'APPROVED' ? 'Approved' : selectedItem?.verdict === 'DENIED' ? 'Denied' : 'Decision Submitted'}
                </p>

                {/* Review Request Status */}
                {selectedItem?.reviewRequestStatus && (
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md mb-2 ${
                    selectedItem.reviewRequestStatus === 'CLOSED'
                      ? 'bg-violet-500/15'
                      : 'bg-amber-400/15'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      selectedItem.reviewRequestStatus === 'CLOSED' ? 'bg-violet-400' : 'bg-amber-400'
                    }`} />
                    <span className={`text-[11px] font-semibold ${
                      selectedItem.reviewRequestStatus === 'CLOSED' ? 'text-violet-400' : 'text-amber-400'
                    }`}>
                      Review Request: {selectedItem.reviewRequestStatus}
                    </span>
                  </div>
                )}

                {/* Comment from reviewer */}
                {selectedItem?.savedComment && (
                  <div
                    className="mt-2.5 px-3.5 py-2.5 bg-white/5 rounded-lg text-left"
                    style={{ borderLeft: `3px solid ${selectedItem?.verdict === 'DENIED' ? '#f87171' : '#10b981'}` }}
                  >
                    <span className="text-[10px] text-[#555870] uppercase font-semibold">Your Comment</span>
                    <p className="text-xs text-[#c4c7d9] mt-1.5 mb-0 leading-normal">{selectedItem.savedComment}</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => { if (currentAssignmentId) setDraftDecision(currentAssignmentId, 'APPROVED'); setDecisionError(null); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-semibold cursor-pointer transition-all duration-200 ${
                      decision === 'APPROVED'
                        ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-500'
                        : 'bg-emerald-500/[0.08] border-2 border-emerald-500/20 text-emerald-600'
                    }`}
                  >
                    <CheckCircle size={16} /> Approve
                  </button>
                  <button
                    onClick={() => { if (currentAssignmentId) setDraftDecision(currentAssignmentId, 'DENIED'); setDecisionError(null); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-semibold cursor-pointer transition-all duration-200 ${
                      decision === 'DENIED'
                        ? 'bg-red-500/20 border-2 border-red-400 text-red-400'
                        : 'bg-red-500/[0.08] border-2 border-red-500/20 text-red-600'
                    }`}
                  >
                    <XCircle size={16} /> Deny
                  </button>
                </div>

                {decision && (
                  <div className="mb-3">
                    <label className="text-[11px] text-[#8b8fa8] block mb-1.5">
                      Reason for your decision <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={decisionComment}
                      onChange={(e) => { if (currentAssignmentId) setDraftDecisionComment(currentAssignmentId, e.target.value); setDecisionError(null); }}
                      placeholder={decision === 'APPROVED'
                        ? 'Why are you approving this content...'
                        : 'What needs to be changed...'}
                      rows={3}
                      className={`w-full p-2.5 bg-white/5 rounded-lg text-[#e2e4f0] text-xs resize-none box-border outline-none ${
                        decisionError ? 'border border-red-400/50' : 'border border-white/10'
                      }`}
                    />
                  </div>
                )}

                {decisionError && (
                  <div className="px-3 py-2 bg-red-400/10 rounded-md mb-3">
                    <span className="text-[11px] text-red-400">{decisionError}</span>
                  </div>
                )}

                {decision && (
                  <button
                    onClick={handleSubmitDecision}
                    disabled={submittingDecision}
                    className={`w-full flex items-center justify-center gap-1.5 px-4 py-2.5 border-none rounded-lg text-white text-[13px] font-semibold transition-all duration-200 ${
                      submittingDecision
                        ? 'bg-violet-500/30 cursor-not-allowed'
                        : decision === 'APPROVED'
                          ? 'bg-gradient-to-br from-emerald-500 to-cyan-500 cursor-pointer'
                          : 'bg-gradient-to-br from-red-500 to-orange-500 cursor-pointer'
                    }`}
                  >
                    {submittingDecision ? (
                      <><Loader2 size={14} className="animate-spin" /> Submitting...</>
                    ) : (
                      <><Send size={14} /> Submit {decision === 'APPROVED' ? 'Approval' : 'Denial'}</>
                    )}
                  </button>
                )}
              </>
            )}
          </div>

          {/* AI Screening Panel */}
          <div className="p-5 border-b border-white/5">
            <h3 className="text-xs font-semibold text-[#555870] uppercase mb-3">
              AI Screening
            </h3>
            <div className="mb-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-[#8b8fa8]">Quality Score</span>
                <span className={`text-lg font-bold ${screeningData.score > 80 ? 'text-emerald-500' : 'text-amber-400'}`}>
                  {screeningData.score}/100
                </span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-sm overflow-hidden">
                <div
                  className="h-full rounded-sm"
                  style={{
                    width: `${screeningData.score}%`,
                    background: `linear-gradient(90deg, ${screeningData.score > 80 ? '#10b981' : '#fbbf24'}, ${screeningData.score > 80 ? '#34d399' : '#f59e0b'})`,
                  }}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {screeningData.issues.map((issue, i) => (
                <div key={i} className="flex gap-2 items-start">
                  {issue.type === 'warning' && <AlertCircle size={14} color="#fbbf24" className="mt-0.5" />}
                  {issue.type === 'info' && <AlertCircle size={14} color="#06b6d4" className="mt-0.5" />}
                  {issue.type === 'success' && <CheckCircle size={14} color="#10b981" className="mt-0.5" />}
                  <span className="text-[11px] text-[#8b8fa8]">{issue.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Comments Thread */}
          <div className="p-5 flex-1">
            <h3 className="text-xs font-semibold text-[#555870] uppercase mb-3">
              Comments ({comments.length})
            </h3>
            <div className="flex flex-col gap-3 mb-4">
              {comments.map((comment) => (
                <div key={comment.id} className={`p-3 bg-white/[0.03] rounded-lg ${comment.resolved ? 'opacity-50' : ''}`}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-xs font-semibold text-[#e2e4f0]">{comment.author}</span>
                    <span className="text-[10px] text-[#555870]">{comment.time}</span>
                  </div>
                  <p className="text-xs text-[#c4c7d9] mb-1.5">{comment.text}</p>
                  {comment.resolved && (
                    <span className="text-[10px] text-emerald-500 flex items-center gap-1">
                      <CheckCircle size={10} /> Resolved
                    </span>
                  )}
                </div>
              ))}
              {comments.length === 0 && (
                <div className="p-4 text-center text-[#555870] text-xs">
                  No comments yet. Add a comment to discuss this content.
                </div>
              )}
            </div>

            <div>
              <textarea
                value={commentText}
                onChange={(e) => { if (currentAssignmentId) setDraftComment(currentAssignmentId, e.target.value); }}
                placeholder="Add a comment or feedback..."
                rows={3}
                className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-[#e2e4f0] text-xs resize-none mb-2 box-border"
              />
              <button
                onClick={handleAddComment}
                disabled={!commentText.trim()}
                className={`w-full px-4 py-2.5 border-none rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 ${
                  commentText.trim()
                    ? 'bg-gradient-to-br from-violet-500 to-cyan-500 text-white cursor-pointer'
                    : 'bg-white/10 text-[#555870] cursor-not-allowed'
                }`}
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
