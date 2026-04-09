import { useState } from 'react';
import { MoreHorizontal, Trash2, Edit2, Lock, CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';
import type { User } from '../../types/admin';

interface UsersTableProps {
  users: User[];
  loading?: boolean;
  onEdit?: (user: User) => void;
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, status: User['status']) => void;
  onBulkDelete?: (ids: string[]) => void;
  onResetPassword?: (id: string) => void;
}

const STATUS_CONFIG: Record<User['status'], { label: string; icon: React.ElementType; color: string }> = {
  active:    { label: 'Active',    icon: CheckCircle2, color: '#34d399' },
  inactive:  { label: 'Inactive',  icon: XCircle,      color: '#6b7280' },
  suspended: { label: 'Suspended', icon: AlertCircle,  color: '#f87171' },
  pending:   { label: 'Pending',   icon: Clock,        color: '#fbbf24' },
};

const ROLE_COLORS: Record<User['role'], string> = {
  super_admin: '#a78bfa',
  admin:       '#818cf8',
  moderator:   '#38bdf8',
  editor:      '#34d399',
  viewer:      '#9ca3af',
};

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function UsersTable({ users, loading, onEdit, onDelete, onStatusChange, onBulkDelete, onResetPassword }: UsersTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const toggleSelect = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(prev => prev.size === users.length ? new Set() : new Set(users.map(u => u.id)));
  const handleBulkDelete = () => { if (selected.size && onBulkDelete) { onBulkDelete(Array.from(selected)); setSelected(new Set()); } };

  if (loading) return (
    <div className="flex flex-col gap-px">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-[54px] bg-white/[0.04] rounded animate-pulse" style={{ opacity: 1 - i * 0.1 }} />
      ))}
    </div>
  );

  if (!users.length) return (
    <div className="flex items-center justify-center p-[60px] text-[#555870] text-sm">
      No users found matching your criteria.
    </div>
  );

  return (
    <div className="flex flex-col">
      {selected.size > 0 && (
        <div className="flex items-center gap-2.5 px-3.5 py-2 bg-violet-400/[0.08] border border-violet-400/20 rounded-lg mb-2 text-[13px] text-violet-400">
          <span>{selected.size} selected</span>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 border border-red-500/30 rounded-md text-red-400 text-xs cursor-pointer" onClick={handleBulkDelete}><Trash2 size={13} /> Delete selected</button>
          <button className="bg-transparent border-none text-gray-500 text-xs cursor-pointer ml-1" onClick={() => setSelected(new Set())}>Cancel</button>
        </div>
      )}
      <div className="overflow-x-auto rounded-[10px] border border-white/[0.07]">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold tracking-wide uppercase text-[#555870] bg-white/[0.02] border-b border-white/[0.06] whitespace-nowrap w-11">
                <input type="checkbox" checked={selected.size === users.length && users.length > 0} onChange={toggleAll} className="accent-violet-400 cursor-pointer" />
              </th>
              {['User', 'Role', 'Status', 'Groups', 'Last Active', ''].map((h, i) => (
                <th key={i} className={`px-3.5 py-2.5 text-left text-[11px] font-semibold tracking-wide uppercase text-[#555870] bg-white/[0.02] border-b border-white/[0.06] whitespace-nowrap ${i === 6 ? 'w-[50px]' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(user => {
              const statusCfg = STATUS_CONFIG[user.status];
              const StatusIcon = statusCfg.icon;
              const isSelected = selected.has(user.id);
              return (
                <tr key={user.id} className={`transition-colors duration-100 hover:bg-white/[0.025] last:[&>td]:border-b-0 ${isSelected ? 'bg-violet-400/[0.06]' : ''}`}>
                  <td className="px-3.5 py-3 border-b border-white/[0.04] align-middle w-11">
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(user.id)} className="accent-violet-400 cursor-pointer" />
                  </td>
                  <td className="px-3.5 py-3 border-b border-white/[0.04] align-middle">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-semibold shrink-0" style={{ background: ROLE_COLORS[user.role] + '33' }}>
                        {user.avatar ? <img src={user.avatar} alt={user.name} className="w-full h-full rounded-lg object-cover" /> : <span style={{ color: ROLE_COLORS[user.role] }}>{user.name.charAt(0)}</span>}
                      </div>
                      <div>
                        <div className="text-[13px] font-medium text-[#e2e4f0]">{user.name}</div>
                        <div className="text-xs text-[#555870]">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3.5 py-3 border-b border-white/[0.04] align-middle">
                    <span className="inline-block px-2 py-0.5 rounded-[20px] text-[11px] font-medium capitalize whitespace-nowrap" style={{ color: ROLE_COLORS[user.role], background: ROLE_COLORS[user.role] + '1a' }}>{user.role.replace('_', ' ')}</span>
                  </td>
                  <td className="px-3.5 py-3 border-b border-white/[0.04] align-middle">
                    <span className="flex items-center gap-1.5 text-xs whitespace-nowrap" style={{ color: statusCfg.color }}><StatusIcon size={12} />{statusCfg.label}</span>
                  </td>
                  <td className="px-3.5 py-3 border-b border-white/[0.04] align-middle">
                    <div className="flex flex-wrap gap-1">
                      {user.groups.slice(0, 2).map(g => <span key={g} className="px-[7px] py-0.5 bg-white/[0.06] rounded text-[11px] text-[#8b8fa8] whitespace-nowrap">{g}</span>)}
                      {user.groups.length > 2 && <span className="px-[7px] py-0.5 bg-white/[0.06] rounded text-[11px] text-[#555870] whitespace-nowrap">+{user.groups.length - 2}</span>}
                    </div>
                  </td>
                  <td className="px-3.5 py-3 border-b border-white/[0.04] align-middle"><span className="text-xs text-[#555870] whitespace-nowrap">{formatRelative(user.lastActive)}</span></td>
                  <td className="px-3.5 py-3 border-b border-white/[0.04] align-middle w-[50px]">
                    <div className="relative">
                      <button className="flex items-center justify-center w-[30px] h-[30px] bg-transparent border-none rounded-md text-[#555870] cursor-pointer transition-all duration-150 hover:bg-white/[0.07] hover:text-[#c4c7d9]" onClick={() => setOpenMenu(openMenu === user.id ? null : user.id)}><MoreHorizontal size={15} /></button>
                      {openMenu === user.id && (
                        <div className="absolute right-0 top-9 z-[100] bg-[#1a1d2e] border border-white/10 rounded-lg p-1 min-w-[160px] shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
                          {onEdit && <button className="flex items-center gap-2 w-full px-2.5 py-2 bg-transparent border-none rounded-md text-[#c4c7d9] text-[13px] cursor-pointer text-left transition-colors duration-100 hover:bg-white/[0.07]" onClick={() => { onEdit(user); setOpenMenu(null); }}><Edit2 size={13} /> Edit user</button>}
                          {onResetPassword && <button className="flex items-center gap-2 w-full px-2.5 py-2 bg-transparent border-none rounded-md text-[#c4c7d9] text-[13px] cursor-pointer text-left transition-colors duration-100 hover:bg-white/[0.07]" onClick={() => { onResetPassword(user.id); setOpenMenu(null); }}><Lock size={13} /> Reset password</button>}
                          {onStatusChange && user.status !== 'suspended' && <button className="flex items-center gap-2 w-full px-2.5 py-2 bg-transparent border-none rounded-md text-amber-400 text-[13px] cursor-pointer text-left transition-colors duration-100 hover:bg-amber-400/10" onClick={() => { onStatusChange(user.id, 'suspended'); setOpenMenu(null); }}><AlertCircle size={13} /> Suspend</button>}
                          {onStatusChange && user.status === 'suspended' && <button className="flex items-center gap-2 w-full px-2.5 py-2 bg-transparent border-none rounded-md text-[#c4c7d9] text-[13px] cursor-pointer text-left transition-colors duration-100 hover:bg-white/[0.07]" onClick={() => { onStatusChange(user.id, 'active'); setOpenMenu(null); }}><CheckCircle2 size={13} /> Reactivate</button>}
                          {onDelete && <button className="flex items-center gap-2 w-full px-2.5 py-2 bg-transparent border-none rounded-md text-red-400 text-[13px] cursor-pointer text-left transition-colors duration-100 hover:bg-red-500/10" onClick={() => { onDelete(user.id); setOpenMenu(null); }}><Trash2 size={13} /> Delete</button>}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}