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

const inputClass = "w-full px-3 py-2.5 bg-app-surface border border-app-border rounded-lg text-app-text text-[13px] outline-none transition-colors duration-150 focus:border-app-accent/50 resize-y";

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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#1a1d29] border border-app-border rounded-xl w-full max-w-[600px] max-h-[90vh] overflow-y-auto shadow-[0_20px_60px_rgba(0,0,0,0.4)]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-app-border">
          <h2 className="m-0 text-lg font-semibold text-app-text">{role ? 'Edit Role' : 'Create Role'}</h2>
          <button className="bg-transparent border-none text-app-faint cursor-pointer p-1 flex rounded hover:bg-app-surface-hover hover:text-app-text" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && <div className="bg-red-400/10 border border-red-400/30 rounded-lg p-3 text-red-400 text-[13px] mb-4">{error}</div>}

          <div className="mb-5">
            <label className="block text-[13px] font-medium text-app-muted mb-2">Role Name</label>
            <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Content Manager" required className={inputClass} />
          </div>

          <div className="mb-5">
            <label className="block text-[13px] font-medium text-app-muted mb-2">Description</label>
            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Describe the role's purpose..." rows={3} required className={inputClass} />
          </div>

          <div className="mb-5">
            <label className="block text-[13px] font-medium text-app-muted mb-2">Permissions</label>
            <div className="border border-app-border rounded-lg overflow-hidden">
              <div className="grid grid-cols-[120px_repeat(5,1fr)] gap-px bg-app-surface px-3 py-2.5 text-[11px] font-semibold uppercase text-app-faint tracking-wide">
                <span>Resource</span>
                {ACTIONS.map(action => (
                  <span key={action} className="flex items-center justify-center text-center">{action}</span>
                ))}
              </div>
              {RESOURCES.map((resource, i) => (
                <div key={resource} className={`grid grid-cols-[120px_repeat(5,1fr)] gap-px px-3 py-2 items-center ${i % 2 === 0 ? 'bg-app-surface' : 'bg-app-bg/60'}`}>
                  <span className="text-xs font-medium text-app-muted capitalize">{resource}</span>
                  {ACTIONS.map(action => (
                    <label key={action} className="flex items-center justify-center">
                      <input type="checkbox" checked={hasPermission(resource, action)} onChange={() => togglePermission(resource, action)} className="accent-teal-600 cursor-pointer w-4 h-4" />
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2.5 justify-end mt-6 pt-5 border-t border-app-border">
            <button type="button" className="px-5 py-2.5 bg-app-surface border border-app-border rounded-lg text-app-muted text-[13px] cursor-pointer transition-all duration-150 hover:bg-app-surface-hover hover:text-app-text" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="px-5 py-2.5 bg-app-accent-muted border border-app-accent/30 rounded-lg text-app-accent text-[13px] font-medium cursor-pointer transition-all duration-150 hover:bg-app-accent/20 disabled:opacity-50 disabled:cursor-not-allowed" disabled={loading}>
              {loading ? 'Saving...' : (role ? 'Update Role' : 'Create Role')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
