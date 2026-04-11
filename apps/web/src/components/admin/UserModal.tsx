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

const inputClass = "w-full px-3 py-2.5 bg-app-surface border border-app-border rounded-lg text-app-text text-[13px] outline-none transition-colors duration-150 focus:border-app-accent/50";

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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#1a1d29] border border-app-border rounded-xl w-full max-w-[480px] max-h-[90vh] overflow-y-auto shadow-[0_20px_60px_rgba(0,0,0,0.4)]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-app-border">
          <h2 className="m-0 text-lg font-semibold text-app-text">{user ? 'Edit User' : 'Invite User'}</h2>
          <button className="bg-transparent border-none text-app-faint cursor-pointer p-1 flex rounded hover:bg-app-surface-hover hover:text-app-text" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && <div className="bg-red-400/10 border border-red-400/30 rounded-lg p-3 text-red-400 text-[13px] mb-4">{error}</div>}

          <div className="mb-4">
            <label className="block text-[13px] font-medium text-app-muted mb-1.5">Full Name</label>
            <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Enter full name" required className={inputClass} />
          </div>

          <div className="mb-4">
            <label className="block text-[13px] font-medium text-app-muted mb-1.5">Email</label>
            <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="Enter email address" required className={inputClass} />
          </div>

          <div className="mb-4">
            <label className="block text-[13px] font-medium text-app-muted mb-1.5">Role</label>
            <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })} className={`${inputClass} cursor-pointer`}>
              {ROLE_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-[13px] font-medium text-app-muted mb-1.5">Status</label>
            <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as UserStatus })} className={`${inputClass} cursor-pointer`}>
              {STATUS_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-[13px] font-medium text-app-muted mb-1.5">Groups</label>
            <div className="flex flex-col gap-2 p-3 bg-app-surface border border-app-border rounded-lg max-h-[150px] overflow-y-auto">
              {groups.length === 0 ? (
                <span className="text-xs text-app-faint">No groups available</span>
              ) : (
                groups.map(group => (
                  <label key={group.id} className="flex items-center gap-2 text-[13px] text-app-muted cursor-pointer">
                    <input type="checkbox" checked={formData.groups.includes(group.name)} onChange={() => toggleGroup(group.name)} className="accent-teal-600 cursor-pointer" />
                    <span>{group.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex gap-2.5 justify-end mt-6 pt-5 border-t border-app-border">
            <button type="button" className="px-5 py-2.5 bg-app-surface border border-app-border rounded-lg text-app-muted text-[13px] cursor-pointer transition-all duration-150 hover:bg-app-surface-hover hover:text-app-text" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="px-5 py-2.5 bg-app-accent-muted border border-app-accent/30 rounded-lg text-app-accent text-[13px] font-medium cursor-pointer transition-all duration-150 hover:bg-app-accent/20 disabled:opacity-50 disabled:cursor-not-allowed" disabled={loading}>
              {loading ? 'Saving...' : (user ? 'Update User' : 'Invite User')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
