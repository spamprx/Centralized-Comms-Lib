import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { User } from '../../types/admin';
import type { UserFormPayload } from '../../hooks/useAdmin';
import { isAdminActionCancelled } from './adminActionCancelled';

interface UserModalProps {
  user?: User | null;
  groups: { id: string; name: string }[];
  roles: { id: string; name: string }[];
  onClose: () => void;
  onSave: (data: UserFormPayload) => Promise<void>;
}

const inputClass =
  'w-full rounded-app-lg border border-white/[0.1] bg-white/[0.04] px-3 py-3 text-[13px] text-app-text shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none backdrop-blur-sm transition-[border-color,box-shadow] duration-200 placeholder-transparent focus:border-app-accent/45 focus:ring-2 focus:ring-app-accent/12';

export default function UserModal({ user, groups, roles, onClose, onSave }: UserModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    roleId: '',
    groups: [] as string[],
    avatar: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        roleId: user.primaryRoleId ?? '',
        groups: [...user.groups],
        avatar: user.avatar || '',
        password: '',
      });
    } else {
      setFormData({
        name: '',
        email: '',
        roleId: roles[0]?.id ?? '',
        groups: [],
        avatar: '',
        password: '',
      });
    }
  }, [user, roles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSave({
        name: formData.name,
        email: formData.email,
        roleId: formData.roleId,
        groups: formData.groups,
        avatar: formData.avatar || undefined,
        ...(!user ? { password: formData.password } : {}),
      });
      onClose();
    } catch (err) {
      if (isAdminActionCancelled(err)) return;
      setError(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupId: string) => {
    setFormData((prev) => ({
      ...prev,
      groups: prev.groups.includes(groupId)
        ? prev.groups.filter((g) => g !== groupId)
        : [...prev.groups, groupId],
    }));
  };

  return (
    <div
      className="admin-modal-backdrop fixed inset-0 z-[1200] flex items-center justify-center bg-black/75 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="admin-modal-enter admin-modal-panel max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-app-xl shadow-app-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-5">
          <h2 className="m-0 text-lg font-semibold text-app-text">
            {user ? 'Edit User' : 'Invite User'}
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
            <label>Full Name</label>
          </div>

          <div className="mb-5 admin-float-field">
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder=" "
              required
              className={inputClass}
            />
            <label>Email</label>
          </div>

          {!user && (
            <div className="mb-5 admin-float-field">
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder=" "
                required
                minLength={8}
                className={inputClass}
              />
              <label>Initial password</label>
            </div>
          )}

          <div className="mb-5">
            <label className="block text-[13px] font-medium text-app-muted mb-2">Role</label>
            <select
              value={formData.roleId}
              onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
              className={`${inputClass} cursor-pointer`}
              required
            >
              {roles.length === 0 ? (
                <option value="">No roles defined</option>
              ) : (
                roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="mb-5">
            <label className="block text-[13px] font-medium text-app-muted mb-2">Groups</label>
            <div className="admin-glass max-h-[150px] overflow-y-auto rounded-app-lg p-3 ring-1 ring-white/[0.05]">
              {groups.length === 0 ? (
                <span className="text-xs text-app-faint">No groups available</span>
              ) : (
                groups.map((group) => (
                  <label
                    key={group.id}
                    className="flex items-center gap-2.5 text-[13px] text-app-muted cursor-pointer px-2 py-1.5 rounded-lg transition-colors duration-150 hover:bg-app-surface-hover"
                  >
                    <input
                      type="checkbox"
                      checked={formData.groups.includes(group.id)}
                      onChange={() => toggleGroup(group.id)}
                      className="accent-app-accent cursor-pointer w-4 h-4"
                    />
                    <span>{group.name}</span>
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
              className="admin-btn-lift cursor-pointer rounded-app-lg border border-app-accent/35 bg-gradient-to-br from-app-accent-muted to-app-accent-muted/50 px-5 py-2.5 text-[13px] font-semibold text-app-accent shadow-[0_0_24px_-8px_rgba(147,124,248,0.45)] transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading || (!user && !formData.password.trim())}
            >
              {loading ? 'Saving...' : user ? 'Update User' : 'Invite User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
