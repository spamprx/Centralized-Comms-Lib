import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Group } from '../../types/admin';

interface GroupModalProps {
  group?: Group | null;
  users: { id: string; name: string; email: string }[];
  roles: { id: string; name: string }[];
  onClose: () => void;
  onSave: (data: Omit<Group, 'id' | 'createdAt'>) => Promise<void>;
}

export default function GroupModal({ group, users, roles, onClose, onSave }: GroupModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    members: [] as string[],
    roles: [] as string[],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (group) {
      setFormData({
        name: group.name,
        description: group.description,
        members: group.members,
        roles: group.roles,
      });
    }
  }, [group]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save group');
    } finally {
      setLoading(false);
    }
  };

  const toggleMember = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      members: prev.members.includes(userId)
        ? prev.members.filter(id => id !== userId)
        : [...prev.members, userId],
    }));
  };

  const toggleRole = (roleId: string) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(roleId)
        ? prev.roles.filter(id => id !== roleId)
        : [...prev.roles, roleId],
    }));
  };

  return (
    <div className="group-modal-overlay" onClick={onClose}>
      <div className="group-modal" onClick={e => e.stopPropagation()}>
        <div className="group-modal-header">
          <h2>{group ? 'Edit Group' : 'Create Group'}</h2>
          <button className="group-modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="group-modal-form">
          {error && <div className="group-modal-error">{error}</div>}

          <div className="group-modal-field">
            <label>Group Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Engineering Team"
              required
            />
          </div>

          <div className="group-modal-field">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the group's purpose..."
              rows={3}
              required
            />
          </div>

          <div className="group-modal-field">
            <label>Members</label>
            <div className="group-modal-members">
              {users.length === 0 ? (
                <span className="group-modal-no-items">No users available</span>
              ) : (
                users.map(user => (
                  <label key={user.id} className="group-modal-checkbox">
                    <input
                      type="checkbox"
                      checked={formData.members.includes(user.id)}
                      onChange={() => toggleMember(user.id)}
                    />
                    <div className="group-modal-user-info">
                      <span className="group-modal-user-name">{user.name}</span>
                      <span className="group-modal-user-email">{user.email}</span>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="group-modal-field">
            <label>Group Roles</label>
            <div className="group-modal-roles">
              {roles.length === 0 ? (
                <span className="group-modal-no-items">No roles available</span>
              ) : (
                roles.map(role => (
                  <label key={role.id} className="group-modal-checkbox">
                    <input
                      type="checkbox"
                      checked={formData.roles.includes(role.id)}
                      onChange={() => toggleRole(role.id)}
                    />
                    <span>{role.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="group-modal-actions">
            <button type="button" className="group-modal-btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="group-modal-btn-save" disabled={loading}>
              {loading ? 'Saving...' : (group ? 'Update Group' : 'Create Group')}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .group-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }
        .group-modal {
          background: #1a1d29;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          width: 100%;
          max-width: 520px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        }
        .group-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .group-modal-header h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #e2e4f0;
        }
        .group-modal-close {
          background: none;
          border: none;
          color: #555870;
          cursor: pointer;
          padding: 4px;
          display: flex;
          border-radius: 4px;
        }
        .group-modal-close:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #e2e4f0;
        }
        .group-modal-form {
          padding: 24px;
        }
        .group-modal-error {
          background: rgba(248, 113, 113, 0.1);
          border: 1px solid rgba(248, 113, 113, 0.3);
          border-radius: 8px;
          padding: 12px;
          color: #f87171;
          font-size: 13px;
          margin-bottom: 16px;
        }
        .group-modal-field {
          margin-bottom: 20px;
        }
        .group-modal-field label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #c4c7d9;
          margin-bottom: 8px;
        }
        .group-modal-field input[type="text"],
        .group-modal-field textarea {
          width: 100%;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #e2e4f0;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s;
          resize: vertical;
        }
        .group-modal-field input:focus,
        .group-modal-field textarea:focus {
          border-color: rgba(167, 139, 250, 0.5);
        }
        .group-modal-members,
        .group-modal-roles {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          max-height: 180px;
          overflow-y: auto;
        }
        .group-modal-no-items {
          font-size: 12px;
          color: #555870;
        }
        .group-modal-checkbox {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: #c4c7d9;
          cursor: pointer;
          padding: 6px 8px;
          border-radius: 6px;
          transition: background 0.15s;
        }
        .group-modal-checkbox:hover {
          background: rgba(255, 255, 255, 0.05);
        }
        .group-modal-checkbox input {
          accent-color: #a78bfa;
          cursor: pointer;
          width: 16px;
          height: 16px;
        }
        .group-modal-user-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .group-modal-user-name {
          font-weight: 500;
          color: #e2e4f0;
        }
        .group-modal-user-email {
          font-size: 11px;
          color: #555870;
        }
        .group-modal-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }
        .group-modal-btn-cancel {
          padding: 10px 20px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #9094ae;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .group-modal-btn-cancel:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #e2e4f0;
        }
        .group-modal-btn-save {
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
        .group-modal-btn-save:hover:not(:disabled) {
          background: rgba(167, 139, 250, 0.25);
        }
        .group-modal-btn-save:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
