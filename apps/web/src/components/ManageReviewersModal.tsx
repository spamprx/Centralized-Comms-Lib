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
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[480px] max-h-[80vh] bg-[#1a1d2e] border border-app-border rounded-2xl flex flex-col overflow-hidden shadow-[0_24px_48px_rgba(0,0,0,0.4)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-app-border flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users size={18} color="#a78bfa" />
              <h2 className="text-base font-bold text-app-text m-0">Manage Reviewers</h2>
            </div>
            <p className="text-xs text-app-faint m-0 max-w-[350px] overflow-hidden text-ellipsis whitespace-nowrap">
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

        {/* Search */}
        <div className="px-6 py-3 border-b border-app-border/80">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-faint" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="w-full py-2.5 pr-3 pl-9 bg-app-surface border border-app-border rounded-lg text-app-text text-[13px] outline-none box-border"
            />
          </div>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto px-6 py-2">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 size={24} color="#a78bfa" className="animate-spin" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-app-faint text-[13px]">No users found</div>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredUsers.map((user) => {
                const isSelected = selectedIds.has(user.id);
                return (
                  <button
                    key={user.id}
                    onClick={() => toggleUser(user.id)}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-app-lg cursor-pointer text-left transition-all duration-150 ${
                      isSelected
                        ? 'bg-violet-500/[0.12] border border-violet-500/30'
                        : 'bg-app-bg/60 border border-app-border/80'
                    }`}
                  >
                    {/* Checkbox */}
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all duration-150 ${
                        isSelected
                          ? 'bg-violet-500 border-2 border-violet-400'
                          : 'bg-transparent border-2 border-white/20'
                      }`}
                    >
                      {isSelected && <Check size={12} color="#fff" strokeWidth={3} />}
                    </div>

                    {/* Avatar */}
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0 ${
                        isSelected
                          ? 'bg-gradient-to-br from-violet-500 to-cyan-500'
                          : 'bg-gradient-to-br from-app-bg-subtle to-app-surface'
                      }`}
                    >
                      {(user.displayName || user.email)[0].toUpperCase()}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 overflow-hidden">
                      <div
                        className={`text-[13px] font-medium overflow-hidden text-ellipsis whitespace-nowrap ${isSelected ? 'text-app-text' : 'text-app-muted'}`}
                      >
                        {user.displayName || 'No name'}
                      </div>
                      <div className="text-[11px] text-app-faint overflow-hidden text-ellipsis whitespace-nowrap">
                        {user.email}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-app-border flex justify-between items-center">
          <span className="text-xs text-app-faint">
            {selectedIds.size} reviewer{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-[18px] py-2.5 bg-app-surface border border-app-border rounded-lg text-app-muted text-[13px] cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleAssign}
              disabled={selectedIds.size === 0 || assigning || success}
              className={`flex items-center gap-1.5 px-5 py-2.5 border-none rounded-lg text-white text-[13px] font-semibold transition-all duration-200 ${
                success
                  ? 'bg-gradient-to-br from-emerald-500 to-cyan-500 cursor-not-allowed'
                  : selectedIds.size === 0
                    ? 'bg-violet-500/30 cursor-not-allowed opacity-50'
                    : 'bg-gradient-to-br from-violet-500 to-cyan-500 cursor-pointer'
              }`}
            >
              {assigning ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Assigning...
                </>
              ) : success ? (
                <>
                  <Check size={14} /> Assigned!
                </>
              ) : (
                <>
                  <UserPlus size={14} /> Assign Reviewers
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="px-6 py-2.5 bg-red-400/10 border-t border-red-400/20 text-red-400 text-xs text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
