import { useState, useEffect } from 'react';
import { X, Search, UserPlus, Loader2, Check, Users } from 'lucide-react';
import { adminUserService } from '../services/adminService';
import { contentService } from '../services/contentService';
import { reviewService } from '../services/reviewService';

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
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await adminUserService.getUsers();
        const rawUsers = res.data as unknown as SimpleUser[];
        setUsers(rawUsers);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load users');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleUser = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (u.displayName || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const handleAssign = async () => {
    if (selectedIds.size === 0) return;
    setAssigning(true);
    setError(null);
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

      const assignPromises = Array.from(selectedIds).map((reviewerId) =>
        reviewService.assignReviewer(reviewRequest.id, reviewerId),
      );
      await Promise.all(assignPromises);

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
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 p-4 backdrop-blur-md"
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
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-app-md border border-transparent p-2 text-app-faint transition-colors hover:border-white/10 hover:bg-white/[0.06] hover:text-app-text"
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
              {filteredUsers.map((user) => {
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
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-white/[0.08] px-6 py-4">
          <span className="text-[11px] font-medium tabular-nums text-app-faint">
            {selectedIds.size} reviewer{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
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
              disabled={selectedIds.size === 0 || assigning || success}
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

        {error && (
          <div className="border-t border-red-400/25 bg-red-500/10 px-6 py-2.5 text-center text-xs text-red-300">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
