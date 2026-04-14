import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Role, Permission } from '../../types/admin';

interface RoleModalProps {
  role?: Role | null;
  onClose: () => void;
  onSave: (data: Omit<Role, 'id' | 'userCount' | 'createdAt'>) => Promise<void>;
}

const RESOURCES = ['users', 'roles', 'content', 'reports', 'settings', 'analytics', 'groups'];
const ACTIONS = ['create', 'read', 'update', 'delete', 'manage'] as const;

const inputClass = "w-full px-3 py-3 bg-app-surface border border-app-border rounded-xl text-app-text text-[13px] outline-none transition-all duration-200 focus:border-app-accent/40 focus:shadow-[0_0_0_3px_rgba(147,124,248,0.06)] resize-y placeholder-transparent";

export default function RoleModal({ role, onClose, onSave }: RoleModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as Permission[],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (role) {
      setFormData({
        name: role.name,
        description: role.description,
        permissions: role.permissions,
      });
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
      setError(err instanceof Error ? err.message : 'Failed to save role');
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (resource: string, action: (typeof ACTIONS)[number]) => {
    setFormData(prev => {
      const exists = prev.permissions.find(p => p.resource === resource && p.action === action);
      if (exists) {
        return {
          ...prev,
          permissions: prev.permissions.filter(p => !(p.resource === resource && p.action === action)),
        };
      }
      return {
        ...prev,
        permissions: [...prev.permissions, { id: `${resource}-${action}`, resource, action }],
      };
    });
  };

  const hasPermission = (resource: string, action: (typeof ACTIONS)[number]) => {
    return formData.permissions.some(p => p.resource === resource && p.action === action);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] backdrop-blur-sm admin-modal-backdrop" onClick={onClose}>
      <div
        className="admin-glass rounded-2xl w-full max-w-[600px] max-h-[90vh] overflow-y-auto shadow-app-soft admin-modal-enter"
        style={{ background: 'rgba(15, 20, 32, 0.92)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <h2 className="m-0 text-lg font-semibold text-app-text">{role ? 'Edit Role' : 'Create Role'}</h2>
          <button className="bg-transparent border-none text-app-faint cursor-pointer p-1.5 flex rounded-lg hover:bg-app-surface-hover hover:text-app-text transition-colors" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && <div className="bg-red-400/10 border border-red-400/25 rounded-xl p-3 text-red-400 text-[13px] mb-4">{error}</div>}

          <div className="mb-5 admin-float-field">
            <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder=" " required className={inputClass} />
            <label>Role Name</label>
          </div>

          <div className="mb-5 admin-float-field">
            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder=" " rows={3} required className={inputClass} />
            <label>Description</label>
          </div>

          <div className="mb-5">
            <label className="block text-[13px] font-medium text-app-muted mb-2">Permissions</label>
            <div className="admin-glass rounded-xl overflow-hidden">
              <div className="grid grid-cols-[120px_repeat(5,1fr)] gap-px px-3 py-2.5 text-[11px] font-semibold uppercase text-app-faint tracking-wide border-b border-white/[0.04]">
                <span>Resource</span>
                {ACTIONS.map(action => (
                  <span key={action} className="flex items-center justify-center text-center">{action}</span>
                ))}
              </div>
              {RESOURCES.map((resource, i) => (
                <div key={resource} className={`grid grid-cols-[120px_repeat(5,1fr)] gap-px px-3 py-2.5 items-center transition-colors duration-100 hover:bg-app-surface-hover ${i < RESOURCES.length - 1 ? 'border-b border-white/[0.03]' : ''}`}>
                  <span className="text-xs font-medium text-app-muted capitalize">{resource}</span>
                  {ACTIONS.map(action => (
                    <label key={action} className="flex items-center justify-center">
                      <input type="checkbox" checked={hasPermission(resource, action)} onChange={() => togglePermission(resource, action)} className="accent-app-accent cursor-pointer w-4 h-4" />
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2.5 justify-end mt-6 pt-5 border-t border-white/[0.06]">
            <button type="button" className="px-5 py-2.5 admin-glass-button rounded-xl text-app-muted text-[13px]" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-app-accent-muted border border-app-accent/30 rounded-xl text-app-accent text-[13px] font-medium cursor-pointer admin-btn-lift transition-all duration-150 hover:bg-app-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Saving...' : (role ? 'Update Role' : 'Create Role')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
