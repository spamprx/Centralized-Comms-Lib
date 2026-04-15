import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  MessageSquare,
  AlertCircle,
  Loader2,
  FileText,
  Send,
  Check,
  History,
} from 'lucide-react';
import { reviewService, type ReviewAssignment } from '../services/reviewService';
import { contentService } from '../services/contentService';
import { adminUserService } from '../services/adminService';
import { useReviewStore } from '../store/reviewStore';
import { Surface } from '../components/ui/Surface';
import TipTapReadonly from '../components/editor/TipTapReadonly';

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
  contentBody?: unknown;
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
  const [comments, setComments] = useState<
    Array<{ id: string; author: string; text: string; time: string; resolved: boolean }>
  >([]);
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionSuccess, setDecisionSuccess] = useState(false);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);

  const currentAssignmentId = selectedItem?.assignmentId;
  const decision =
    selectedItem?.verdict ||
    (currentAssignmentId ? draftDecisions[currentAssignmentId] : null) ||
    null;
  const decisionComment =
    selectedItem?.savedComment ||
    (currentAssignmentId ? draftDecisionComments[currentAssignmentId] : '') ||
    '';
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
        const rawUsers = usersRes.data as unknown as Array<{
          id: string;
          displayName?: string;
          email: string;
        }>;
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
        let bodyDoc: unknown = null;

        const versions = details.versions;
        if (versions && versions.length > 0) {
          const bodyVersions = versions.filter(
            (v) => v.changeType === 'MANUAL_SAVE' || v.changeType === 'AI_GENERATED',
          );
          const versionWithBody =
            bodyVersions.length > 0
              ? bodyVersions.reduce((prev, curr) =>
                  curr.versionNumber > prev.versionNumber ? curr : prev,
                )
              : null;

          if (versionWithBody) {
            bodyDoc = (versionWithBody as unknown as { body?: unknown })?.body ?? null;
          }
        }

        setSelectedItem((prev) =>
          prev && prev.contentId === selectedItem.contentId
            ? { ...prev, contentBody: bodyDoc }
            : prev,
        );
      } catch {
        setSelectedItem((prev) => (prev ? { ...prev, contentBody: null } : prev));
      } finally {
        setLoadingContent(false);
      }
    })();
  }, [selectedItem?.contentId, selectedItem?.contentBody]);

  useEffect(() => {
    if (!selectedItem?.assignmentId) return;
    const storedComments = ctxGetComments(selectedItem.assignmentId);
    let loadedComments: any[] = storedComments.map(
      (c: { text: string; time: string | number | Date }, index: number) => ({
        id: `ctx_${index}_${Date.now()}`,
        author: 'You',
        text: c.text,
        time: new Date(c.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        resolved: false,
      }),
    );

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
  }, [
    selectedItem?.assignmentId,
    selectedItem?.verdict,
    selectedItem?.savedComment,
    ctxGetComments,
  ]);

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
          `[${decision}] ${decisionComment.trim()}`,
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
        prev.map((item) => (item.assignmentId === selectedItem.assignmentId ? updatedItem : item)),
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
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4">
        <Surface
          variant="glass"
          padding="lg"
          className="flex max-w-md flex-col items-center gap-4 text-center"
        >
          <Loader2 size={32} className="animate-spin text-app-accent" aria-hidden />
          <p className="m-0 text-[13px] text-app-muted">Loading your review assignments…</p>
        </Surface>
      </div>
    );
  }

  if (reviewItems.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4">
        <Surface
          variant="glass"
          padding="lg"
          className="flex max-w-md flex-col items-center gap-3 text-center"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-app-xl bg-app-accent-muted text-app-accent">
            <FileText size={28} strokeWidth={1.75} />
          </div>
          <h2 className="m-0 text-xl font-semibold text-app-text">No reviews assigned</h2>
          <p className="m-0 text-sm text-app-faint">You do not have any content to review yet.</p>
        </Surface>
      </div>
    );
  }

  const isAlreadyDecided = selectedItem?.status === 'COMPLETED';

  return (
    <div className="flex h-screen flex-col bg-app-bg">
      {/* Topbar */}
      <div className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-4 border-b border-app-border/80 bg-app-surface/70 px-4 py-3 shadow-app-soft backdrop-blur-xl supports-[backdrop-filter]:bg-app-surface/50 sm:items-center sm:px-6">
        <div className="min-w-0 flex-1">
          <h1 className="mb-1 truncate text-base font-semibold text-app-text">
            {selectedItem?.title || 'Select a review'}
          </h1>
          <p className="m-0 text-xs text-app-faint">
            {selectedItem
              ? `Author: ${selectedItem.author}${selectedItem.authorEmail ? ` (${selectedItem.authorEmail})` : ''} · Shared by ${selectedItem.requestedBy} · ${selectedItem.submittedAt}`
              : ''}
          </p>
          {selectedItem && (
            <Link
              to={`/history/${selectedItem.contentId}`}
              className="mt-2 inline-flex items-center gap-1.5 rounded-app-md border border-app-border/70 bg-app-bg/40 px-2.5 py-1 text-[11px] font-medium text-app-muted transition-colors hover:border-app-accent/35 hover:text-app-accent"
            >
              <History size={12} />
              Version history (this document)
            </Link>
          )}
        </div>
        {isAlreadyDecided && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-app-md border border-emerald-400/35 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
            <Check size={14} /> Decision submitted
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2 sm:p-3 lg:flex-row">
        {/* Review Items Sidebar */}
        <Surface
          variant="glass"
          padding="sm"
          className="max-h-[40vh] w-full shrink-0 overflow-y-auto lg:max-h-none lg:w-[300px]"
        >
          <h3 className="mx-1 mb-3 mt-1 text-[11px] font-semibold uppercase tracking-wide text-app-faint">
            Inbox ({reviewItems.length})
          </h3>
          <div className="flex flex-col gap-1.5">
            {reviewItems.map((item) => {
              const isActive = selectedItem?.assignmentId === item.assignmentId;
              const isPending = item.status === 'PENDING';
              return (
                <button
                  type="button"
                  key={item.assignmentId}
                  onClick={() => handleSelectItem(item)}
                  className={`rounded-app-lg border p-3.5 text-left transition-all duration-150 ${
                    isActive
                      ? 'border-app-accent/35 bg-app-accent-muted shadow-[0_0_0_1px_rgba(147,124,248,0.12)]'
                      : 'border-transparent bg-app-bg/25 hover:border-app-border/80 hover:bg-app-elevated'
                  } ${isPending ? 'opacity-100' : 'opacity-65'}`}
                >
                  <div
                    className={`text-[13px] font-semibold mb-1.5 overflow-hidden text-ellipsis whitespace-nowrap ${isActive ? 'text-app-text' : 'text-app-muted'}`}
                  >
                    {item.title}
                  </div>
                  <div className="text-[11px] text-app-faint mb-1">by {item.author}</div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-app-faint">{item.submittedAt}</span>
                    <span
                      className={`rounded-lg px-2 py-0.5 text-[9px] font-semibold uppercase ${
                        isPending
                          ? 'bg-amber-400/15 text-amber-300'
                          : 'bg-emerald-500/15 text-emerald-300'
                      }`}
                    >
                      {isPending ? 'PENDING' : 'REVIEWED'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </Surface>

        {/* Content View Panel */}
        <div className="min-w-0 flex-1 overflow-y-auto p-2 sm:p-3 lg:p-1">
          {loadingContent ? (
            <div className="flex justify-center p-16">
              <Loader2 size={24} className="animate-spin text-app-accent" />
            </div>
          ) : (
            <Surface variant="default" padding="lg" className="mx-auto max-w-[800px]">
              {/* Content header */}
              <div className="mb-6">
                <h2 className="text-[22px] font-bold text-app-text mb-2">{selectedItem?.title}</h2>
                <div className="flex gap-4 flex-wrap items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white text-xs font-semibold">
                      {(selectedItem?.author || 'U')[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-app-muted">
                        {selectedItem?.author}
                      </div>
                      {selectedItem?.authorEmail && (
                        <div className="text-[10px] text-app-faint">{selectedItem.authorEmail}</div>
                      )}
                    </div>
                  </div>
                  <span className="text-app-faint">·</span>
                  <span className="text-[11px] text-app-faint">
                    Shared by {selectedItem?.requestedBy}
                  </span>
                  <span className="text-app-faint">·</span>
                  <span className="text-[11px] text-app-faint">{selectedItem?.submittedAt}</span>
                </div>
              </div>

              <div className="h-px bg-app-elevated mb-6" />

              {/* Content body */}
              {selectedItem?.contentBody &&
              typeof selectedItem.contentBody === 'object' &&
              selectedItem.contentBody !== null &&
              'type' in (selectedItem.contentBody as Record<string, unknown>) ? (
                <div className="tiptap-content">
                  <TipTapReadonly
                    doc={selectedItem.contentBody as any}
                    className="ProseMirror text-[15px] leading-relaxed text-app-muted outline-none"
                  />
                </div>
              ) : (
                <p className="m-0 text-[13px] leading-relaxed text-app-faint">
                  {loadingContent ? 'Loading content…' : 'No body captured for this submission.'}
                </p>
              )}
            </Surface>
          )}
        </div>

        {/* Right Sidebar */}
        <Surface
          variant="glass"
          padding="none"
          className="flex max-h-[min(52vh,520px)] w-full shrink-0 flex-col overflow-y-auto lg:max-h-none lg:w-[380px]"
        >
          {/* Review Decision */}
          <div className="p-5 border-b border-app-border/80">
            <h3 className="text-xs font-semibold text-app-faint uppercase mb-3">Review Decision</h3>

            {isAlreadyDecided || decisionSuccess ? (
              <div
                className={`p-4 rounded-app-lg text-center ${
                  selectedItem?.verdict === 'DENIED'
                    ? 'bg-red-500/10 border border-red-500/20'
                    : 'bg-emerald-500/10 border border-emerald-500/20'
                }`}
              >
                {selectedItem?.verdict === 'DENIED' ? (
                  <XCircle size={24} color="#f87171" className="mb-2 mx-auto" />
                ) : (
                  <CheckCircle size={24} color="#10b981" className="mb-2 mx-auto" />
                )}
                <p
                  className={`mb-1 text-[13px] font-semibold ${
                    selectedItem?.verdict === 'DENIED' ? 'text-red-300' : 'text-emerald-300'
                  }`}
                >
                  {selectedItem?.verdict === 'APPROVED'
                    ? 'Approved'
                    : selectedItem?.verdict === 'DENIED'
                      ? 'Denied'
                      : 'Decision Submitted'}
                </p>

                {/* Review Request Status */}
                {selectedItem?.reviewRequestStatus && (
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md mb-2 ${
                      selectedItem.reviewRequestStatus === 'CLOSED'
                        ? 'bg-violet-500/15'
                        : 'bg-amber-400/15'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        selectedItem.reviewRequestStatus === 'CLOSED'
                          ? 'bg-violet-400'
                          : 'bg-amber-400'
                      }`}
                    />
                    <span
                      className={`text-[11px] font-semibold ${
                        selectedItem.reviewRequestStatus === 'CLOSED'
                          ? 'text-violet-400'
                          : 'text-amber-400'
                      }`}
                    >
                      Review Request: {selectedItem.reviewRequestStatus}
                    </span>
                  </div>
                )}

                {/* Comment from reviewer */}
                {selectedItem?.savedComment && (
                  <div
                    className="mt-2.5 px-3.5 py-2.5 bg-app-surface rounded-lg text-left"
                    style={{
                      borderLeft: `3px solid ${selectedItem?.verdict === 'DENIED' ? '#f87171' : '#10b981'}`,
                    }}
                  >
                    <span className="text-[10px] text-app-faint uppercase font-semibold">
                      Your Comment
                    </span>
                    <p className="text-xs text-app-muted mt-1.5 mb-0 leading-normal">
                      {selectedItem.savedComment}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => {
                      if (currentAssignmentId) setDraftDecision(currentAssignmentId, 'APPROVED');
                      setDecisionError(null);
                    }}
                    className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-app-lg border-2 px-4 py-2.5 text-[13px] font-semibold transition-all duration-200 ${
                      decision === 'APPROVED'
                        ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200'
                        : 'border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300/90'
                    }`}
                  >
                    <CheckCircle size={16} /> Approve
                  </button>
                  <button
                    onClick={() => {
                      if (currentAssignmentId) setDraftDecision(currentAssignmentId, 'DENIED');
                      setDecisionError(null);
                    }}
                    className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-app-lg border-2 px-4 py-2.5 text-[13px] font-semibold transition-all duration-200 ${
                      decision === 'DENIED'
                        ? 'border-red-400/70 bg-red-500/20 text-red-200'
                        : 'border-red-500/25 bg-red-500/[0.08] text-red-300/90'
                    }`}
                  >
                    <XCircle size={16} /> Deny
                  </button>
                </div>

                {decision && (
                  <div className="mb-3">
                    <label className="text-[11px] text-app-muted block mb-1.5">
                      Reason for your decision <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={decisionComment}
                      onChange={(e) => {
                        if (currentAssignmentId)
                          setDraftDecisionComment(currentAssignmentId, e.target.value);
                        setDecisionError(null);
                      }}
                      placeholder={
                        decision === 'APPROVED'
                          ? 'Why are you approving this content...'
                          : 'What needs to be changed...'
                      }
                      rows={3}
                      className={`w-full p-2.5 bg-app-surface rounded-lg text-app-text text-xs resize-none box-border outline-none ${
                        decisionError ? 'border border-red-400/50' : 'border border-app-border'
                      }`}
                    />
                  </div>
                )}

                {decisionError && (
                  <div className="mb-3 rounded-app-md border border-red-400/25 bg-red-500/10 px-3 py-2">
                    <span className="text-[11px] text-red-200">{decisionError}</span>
                  </div>
                )}

                {decision && (
                  <button
                    onClick={handleSubmitDecision}
                    disabled={submittingDecision}
                    className={`flex w-full items-center justify-center gap-1.5 rounded-app-lg border-none px-4 py-2.5 text-[13px] font-semibold text-white transition-all duration-200 ${
                      submittingDecision
                        ? 'cursor-not-allowed bg-app-accent/35'
                        : decision === 'APPROVED'
                          ? 'cursor-pointer bg-gradient-to-br from-emerald-500 to-app-accent-2'
                          : 'cursor-pointer bg-gradient-to-br from-red-500 to-orange-500'
                    }`}
                  >
                    {submittingDecision ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Submitting...
                      </>
                    ) : (
                      <>
                        <Send size={14} /> Submit {decision === 'APPROVED' ? 'Approval' : 'Denial'}
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </div>

          {/* AI Screening Panel */}
          <div className="border-b border-app-border/80 p-5">
            <h3 className="mb-3 text-xs font-semibold uppercase text-app-faint">AI screening</h3>
            <div className="mb-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-app-muted">Quality Score</span>
                <span
                  className={`text-lg font-bold ${screeningData.score > 80 ? 'text-emerald-500' : 'text-amber-400'}`}
                >
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
                  {issue.type === 'warning' && (
                    <AlertCircle size={14} color="#fbbf24" className="mt-0.5" />
                  )}
                  {issue.type === 'info' && (
                    <AlertCircle size={14} color="#06b6d4" className="mt-0.5" />
                  )}
                  {issue.type === 'success' && (
                    <CheckCircle size={14} color="#10b981" className="mt-0.5" />
                  )}
                  <span className="text-[11px] text-app-muted">{issue.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Comments Thread */}
          <div className="flex flex-1 flex-col p-5">
            <h3 className="mb-3 text-xs font-semibold uppercase text-app-faint">
              Comments ({comments.length})
            </h3>
            <div className="flex flex-col gap-3 mb-4">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className={`p-3 bg-app-surface rounded-lg ${comment.resolved ? 'opacity-50' : ''}`}
                >
                  <div className="flex justify-between mb-1.5">
                    <span className="text-xs font-semibold text-app-text">{comment.author}</span>
                    <span className="text-[10px] text-app-faint">{comment.time}</span>
                  </div>
                  <p className="text-xs text-app-muted mb-1.5">{comment.text}</p>
                  {comment.resolved && (
                    <span className="text-[10px] text-emerald-500 flex items-center gap-1">
                      <CheckCircle size={10} /> Resolved
                    </span>
                  )}
                </div>
              ))}
              {comments.length === 0 && (
                <div className="p-4 text-center text-app-faint text-xs">
                  No comments yet. Add a comment to discuss this content.
                </div>
              )}
            </div>

            <div>
              <textarea
                value={commentText}
                onChange={(e) => {
                  if (currentAssignmentId) setDraftComment(currentAssignmentId, e.target.value);
                }}
                placeholder="Add a comment or feedback..."
                rows={3}
                className="w-full p-3 bg-app-surface border border-app-border rounded-lg text-app-text text-xs resize-none mb-2 box-border"
              />
              <button
                onClick={handleAddComment}
                disabled={!commentText.trim()}
                className={`flex w-full items-center justify-center gap-1.5 rounded-app-md border-none px-4 py-2.5 text-xs font-semibold ${
                  commentText.trim()
                    ? 'cursor-pointer bg-gradient-to-br from-app-accent to-app-accent-2 text-white shadow-app-soft'
                    : 'cursor-not-allowed bg-app-elevated text-app-faint'
                }`}
              >
                <MessageSquare size={14} /> Post Comment
              </button>
            </div>
          </div>
        </Surface>
      </div>
    </div>
  );
}
