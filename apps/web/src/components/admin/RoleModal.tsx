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
  'w-full resize-y rounded-app-lg border border-white/[0.1] bg-white/[0.04] px-3 py-3 text-[13px] text-app-text shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none backdrop-blur-sm transition-[border-color,box-shadow] duration-200 placeholder-transparent focus:border-app-accent/45 focus:ring-2 focus:ring-app-accent/12';

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
      className="admin-modal-backdrop fixed inset-0 z-[1100] flex items-center justify-center bg-black/75 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="admin-modal-enter admin-modal-panel max-h-[90vh] w-full max-w-[600px] overflow-y-auto rounded-app-xl shadow-app-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-5">
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
            <div className="admin-glass overflow-hidden rounded-app-lg ring-1 ring-white/[0.06]">
              <div className="grid grid-cols-[120px_repeat(5,1fr)] gap-px border-b border-white/[0.08] bg-app-bg/30 px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-app-faint">
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
                  className={`grid grid-cols-[120px_repeat(5,1fr)] items-center gap-px px-3 py-2.5 transition-colors duration-150 hover:bg-white/[0.04] ${
                    i < RESOURCES.length - 1 ? 'border-b border-white/[0.05]' : ''
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
              {loading ? 'Saving...' : role ? 'Update Role' : 'Create Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
