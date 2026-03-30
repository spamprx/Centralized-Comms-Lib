import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, MessageSquare, AlertCircle, Loader2, FileText, Send, Check } from 'lucide-react';
import { reviewService, type ReviewAssignment } from '../services/reviewService';
import { contentService } from '../services/contentService';
import { adminUserService } from '../services/adminService';

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
  const [decisionComment, setDecisionComment] = useState('');
  const [comments, setComments] = useState<Array<{ id: string; author: string; text: string; time: string; resolved: boolean }>>([]);
  const [commentText, setCommentText] = useState('');
  const [decision, setDecision] = useState<'APPROVED' | 'DENIED' | null>(null);
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionSuccess, setDecisionSuccess] = useState(false);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);
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
          // Find the latest MANUAL_SAVE or AI_GENERATED version (has actual body),
          // skip STATE_TRANSITION versions which only have {from, to} metadata
          const bodyVersions = versions.filter(
            (v) => v.changeType === 'MANUAL_SAVE' || v.changeType === 'AI_GENERATED'
          );
          const versionWithBody = bodyVersions.length > 0
            ? bodyVersions.reduce((prev, curr) => curr.versionNumber > prev.versionNumber ? curr : prev)
            : null;

          if (versionWithBody) {
            const metadata = (versionWithBody as unknown as { metadataSnapshot?: { body?: { type: string; content: unknown[] } } })?.metadataSnapshot;
            const body = metadata?.body;
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
    // Restore comments (both standalone and decision) from localStorage anytime the selected item changes
    try {
      const storageKey = `review_comments_${selectedItem.assignmentId}`;
      const rawComments = localStorage.getItem(storageKey);
      let loadedComments: any[] = [];
      
      if (rawComments) {
        const parsed = JSON.parse(rawComments);
        loadedComments = parsed.map((c: any, index: number) => ({
          id: `local_${index}_${Date.now()}`,
          author: 'You',
          text: c.text,
          time: new Date(c.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          resolved: false,
        }));
      }

      // If they already made a decision in the past, inject that comment into the unified chat
      if (selectedItem.verdict && selectedItem.savedComment) {
        loadedComments.push({
          id: `decision_local_${Date.now()}`,
          author: 'You',
          text: `[${selectedItem.verdict}] ${selectedItem.savedComment}`,
          time: 'Previously',
          resolved: false,
        });
      }

      setComments(loadedComments);
    } catch {
      setComments([]);
    }
  }, [selectedItem?.assignmentId, selectedItem?.verdict, selectedItem?.savedComment]);

  const handleSelectItem = (item: ReviewItem) => {
    setSelectedItem(item);
    // Restore saved decision info if item was already decided
    if (item.verdict) {
      setDecision(item.verdict);
      setDecisionComment(item.savedComment || '');
      setDecisionSuccess(true);
    } else {
      setDecision(null);
      setDecisionComment('');
      setDecisionSuccess(false);
    }
    setDecisionError(null);
    setCommentText('');
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

      // Also persist the decision comment as a ReviewComment so the author can see it
      try {
        await reviewService.addComment(
          selectedItem.assignmentId,
          `[${decision}] ${decisionComment.trim()}`
        );
      } catch {
        // Non-critical — decision was already recorded
      }

      // Add the decision comment to the local comments thread
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

      // Fetch the review request status after decision
      let requestStatus = 'OPEN';
      try {
        const reviewReq = await reviewService.getRequestById(selectedItem.id);
        requestStatus = reviewReq.status || 'OPEN';
      } catch {
        // Non-critical
      }

      // Save decision info in the review item so it persists across selection changes
      const updatedItem = {
        ...selectedItem,
        status: 'COMPLETED',
        verdict: decision,
        savedComment: decisionComment.trim(),
        reviewRequestStatus: requestStatus,
      };
      
      // EXTREMELY IMPORTANT NO-BACKEND WORKAROUND:
      // Persist the decision to localStorage so the author can read it on the MyContent page
      // since the GET /decide endpoint does not exist.
      localStorage.setItem(`review_decision_${selectedItem.assignmentId}`, JSON.stringify({
        verdict: decision,
        comment: decisionComment.trim(),
      }));

      setReviewItems((prev) =>
        prev.map((item) =>
          item.assignmentId === selectedItem.assignmentId
            ? updatedItem
            : item
        )
      );
      setSelectedItem(updatedItem);
    } catch (err) {
      setDecisionError(err instanceof Error ? err.message : 'Failed to submit decision');
    } finally {
      setSubmittingDecision(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !selectedItem) return;

    try {
      // 1. Call the backend API
      await reviewService.addComment(selectedItem.assignmentId, commentText.trim());

      const newComment = {
        id: String(Date.now()),
        author: 'You',
        text: commentText.trim(),
        time: 'Just now',
        resolved: false,
      };

      // 2. Update local state
      setComments([...comments, newComment]);
      
      // 3. Persist to localStorage for the Author to view (Frontend-only GET workaround)
      const storageKey = `review_comments_${selectedItem.assignmentId}`;
      const existingRaw = localStorage.getItem(storageKey);
      const existingComments = existingRaw ? JSON.parse(existingRaw) : [];
      existingComments.push({ text: commentText.trim(), time: new Date().toISOString() });
      localStorage.setItem(storageKey, JSON.stringify(existingComments));

      setCommentText('');
    } catch (err) {
      console.error('Failed to post comment', err);
      alert('Failed to post comment: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0b0d14', gap: 12 }}>
        <Loader2 size={32} color="#a78bfa" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: 13, color: '#555870' }}>Loading your review assignments...</p>
      </div>
    );
  }

  if (reviewItems.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0b0d14',
        gap: 16,
      }}>
        <FileText size={48} color="#555870" />
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#e2e4f0', margin: 0 }}>No Reviews Assigned</h2>
        <p style={{ fontSize: 14, color: '#555870', margin: 0 }}>You don't have any content to review yet.</p>
      </div>
    );
  }

  const isAlreadyDecided = selectedItem?.status === 'COMPLETED';

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
          <h1 style={{ fontSize: 16, fontWeight: 600, color: '#e2e4f0', margin: '0 0 4px' }}>
            {selectedItem?.title || 'Select a review'}
          </h1>
          <p style={{ fontSize: 12, color: '#555870', margin: 0 }}>
            {selectedItem
              ? `Author: ${selectedItem.author}${selectedItem.authorEmail ? ` (${selectedItem.authorEmail})` : ''} • Shared by: ${selectedItem.requestedBy} • ${selectedItem.submittedAt}`
              : ''}
          </p>
        </div>
        {isAlreadyDecided && (
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 8,
            color: '#10b981',
            fontSize: 12,
            fontWeight: 600,
          }}>
            <Check size={14} /> Decision Submitted
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Review Items Sidebar */}
        <div style={{
          width: 300,
          borderRight: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(255,255,255,0.02)',
          overflowY: 'auto',
          padding: 12,
        }}>
          <h3 style={{ fontSize: 11, fontWeight: 600, color: '#555870', textTransform: 'uppercase', margin: '8px 8px 12px', letterSpacing: 0.5 }}>
            Content For Review ({reviewItems.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {reviewItems.map((item) => {
              const isActive = selectedItem?.assignmentId === item.assignmentId;
              const isPending = item.status === 'PENDING';
              return (
                <button
                  key={item.assignmentId}
                  onClick={() => handleSelectItem(item)}
                  style={{
                    padding: '14px',
                    background: isActive ? 'rgba(139,92,246,0.12)' : 'transparent',
                    border: isActive ? '1px solid rgba(139,92,246,0.3)' : '1px solid transparent',
                    borderRadius: 10,
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    opacity: isPending ? 1 : 0.6,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? '#e2e4f0' : '#c4c7d9', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#555870', marginBottom: 4 }}>
                    by {item.author}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: '#555870' }}>{item.submittedAt}</span>
                    <span style={{
                      fontSize: 9,
                      padding: '2px 8px',
                      borderRadius: 8,
                      background: isPending ? 'rgba(251,191,36,0.15)' : 'rgba(16,185,129,0.15)',
                      color: isPending ? '#fbbf24' : '#10b981',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}>
                      {isPending ? 'PENDING' : 'REVIEWED'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content View Panel */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {loadingContent ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
              <Loader2 size={24} color="#a78bfa" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : (
            <div style={{
              maxWidth: 800,
              background: '#1a1d2e',
              borderRadius: 12,
              padding: 32,
            }}>
              {/* Content header */}
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: '#e2e4f0', margin: '0 0 8px' }}>
                  {selectedItem?.title}
                </h2>
                <div style={{
                  display: 'flex',
                  gap: 16,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                    }}>
                      {(selectedItem?.author || 'U')[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#c4c7d9' }}>
                        {selectedItem?.author}
                      </div>
                      {selectedItem?.authorEmail && (
                        <div style={{ fontSize: 10, color: '#555870' }}>
                          {selectedItem.authorEmail}
                        </div>
                      )}
                    </div>
                  </div>
                  <span style={{ color: 'rgba(255,255,255,0.15)' }}>•</span>
                  <span style={{ fontSize: 11, color: '#555870' }}>
                    Shared by {selectedItem?.requestedBy}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.15)' }}>•</span>
                  <span style={{ fontSize: 11, color: '#555870' }}>
                    {selectedItem?.submittedAt}
                  </span>
                </div>
              </div>

              <div style={{
                height: 1,
                background: 'rgba(255,255,255,0.06)',
                marginBottom: 24,
              }} />

              {/* Content body */}
              <pre style={{
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
                fontSize: 15,
                color: '#c4c7d9',
                lineHeight: 1.9,
                margin: 0,
                fontFamily: 'inherit',
              }}>{selectedItem?.contentBody || 'Loading content...'}</pre>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div style={{
          width: 380,
          background: 'rgba(255,255,255,0.02)',
          borderLeft: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}>
          {/* Review Decision */}
          <div style={{ padding: 20, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ fontSize: 12, fontWeight: 600, color: '#555870', textTransform: 'uppercase', marginBottom: 12 }}>
              Review Decision
            </h3>

            {isAlreadyDecided || decisionSuccess ? (
              <div style={{
                padding: 16,
                background: selectedItem?.verdict === 'DENIED'
                  ? 'rgba(239,68,68,0.1)'
                  : 'rgba(16,185,129,0.1)',
                borderRadius: 10,
                border: selectedItem?.verdict === 'DENIED'
                  ? '1px solid rgba(239,68,68,0.2)'
                  : '1px solid rgba(16,185,129,0.2)',
                textAlign: 'center',
              }}>
                {selectedItem?.verdict === 'DENIED' ? (
                  <XCircle size={24} color="#f87171" style={{ marginBottom: 8 }} />
                ) : (
                  <CheckCircle size={24} color="#10b981" style={{ marginBottom: 8 }} />
                )}
                <p style={{
                  fontSize: 13,
                  color: selectedItem?.verdict === 'DENIED' ? '#f87171' : '#10b981',
                  fontWeight: 600,
                  margin: '0 0 4px',
                }}>
                  {selectedItem?.verdict === 'APPROVED' ? 'Approved' : selectedItem?.verdict === 'DENIED' ? 'Denied' : 'Decision Submitted'}
                </p>

                {/* Review Request Status */}
                {selectedItem?.reviewRequestStatus && (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 12px',
                    borderRadius: 6,
                    background: selectedItem.reviewRequestStatus === 'CLOSED'
                      ? 'rgba(139,92,246,0.15)'
                      : 'rgba(251,191,36,0.15)',
                    marginBottom: 8,
                  }}>
                    <span style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: selectedItem.reviewRequestStatus === 'CLOSED' ? '#a78bfa' : '#fbbf24',
                    }} />
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: selectedItem.reviewRequestStatus === 'CLOSED' ? '#a78bfa' : '#fbbf24',
                    }}>
                      Review Request: {selectedItem.reviewRequestStatus}
                    </span>
                  </div>
                )}

                {/* Comment from reviewer */}
                {selectedItem?.savedComment && (
                  <div style={{
                    marginTop: 10,
                    padding: '10px 14px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: 8,
                    textAlign: 'left',
                    borderLeft: `3px solid ${selectedItem?.verdict === 'DENIED' ? '#f87171' : '#10b981'}`,
                  }}>
                    <span style={{ fontSize: 10, color: '#555870', textTransform: 'uppercase', fontWeight: 600 }}>Your Comment</span>
                    <p style={{ fontSize: 12, color: '#c4c7d9', margin: '6px 0 0', lineHeight: 1.5 }}>{selectedItem.savedComment}</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <button
                    onClick={() => { setDecision('APPROVED'); setDecisionError(null); }}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '10px 16px',
                      background: decision === 'APPROVED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.08)',
                      border: decision === 'APPROVED' ? '2px solid #10b981' : '2px solid rgba(16, 185, 129, 0.2)',
                      borderRadius: 8,
                      color: decision === 'APPROVED' ? '#10b981' : '#059669',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <CheckCircle size={16} /> Approve
                  </button>
                  <button
                    onClick={() => { setDecision('DENIED'); setDecisionError(null); }}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '10px 16px',
                      background: decision === 'DENIED' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.08)',
                      border: decision === 'DENIED' ? '2px solid #f87171' : '2px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: 8,
                      color: decision === 'DENIED' ? '#f87171' : '#dc2626',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <XCircle size={16} /> Deny
                  </button>
                </div>

                {decision && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, color: '#8b8fa8', display: 'block', marginBottom: 6 }}>
                      Reason for your decision <span style={{ color: '#f87171' }}>*</span>
                    </label>
                    <textarea
                      value={decisionComment}
                      onChange={(e) => { setDecisionComment(e.target.value); setDecisionError(null); }}
                      placeholder={decision === 'APPROVED'
                        ? 'Why are you approving this content...'
                        : 'What needs to be changed...'}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: 10,
                        background: 'rgba(255,255,255,0.05)',
                        border: decisionError
                          ? '1px solid rgba(248,113,113,0.5)'
                          : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8,
                        color: '#e2e4f0',
                        fontSize: 12,
                        resize: 'none',
                        boxSizing: 'border-box',
                        outline: 'none',
                      }}
                    />
                  </div>
                )}

                {decisionError && (
                  <div style={{
                    padding: '8px 12px',
                    background: 'rgba(248,113,113,0.1)',
                    borderRadius: 6,
                    marginBottom: 12,
                  }}>
                    <span style={{ fontSize: 11, color: '#f87171' }}>{decisionError}</span>
                  </div>
                )}

                {decision && (
                  <button
                    onClick={handleSubmitDecision}
                    disabled={submittingDecision}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '10px 16px',
                      background: submittingDecision
                        ? 'rgba(139,92,246,0.3)'
                        : decision === 'APPROVED'
                          ? 'linear-gradient(135deg, #10b981, #06b6d4)'
                          : 'linear-gradient(135deg, #ef4444, #f97316)',
                      border: 'none',
                      borderRadius: 8,
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: submittingDecision ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {submittingDecision ? (
                      <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Submitting...</>
                    ) : (
                      <><Send size={14} /> Submit {decision === 'APPROVED' ? 'Approval' : 'Denial'}</>
                    )}
                  </button>
                )}
              </>
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

          {/* Comments Thread */}
          <div style={{ padding: 20, flex: 1 }}>
            <h3 style={{ fontSize: 12, fontWeight: 600, color: '#555870', textTransform: 'uppercase', marginBottom: 12 }}>
              Comments ({comments.length})
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
              {comments.length === 0 && (
                <div style={{ padding: 16, textAlign: 'center', color: '#555870', fontSize: 12 }}>
                  No comments yet. Add a comment to discuss this content.
                </div>
              )}
            </div>

            <div>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment or feedback..."
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
