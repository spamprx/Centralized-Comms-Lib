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
    return (
      (u.displayName || '').toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  const handleAssign = async () => {
    if (selectedIds.size === 0) return;
    setAssigning(true);
    setError(null);
    try {
      // 1. Get content details to find the latest version ID
      const contentDetails = await contentService.getById(contentId);
      const versions = contentDetails.versions;
      if (!versions || versions.length === 0) {
        setError('No content version found. Save the content first.');
        setAssigning(false);
        return;
      }
      // Use the latest version (highest versionNumber)
      const latestVersion = versions.reduce((prev, curr) =>
        curr.versionNumber > prev.versionNumber ? curr : prev
      );

      // 2. Create a review request
      const reviewRequest = await reviewService.createRequest(
        contentId,
        latestVersion.id,
        selectedIds.size,
      );

      // 3. Assign each selected reviewer
      const assignPromises = Array.from(selectedIds).map((reviewerId) =>
        reviewService.assignReviewer(reviewRequest.id, reviewerId)
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
          width: 480,
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
              <Users size={18} color="#a78bfa" />
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#e2e4f0', margin: 0 }}>
                Manage Reviewers
              </h2>
            </div>
            <p style={{ fontSize: 12, color: '#555870', margin: 0, maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

        {/* Search */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={14}
              color="#555870"
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              style={{
                width: '100%',
                padding: '10px 12px 10px 36px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                color: '#e2e4f0',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* User List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <Loader2 size={24} color="#a78bfa" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#555870', fontSize: 13 }}>
              No users found
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filteredUsers.map((user) => {
                const isSelected = selectedIds.has(user.id);
                return (
                  <button
                    key={user.id}
                    onClick={() => toggleUser(user.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 14px',
                      background: isSelected
                        ? 'rgba(139, 92, 246, 0.12)'
                        : 'rgba(255,255,255,0.02)',
                      border: isSelected
                        ? '1px solid rgba(139, 92, 246, 0.3)'
                        : '1px solid rgba(255,255,255,0.05)',
                      borderRadius: 10,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {/* Checkbox */}
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        border: isSelected
                          ? '2px solid #a78bfa'
                          : '2px solid rgba(255,255,255,0.2)',
                        background: isSelected ? '#8b5cf6' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {isSelected && <Check size={12} color="#fff" strokeWidth={3} />}
                    </div>

                    {/* Avatar */}
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: `linear-gradient(135deg, ${isSelected ? '#8b5cf6' : '#374151'}, ${isSelected ? '#06b6d4' : '#4b5563'})`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: 14,
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {(user.displayName || user.email)[0].toUpperCase()}
                    </div>

                    {/* User Info */}
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: isSelected ? '#e2e4f0' : '#c4c7d9',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {user.displayName || 'No name'}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: '#555870',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
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
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid rgba(255,255,255,0.07)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 12, color: '#555870' }}>
            {selectedIds.size} reviewer{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 18px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                color: '#8b8fa8',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleAssign}
              disabled={selectedIds.size === 0 || assigning || success}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 20px',
                background: success
                  ? 'linear-gradient(135deg, #10b981, #06b6d4)'
                  : selectedIds.size === 0
                    ? 'rgba(139, 92, 246, 0.3)'
                    : 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: selectedIds.size === 0 || assigning || success ? 'not-allowed' : 'pointer',
                opacity: selectedIds.size === 0 ? 0.5 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              {assigning ? (
                <>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  Assigning...
                </>
              ) : success ? (
                <>
                  <Check size={14} />
                  Assigned!
                </>
              ) : (
                <>
                  <UserPlus size={14} />
                  Assign Reviewers
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div
            style={{
              padding: '10px 24px',
              background: 'rgba(248, 113, 113, 0.1)',
              borderTop: '1px solid rgba(248, 113, 113, 0.2)',
              color: '#f87171',
              fontSize: 12,
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
