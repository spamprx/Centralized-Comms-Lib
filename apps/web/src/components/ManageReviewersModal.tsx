import { useState, useEffect } from 'react';
import { X, Search, UserPlus, Loader2, Check, Users, Send } from 'lucide-react';
import { adminUserService } from '../services/adminService';
import { contentService } from '../services/contentService';
import { reviewService } from '../services/reviewService';
import { useAuth } from '../context/AuthContext';

type SimpleUser = {
  id: string;
  displayName?: string;
  email: string;
};

interface ManageReviewersModalProps {
  contentId: string;
  contentTitle: string;
  onClose: () => void;
  onAssigned: () => void;
}

export default function ManageReviewersModal({
  contentId,
  contentTitle,
  onClose,
  onAssigned,
}: ManageReviewersModalProps) {
  const { user } = useAuth();
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [alreadyReviewerIds, setAlreadyReviewerIds] = useState<Set<string>>(new Set());
  const [reviewPolicyRequirement, setReviewPolicyRequirement] = useState<{
    requiredQuorum: number | null;
    isSatisfied: boolean | null;
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [usersRes, reqsRes, detailsRes] = await Promise.all([
          adminUserService.getUsers(),
          reviewService.listForContent(contentId).catch(() => []),
          contentService.getById(contentId).catch(() => null),
        ]);

        const rawUsers = usersRes.data as unknown as SimpleUser[];
        setUsers(rawUsers);

        if (detailsRes && typeof detailsRes === 'object' && 'reviewPolicy' in detailsRes) {
          const rp = (detailsRes as any).reviewPolicy as
            | { requiredQuorum: number | null; isSatisfied: boolean | null }
            | undefined;
          setReviewPolicyRequirement(
            rp
              ? {
                  requiredQuorum: typeof rp.requiredQuorum === 'number' ? rp.requiredQuorum : null,
                  isSatisfied: typeof rp.isSatisfied === 'boolean' ? rp.isSatisfied : null,
                }
              : null,
          );
        } else {
          setReviewPolicyRequirement(null);
        }

        // Find the active review request (OPEN) for this content and load current assignments.
        const openReq = (reqsRes as any[]).find((r) => (r?.status ?? '') === 'OPEN') ?? null;
        if (openReq?.id) {
          try {
            const detail = await reviewService.getRequestById(openReq.id);
            const ids = new Set<string>(
              (detail.assignments ?? []).map((a: any) => String(a.reviewerId)),
            );
            setAlreadyReviewerIds(ids);
          } catch {
            setAlreadyReviewerIds(new Set());
          }
        } else {
          setAlreadyReviewerIds(new Set());
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load users');
      } finally {
        setLoading(false);
      }
    })();
  }, [contentId]);

  const toggleUser = (userId: string) => {
    if (alreadyReviewerIds.has(userId)) return;
    if (user?.id && userId === user.id) {
      setError('You cannot add yourself as a reviewer.');
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const q = searchQuery.toLowerCase().trim();
  const filteredUsers = users
    .filter((u) => !(user?.id && u.id === user.id))
    .filter((u) => {
      if (!q) return true;
      return (u.displayName || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });

  const alreadyUsers = filteredUsers.filter((u) => alreadyReviewerIds.has(u.id));
  const availableUsers = filteredUsers.filter((u) => !alreadyReviewerIds.has(u.id));
  const requiredQuorum = reviewPolicyRequirement?.requiredQuorum ?? null;
  const selectionTooSmall = requiredQuorum != null && selectedIds.size > 0 && selectedIds.size < requiredQuorum;

  const handleSendForReview = async () => {
    // "Send for review" should transition content into an approvable/deniable state for all assigned reviewers.
    // It also assigns any newly selected reviewers to the active request.
    const totalAssignedCount = alreadyReviewerIds.size + selectedIds.size;
    if (totalAssignedCount === 0) {
      setError('Assign at least one reviewer before sending for review.');
      return;
    }
    if (user?.id && selectedIds.has(user.id)) {
      setError('You cannot add yourself as a reviewer.');
      return;
    }
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const contentDetails = await contentService.getById(contentId);
      const versions = contentDetails.versions;
      if (!versions || versions.length === 0) {
        setError('No content version found. Save the content first.');
        setSending(false);
        return;
      }
      const latestVersion = versions.reduce((prev, curr) =>
        curr.versionNumber > prev.versionNumber ? curr : prev,
      );

      // Important: don't increase consensus here — keep it stable and let policy enforce minimums.
      const reviewRequest = await reviewService.createRequest(contentId, latestVersion.id, 1);

      const selected = Array.from(selectedIds);
      if (selected.length > 0) {
        const results = await Promise.allSettled(
          selected.map((reviewerId) => reviewService.assignReviewer(reviewRequest.id, reviewerId)),
        );

        const already: string[] = [];
        const failed: string[] = [];
        results.forEach((r, idx) => {
          const reviewerId = selected[idx];
          const u = users.find((x) => x.id === reviewerId);
          const label = u?.displayName || u?.email || reviewerId;
          if (r.status === 'fulfilled') {
            const v = r.value as any;
            if (v && typeof v === 'object' && 'alreadyAssigned' in v && v.alreadyAssigned) {
              already.push(label);
            }
          } else {
            failed.push(label);
          }
        });

        if (already.length > 0) {
          setNotice(
            `${already.join(', ')} ${already.length === 1 ? 'is' : 'are'} already a reviewer. Others were still assigned.`,
          );
        }
        if (failed.length > 0) {
          setError(
            `Failed to assign: ${failed.join(', ')}. Other selected reviewers may still have been assigned.`,
          );
        }
      }

      setSendSuccess(true);
      setTimeout(() => {
        onAssigned();
        onClose();
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send for review');
    } finally {
      setSending(false);
    }
  };

  const handleAssign = async () => {
    if (selectedIds.size === 0) return;
    if (selectionTooSmall) {
      setError(`Review policy requires ${requiredQuorum} approvals. Select at least ${requiredQuorum} reviewers.`);
      return;
    }
    if (user?.id && selectedIds.has(user.id)) {
      setError('You cannot add yourself as a reviewer.');
      return;
    }
    setAssigning(true);
    setError(null);
    setNotice(null);
    try {
      const contentDetails = await contentService.getById(contentId);
      const versions = contentDetails.versions;
      if (!versions || versions.length === 0) {
        setError('No content version found. Save the content first.');
        setAssigning(false);
        return;
      }
      const latestVersion = versions.reduce((prev, curr) =>
        curr.versionNumber > prev.versionNumber ? curr : prev,
      );

      const reviewRequest = await reviewService.createRequest(
        contentId,
        latestVersion.id,
        selectedIds.size,
      );

      const selected = Array.from(selectedIds);
      const results = await Promise.allSettled(
        selected.map((reviewerId) => reviewService.assignReviewer(reviewRequest.id, reviewerId)),
      );

      const already: string[] = [];
      const failed: string[] = [];
      results.forEach((r, idx) => {
        const reviewerId = selected[idx];
        const u = users.find((x) => x.id === reviewerId);
        const label = u?.displayName || u?.email || reviewerId;
        if (r.status === 'fulfilled') {
          const v = r.value as any;
          if (v && typeof v === 'object' && 'alreadyAssigned' in v && v.alreadyAssigned) {
            already.push(label);
          }
        } else {
          failed.push(label);
        }
      });

      if (already.length > 0) {
        setNotice(
          `${already.join(', ')} ${already.length === 1 ? 'is' : 'are'} already a reviewer. Others were still assigned.`,
        );
      }
      if (failed.length > 0) {
        setError(
          `Failed to assign: ${failed.join(', ')}. Other selected reviewers may still have been assigned.`,
        );
      }

      setSuccess(true);
      setTimeout(() => {
        onAssigned();
        onClose();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign reviewers');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/10 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[80vh] w-full max-w-[480px] flex-col overflow-hidden rounded-app-xl border border-white/10 bg-app-bg/90 shadow-app-lift backdrop-blur-2xl supports-backdrop-filter:bg-app-bg/75"
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
                <Users size={18} strokeWidth={2} />
              </span>
              <h2 className="m-0 text-base font-semibold tracking-tight text-app-text">
                Manage Reviewers
              </h2>
            </div>
            <p className="m-0 max-w-[340px] truncate text-xs text-app-muted">{contentTitle}</p>
            {requiredQuorum != null ? (
              <div
                className={`mt-2 inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                  reviewPolicyRequirement?.isSatisfied
                    ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200'
                    : 'border-amber-400/25 bg-amber-500/10 text-amber-100'
                }`}
                title={
                  reviewPolicyRequirement?.isSatisfied
                    ? `Review policy satisfied (${requiredQuorum} approval(s) required)`
                    : `Review policy: ${requiredQuorum} approval(s) required before publishing`
                }
              >
                <span className="uppercase tracking-wide opacity-85">Policy</span>
                <span className="tabular-nums">
                  {reviewPolicyRequirement?.isSatisfied ? 'Met' : 'Needs'} {requiredQuorum}
                </span>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-app-md border border-transparent p-2 text-app-faint transition-colors hover:border-white/10 hover:bg-white/[0.06] hover:text-app-text"
            aria-label="Close"
            title="Close"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-white/[0.06] px-6 py-3">
          <div className="relative">
            <Search
              size={14}
              strokeWidth={2}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-app-accent/70"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="box-border w-full rounded-app-md border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-3 text-[13px] text-app-text shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none placeholder:text-app-faint focus:border-app-accent/40 focus:ring-2 focus:ring-app-accent/15"
            />
          </div>
        </div>

        {/* User List */}
        <div className="min-h-0 flex-1 overflow-y-auto scroll-smooth px-6 py-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={26} className="animate-spin text-app-accent" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-app-muted">No users found</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {alreadyUsers.length > 0 ? (
                <div className="mb-2">
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-app-faint">
                    Already assigned
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {alreadyUsers.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center gap-3 rounded-app-lg border border-white/[0.08] bg-white/[0.02] px-3.5 py-3 opacity-80"
                        title="Already a reviewer"
                      >
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-emerald-400/40 bg-emerald-500/10 text-emerald-200">
                          <Check size={12} strokeWidth={3} />
                        </div>
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/40 to-app-accent-2/25 text-sm font-semibold text-white shadow-inner">
                          {(u.displayName || u.email)[0].toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <div className="truncate text-[13px] font-medium text-app-muted">
                            {u.displayName || 'No name'}
                          </div>
                          <div className="truncate text-[11px] text-app-faint">{u.email}</div>
                        </div>
                        <span className="shrink-0 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                          assigned
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mb-2 mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-app-faint">
                Available users
              </div>
              {availableUsers.length === 0 ? (
                <div className="py-6 text-center text-[12px] text-app-muted">
                  No additional users match your search.
                </div>
              ) : (
                availableUsers.map((user) => {
                  const isSelected = selectedIds.has(user.id);
                  return (
                    <button
                      type="button"
                      key={user.id}
                      onClick={() => toggleUser(user.id)}
                      className={`flex cursor-pointer items-center gap-3 rounded-app-lg border px-3.5 py-3 text-left transition-[border-color,background-color] duration-150 ${
                        isSelected
                          ? 'border-app-accent/40 bg-app-accent/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                          : 'border-white/[0.08] bg-white/[0.02] hover:border-white/14 hover:bg-white/[0.04]'
                      }`}
                    >
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                          isSelected
                            ? 'border-app-accent bg-app-accent text-app-bg'
                            : 'border-white/20 bg-transparent'
                        }`}
                      >
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </div>

                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white shadow-inner ${
                          isSelected
                            ? 'bg-gradient-to-br from-app-accent to-app-accent-2'
                            : 'bg-gradient-to-br from-white/10 to-white/[0.03]'
                        }`}
                      >
                        {(user.displayName || user.email)[0].toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div
                          className={`truncate text-[13px] font-medium ${isSelected ? 'text-app-text' : 'text-app-muted'}`}
                        >
                          {user.displayName || 'No name'}
                        </div>
                        <div className="truncate text-[11px] text-app-faint">{user.email}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-white/[0.08] px-6 py-4">
          <div className="text-[11px] font-medium tabular-nums text-app-faint">
            <div>
              {selectedIds.size} reviewer{selectedIds.size !== 1 ? 's' : ''} selected
            </div>
            {selectionTooSmall ? (
              <div className="mt-1 text-amber-200/90">
                Policy requires <strong>{requiredQuorum}</strong>. Select{' '}
                <strong>{requiredQuorum - selectedIds.size}</strong> more.
              </div>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSendForReview}
              disabled={assigning || sending || success || sendSuccess}
              className={`flex items-center gap-1.5 rounded-app-md border border-white/12 px-4 py-2.5 text-[13px] font-semibold transition-[filter,opacity] ${
                sendSuccess
                  ? 'cursor-not-allowed bg-emerald-500/15 text-emerald-100 opacity-95'
                  : sending
                    ? 'cursor-not-allowed bg-app-accent/15 text-app-text opacity-70'
                    : 'cursor-pointer bg-white/[0.04] text-app-text hover:bg-white/[0.07]'
              }`}
              title="Moves content back into review so assigned reviewers can approve/deny"
            >
              {sending ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Sending…
                </>
              ) : sendSuccess ? (
                <>
                  <Check size={14} strokeWidth={2.5} /> Sent
                </>
              ) : (
                <>
                  <Send size={14} strokeWidth={2} /> Send for review
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-app-md border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[13px] font-medium text-app-muted transition-colors hover:bg-white/[0.07]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAssign}
              disabled={selectedIds.size === 0 || assigning || success || selectionTooSmall}
              className={`flex items-center gap-1.5 rounded-app-md border border-white/12 px-5 py-2.5 text-[13px] font-semibold text-app-bg shadow-[0_0_22px_-8px_rgba(147,124,248,0.45)] ring-1 ring-white/10 transition-[filter,opacity] ${
                success
                  ? 'cursor-not-allowed bg-gradient-to-r from-emerald-500 to-app-accent-2 opacity-95'
                  : selectedIds.size === 0
                    ? 'cursor-not-allowed bg-app-accent/25 opacity-50'
                    : 'cursor-pointer bg-gradient-to-r from-app-accent to-app-accent-2 hover:brightness-105'
              }`}
            >
              {assigning ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Assigning...
                </>
              ) : success ? (
                <>
                  <Check size={14} strokeWidth={2.5} /> Assigned!
                </>
              ) : (
                <>
                  <UserPlus size={14} strokeWidth={2} /> Assign Reviewers
                </>
              )}
            </button>
          </div>
        </div>

        {notice && (
          <div className="border-t border-amber-400/25 bg-amber-500/10 px-6 py-2.5 text-center text-xs text-amber-200">
            {notice}
          </div>
        )}
        {error && (
          <div className="border-t border-red-400/25 bg-red-500/10 px-6 py-2.5 text-center text-xs text-red-300">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
