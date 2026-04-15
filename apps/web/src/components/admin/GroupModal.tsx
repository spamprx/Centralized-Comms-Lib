import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Group } from '../../types/admin';
import { isAdminActionCancelled } from './adminActionCancelled';

interface GroupModalProps {
  group?: Group | null;
  users: { id: string; name: string; email: string }[];
  roles: { id: string; name: string }[];
  onClose: () => void;
  onSave: (data: Omit<Group, 'id' | 'createdAt'>) => Promise<void>;
}

const inputClass =
  'w-full resize-y rounded-app-lg border border-white/[0.1] bg-white/[0.04] px-3 py-3 text-[13px] text-app-text shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none backdrop-blur-sm transition-[border-color,box-shadow] duration-200 placeholder-transparent focus:border-app-accent/45 focus:ring-2 focus:ring-app-accent/12';

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
        members: [...group.members],
        roles: [...group.roles],
      });
    } else {
      setFormData({ name: '', description: '', members: [], roles: [] });
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
      if (isAdminActionCancelled(err)) return;
      setError(err instanceof Error ? err.message : 'Failed to save group');
    } finally {
      setLoading(false);
    }
  };

  const toggleMember = (userId: string) => {
    setFormData((prev) => ({
      ...prev,
      members: prev.members.includes(userId)
        ? prev.members.filter((id) => id !== userId)
        : [...prev.members, userId],
    }));
  };

  const toggleRole = (roleId: string) => {
    setFormData((prev) => ({
      ...prev,
      roles: prev.roles.includes(roleId)
        ? prev.roles.filter((id) => id !== roleId)
        : [...prev.roles, roleId],
    }));
  };

  return (
    <div
      className="admin-modal-backdrop fixed inset-0 z-[1100] flex items-center justify-center bg-black/75 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="admin-modal-enter admin-modal-panel max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-app-xl shadow-app-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-5">
          <h2 className="m-0 text-lg font-semibold text-app-text">
            {group ? 'Edit Group' : 'Create Group'}
          </h2>
          <button
            className="bg-transparent border-none text-app-faint cursor-pointer p-1.5 flex rounded-lg hover:bg-app-surface-hover hover:text-app-text transition-colors"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="bg-red-400/10 border border-red-400/25 rounded-xl p-3 text-red-400 text-[13px] mb-4">
              {error}
            </div>
          )}

          <div className="mb-5 admin-float-field">
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder=" "
              required
              className={inputClass}
            />
            <label>Group Name</label>
          </div>

          <div className="mb-5 admin-float-field">
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder=" "
              rows={3}
              required
              className={inputClass}
            />
            <label>Description</label>
          </div>

          <div className="mb-5">
            <label className="block text-[13px] font-medium text-app-muted mb-2">Members</label>
            <div className="admin-glass max-h-[180px] overflow-y-auto rounded-app-lg p-2 ring-1 ring-white/[0.05]">
              {users.length === 0 ? (
                <span className="text-xs text-app-faint px-2 py-2">No users available</span>
              ) : (
                users.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-2.5 text-[13px] text-app-muted cursor-pointer px-2.5 py-2 rounded-lg transition-colors duration-150 hover:bg-app-surface-hover"
                  >
                    <input
                      type="checkbox"
                      checked={formData.members.includes(user.id)}
                      onChange={() => toggleMember(user.id)}
                      className="accent-app-accent cursor-pointer w-4 h-4"
                    />
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-app-text text-[13px]">{user.name}</span>
                      <span className="text-[11px] text-app-faint">{user.email}</span>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-[13px] font-medium text-app-muted mb-2">Group Roles</label>
            <div className="admin-glass max-h-[180px] overflow-y-auto rounded-app-lg p-2 ring-1 ring-white/[0.05]">
              {roles.length === 0 ? (
                <span className="text-xs text-app-faint px-2 py-2">No roles available</span>
              ) : (
                roles.map((role) => (
                  <label
                    key={role.id}
                    className="flex items-center gap-2.5 text-[13px] text-app-muted cursor-pointer px-2.5 py-2 rounded-lg transition-colors duration-150 hover:bg-app-surface-hover"
                  >
                    <input
                      type="checkbox"
                      checked={formData.roles.includes(role.id)}
                      onChange={() => toggleRole(role.id)}
                      className="accent-app-accent cursor-pointer w-4 h-4"
                    />
                    <span>{role.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-white/[0.08] pt-5">
            <button
              type="button"
              className="admin-glass-button rounded-app-lg px-5 py-2.5 text-[13px] font-semibold text-app-muted"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="admin-btn-lift cursor-pointer rounded-app-lg border border-app-accent/35 bg-gradient-to-br from-app-accent-muted to-app-accent-muted/50 px-5 py-2.5 text-[13px] font-semibold text-app-accent shadow-[0_0_24px_-8px_rgba(147,124,248,0.4)] transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Saving...' : group ? 'Update Group' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
