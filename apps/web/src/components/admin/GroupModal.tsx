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

const inputClass = "w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#e2e4f0] text-[13px] outline-none transition-colors duration-150 focus:border-violet-400/50 resize-y";

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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#1a1d29] border border-white/10 rounded-xl w-full max-w-[520px] max-h-[90vh] overflow-y-auto shadow-[0_20px_60px_rgba(0,0,0,0.4)]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.08]">
          <h2 className="m-0 text-lg font-semibold text-[#e2e4f0]">{group ? 'Edit Group' : 'Create Group'}</h2>
          <button className="bg-transparent border-none text-[#555870] cursor-pointer p-1 flex rounded hover:bg-white/5 hover:text-[#e2e4f0]" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && <div className="bg-red-400/10 border border-red-400/30 rounded-lg p-3 text-red-400 text-[13px] mb-4">{error}</div>}

          <div className="mb-5">
            <label className="block text-[13px] font-medium text-[#c4c7d9] mb-2">Group Name</label>
            <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Engineering Team" required className={inputClass} />
          </div>

          <div className="mb-5">
            <label className="block text-[13px] font-medium text-[#c4c7d9] mb-2">Description</label>
            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Describe the group's purpose..." rows={3} required className={inputClass} />
          </div>

          <div className="mb-5">
            <label className="block text-[13px] font-medium text-[#c4c7d9] mb-2">Members</label>
            <div className="flex flex-col gap-2 p-3 bg-white/[0.03] border border-white/[0.06] rounded-lg max-h-[180px] overflow-y-auto">
              {users.length === 0 ? (
                <span className="text-xs text-[#555870]">No users available</span>
              ) : (
                users.map(user => (
                  <label key={user.id} className="flex items-center gap-2.5 text-[13px] text-[#c4c7d9] cursor-pointer px-2 py-1.5 rounded-md transition-colors duration-150 hover:bg-white/5">
                    <input type="checkbox" checked={formData.members.includes(user.id)} onChange={() => toggleMember(user.id)} className="accent-violet-400 cursor-pointer w-4 h-4" />
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-[#e2e4f0]">{user.name}</span>
                      <span className="text-[11px] text-[#555870]">{user.email}</span>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-[13px] font-medium text-[#c4c7d9] mb-2">Group Roles</label>
            <div className="flex flex-col gap-2 p-3 bg-white/[0.03] border border-white/[0.06] rounded-lg max-h-[180px] overflow-y-auto">
              {roles.length === 0 ? (
                <span className="text-xs text-[#555870]">No roles available</span>
              ) : (
                roles.map(role => (
                  <label key={role.id} className="flex items-center gap-2.5 text-[13px] text-[#c4c7d9] cursor-pointer px-2 py-1.5 rounded-md transition-colors duration-150 hover:bg-white/5">
                    <input type="checkbox" checked={formData.roles.includes(role.id)} onChange={() => toggleRole(role.id)} className="accent-violet-400 cursor-pointer w-4 h-4" />
                    <span>{role.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex gap-2.5 justify-end mt-6 pt-5 border-t border-white/[0.08]">
            <button type="button" className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#9094ae] text-[13px] cursor-pointer transition-all duration-150 hover:bg-white/[0.08] hover:text-[#e2e4f0]" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="px-5 py-2.5 bg-violet-400/15 border border-violet-400/30 rounded-lg text-violet-400 text-[13px] font-medium cursor-pointer transition-all duration-150 hover:bg-violet-400/25 disabled:opacity-50 disabled:cursor-not-allowed" disabled={loading}>
              {loading ? 'Saving...' : (group ? 'Update Group' : 'Create Group')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
