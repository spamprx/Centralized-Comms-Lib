import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Role, Permission } from '../../types/admin';
import { isAdminActionCancelled } from './adminActionCancelled';

interface RoleModalProps {
  role?: Role | null;
  onClose: () => void;
  onSave: (data: Omit<Role, 'id' | 'userCount' | 'createdAt' | 'isSystem'>) => Promise<void>;
}

const RESOURCES = ['users', 'roles', 'content', 'reports', 'settings', 'analytics', 'groups'];
const ACTIONS = ['create', 'read', 'update', 'delete', 'manage'] as const;

const inputClass =
  'w-full px-3 py-3 bg-app-surface border border-app-border rounded-xl text-app-text text-[13px] outline-none transition-all duration-200 focus:border-app-accent/40 focus:shadow-[0_0_0_3px_rgba(147,124,248,0.06)] resize-y placeholder-transparent';

const emptyForm = { name: '', description: '', permissions: [] as Permission[] };

export default function RoleModal({ role, onClose, onSave }: RoleModalProps) {
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (role) {
      setFormData({
        name: role.name,
        description: role.description,
        permissions: role.permissions.map((p) => ({ ...p })),
      });
    } else {
      setFormData({ ...emptyForm, permissions: [] });
    }
  }, [role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      if (isAdminActionCancelled(err)) return;
      setError(err instanceof Error ? err.message : 'Failed to save role');
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (resource: string, action: (typeof ACTIONS)[number]) => {
    setFormData((prev) => {
      const exists = prev.permissions.find((p) => p.resource === resource && p.action === action);
      if (exists) {
        return {
          ...prev,
          permissions: prev.permissions.filter(
            (p) => !(p.resource === resource && p.action === action),
          ),
        };
      }
      return {
        ...prev,
        permissions: [...prev.permissions, { id: `${resource}-${action}`, resource, action }],
      };
    });
  };

  const hasPermission = (resource: string, action: (typeof ACTIONS)[number]) => {
    return formData.permissions.some((p) => p.resource === resource && p.action === action);
  };

  const isSystem = Boolean(role?.isSystem);

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 backdrop-blur-sm admin-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="admin-glass admin-modal-enter max-h-[90vh] w-full max-w-[600px] overflow-y-auto rounded-2xl shadow-app-soft"
        style={{ background: 'rgba(15, 20, 32, 0.92)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-5">
          <h2 className="m-0 text-lg font-semibold text-app-text">
            {role ? 'Edit Role' : 'Create Role'}
          </h2>
          <button
            type="button"
            className="flex cursor-pointer rounded-lg border-none bg-transparent p-1.5 text-app-faint transition-colors hover:bg-app-surface-hover hover:text-app-text"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {isSystem ? (
            <p className="mb-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[12px] text-amber-200/95">
              This is a system role. The name cannot be changed; you can still adjust description
              and permissions.
            </p>
          ) : null}
          {error ? (
            <div className="mb-4 rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-[13px] text-red-400">
              {error}
            </div>
          ) : null}

          <div className="admin-float-field mb-5">
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder=" "
              required
              readOnly={isSystem}
              disabled={isSystem}
              className={`${inputClass} ${isSystem ? 'cursor-not-allowed opacity-70' : ''}`}
            />
            <label>Role Name</label>
          </div>

          <div className="admin-float-field mb-5">
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
            <label className="mb-2 block text-[13px] font-medium text-app-muted">Permissions</label>
            <div className="admin-glass overflow-hidden rounded-xl">
              <div className="grid grid-cols-[120px_repeat(5,1fr)] gap-px border-b border-white/[0.04] px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-app-faint">
                <span>Resource</span>
                {ACTIONS.map((action) => (
                  <span key={action} className="flex items-center justify-center text-center">
                    {action}
                  </span>
                ))}
              </div>
              {RESOURCES.map((resource, i) => (
                <div
                  key={resource}
                  className={`grid grid-cols-[120px_repeat(5,1fr)] items-center gap-px px-3 py-2.5 transition-colors duration-100 hover:bg-app-surface-hover ${
                    i < RESOURCES.length - 1 ? 'border-b border-white/[0.03]' : ''
                  }`}
                >
                  <span className="text-xs font-medium capitalize text-app-muted">{resource}</span>
                  {ACTIONS.map((action) => (
                    <label key={action} className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={hasPermission(resource, action)}
                        onChange={() => togglePermission(resource, action)}
                        className="h-4 w-4 cursor-pointer accent-app-accent"
                      />
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2.5 border-t border-white/[0.06] pt-5">
            <button
              type="button"
              className="rounded-xl px-5 py-2.5 text-[13px] text-app-muted admin-glass-button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cursor-pointer rounded-xl border border-app-accent/30 bg-app-accent-muted px-5 py-2.5 text-[13px] font-medium text-app-accent transition-all duration-150 admin-btn-lift hover:bg-app-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Saving...' : role ? 'Update Role' : 'Create Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
