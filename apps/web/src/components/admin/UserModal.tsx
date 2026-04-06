import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { User, UserRole, UserStatus } from '../../types/admin';

interface UserModalProps {
  user?: User | null;
  groups: { id: string; name: string }[];
  onClose: () => void;
  onSave: (data: Omit<User, 'id' | 'createdAt' | 'lastActive'>) => Promise<void>;
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'moderator', label: 'Moderator' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
];

const STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'pending', label: 'Pending' },
];

export default function UserModal({ user, groups, onClose, onSave }: UserModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'viewer' as UserRole,
    status: 'pending' as UserStatus,
    groups: [] as string[],
    avatar: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        groups: user.groups,
        avatar: user.avatar || '',
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupId: string) => {
    setFormData(prev => ({
      ...prev,
      groups: prev.groups.includes(groupId)
        ? prev.groups.filter(g => g !== groupId)
        : [...prev.groups, groupId],
    }));
  };

  return (
    <div className="user-modal-overlay" onClick={onClose}>
      <div className="user-modal" onClick={e => e.stopPropagation()}>
        <div className="user-modal-header">
          <h2>{user ? 'Edit User' : 'Invite User'}</h2>
          <button className="user-modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="user-modal-form">
          {error && <div className="user-modal-error">{error}</div>}

          <div className="user-modal-field">
            <label>Full Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter full name"
              required
            />
          </div>

          <div className="user-modal-field">
            <label>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              placeholder="Enter email address"
              required
            />
          </div>

          <div className="user-modal-field">
            <label>Role</label>
            <select
              value={formData.role}
              onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
            >
              {ROLE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="user-modal-field">
            <label>Status</label>
            <select
              value={formData.status}
              onChange={e => setFormData({ ...formData, status: e.target.value as UserStatus })}
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="user-modal-field">
            <label>Groups</label>
            <div className="user-modal-groups">
              {groups.length === 0 ? (
                <span className="user-modal-no-groups">No groups available</span>
              ) : (
                groups.map(group => (
                  <label key={group.id} className="user-modal-group-checkbox">
                    <input
                      type="checkbox"
                      checked={formData.groups.includes(group.name)}
                      onChange={() => toggleGroup(group.name)}
                    />
                    <span>{group.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="user-modal-actions">
            <button type="button" className="user-modal-btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="user-modal-btn-save" disabled={loading}>
              {loading ? 'Saving...' : (user ? 'Update User' : 'Invite User')}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .user-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }
        .user-modal {
          background: #1a1d29;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          width: 100%;
          max-width: 480px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        }
        .user-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .user-modal-header h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #e2e4f0;
        }
        .user-modal-close {
          background: none;
          border: none;
          color: #555870;
          cursor: pointer;
          padding: 4px;
          display: flex;
          border-radius: 4px;
        }
        .user-modal-close:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #e2e4f0;
        }
        .user-modal-form {
          padding: 24px;
        }
        .user-modal-error {
          background: rgba(248, 113, 113, 0.1);
          border: 1px solid rgba(248, 113, 113, 0.3);
          border-radius: 8px;
          padding: 12px;
          color: #f87171;
          font-size: 13px;
          margin-bottom: 16px;
        }
        .user-modal-field {
          margin-bottom: 16px;
        }
        .user-modal-field label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #c4c7d9;
          margin-bottom: 6px;
        }
        .user-modal-field input[type="text"],
        .user-modal-field input[type="email"],
        .user-modal-field select {
          width: 100%;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #e2e4f0;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s;
        }
        .user-modal-field input:focus,
        .user-modal-field select:focus {
          border-color: rgba(167, 139, 250, 0.5);
        }
        .user-modal-field select {
          cursor: pointer;
        }
        .user-modal-groups {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          max-height: 150px;
          overflow-y: auto;
        }
        .user-modal-no-groups {
          font-size: 12px;
          color: #555870;
        }
        .user-modal-group-checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #c4c7d9;
          cursor: pointer;
        }
        .user-modal-group-checkbox input {
          accent-color: #a78bfa;
          cursor: pointer;
        }
        .user-modal-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }
        .user-modal-btn-cancel {
          padding: 10px 20px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #9094ae;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .user-modal-btn-cancel:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #e2e4f0;
        }
        .user-modal-btn-save {
          padding: 10px 20px;
          background: rgba(167, 139, 250, 0.15);
          border: 1px solid rgba(167, 139, 250, 0.3);
          border-radius: 8px;
          color: #a78bfa;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }
        .user-modal-btn-save:hover:not(:disabled) {
          background: rgba(167, 139, 250, 0.25);
        }
        .user-modal-btn-save:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
