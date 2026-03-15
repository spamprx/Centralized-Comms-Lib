import { useState } from 'react';
import { MoreHorizontal, Trash2, Edit2, Lock, CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';
import type { User } from '../../../types/admin';

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
    <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ height:54, background:'rgba(255,255,255,0.04)', borderRadius:4, opacity: 1 - i * 0.1, animation:'pulse 1.5s infinite' }} />
      ))}
    </div>
  );

  if (!users.length) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:60, color:'#555870', fontSize:14 }}>
      No users found matching your criteria.
    </div>
  );

  return (
    <div className="ut-wrapper">
      {selected.size > 0 && (
        <div className="ut-bulk-bar">
          <span>{selected.size} selected</span>
          <button className="ut-bulk-delete" onClick={handleBulkDelete}><Trash2 size={13} /> Delete selected</button>
          <button className="ut-bulk-clear" onClick={() => setSelected(new Set())}>Cancel</button>
        </div>
      )}
      <div className="ut-table-wrap">
        <table className="ut-table">
          <thead>
            <tr>
              <th className="ut-th ut-th--check">
                <input type="checkbox" checked={selected.size === users.length && users.length > 0} onChange={toggleAll} className="ut-checkbox" />
              </th>
              <th className="ut-th">User</th>
              <th className="ut-th">Role</th>
              <th className="ut-th">Status</th>
              <th className="ut-th">Groups</th>
              <th className="ut-th">Last Active</th>
              <th className="ut-th ut-th--actions" />
            </tr>
          </thead>
          <tbody>
            {users.map(user => {
              const statusCfg = STATUS_CONFIG[user.status];
              const StatusIcon = statusCfg.icon;
              const isSelected = selected.has(user.id);
              return (
                <tr key={user.id} className={`ut-row ${isSelected ? 'ut-row--selected' : ''}`}>
                  <td className="ut-td ut-td--check">
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(user.id)} className="ut-checkbox" />
                  </td>
                  <td className="ut-td">
                    <div className="ut-user">
                      <div className="ut-avatar" style={{ background: ROLE_COLORS[user.role] + '33' }}>
                        {user.avatar ? <img src={user.avatar} alt={user.name} className="ut-avatar__img" /> : <span style={{ color: ROLE_COLORS[user.role] }}>{user.name.charAt(0)}</span>}
                      </div>
                      <div>
                        <div className="ut-user__name">{user.name}</div>
                        <div className="ut-user__email">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="ut-td">
                    <span className="ut-role" style={{ color: ROLE_COLORS[user.role], background: ROLE_COLORS[user.role] + '1a' }}>{user.role.replace('_', ' ')}</span>
                  </td>
                  <td className="ut-td">
                    <span className="ut-status" style={{ color: statusCfg.color }}><StatusIcon size={12} />{statusCfg.label}</span>
                  </td>
                  <td className="ut-td">
                    <div className="ut-groups">
                      {user.groups.slice(0, 2).map(g => <span key={g} className="ut-group-tag">{g}</span>)}
                      {user.groups.length > 2 && <span className="ut-group-tag ut-group-tag--more">+{user.groups.length - 2}</span>}
                    </div>
                  </td>
                  <td className="ut-td"><span className="ut-date">{formatRelative(user.lastActive)}</span></td>
                  <td className="ut-td ut-td--actions">
                    <div className="ut-menu-wrap">
                      <button className="ut-menu-btn" onClick={() => setOpenMenu(openMenu === user.id ? null : user.id)}><MoreHorizontal size={15} /></button>
                      {openMenu === user.id && (
                        <div className="ut-menu">
                          {onEdit && <button className="ut-menu-item" onClick={() => { onEdit(user); setOpenMenu(null); }}><Edit2 size={13} /> Edit user</button>}
                          {onResetPassword && <button className="ut-menu-item" onClick={() => { onResetPassword(user.id); setOpenMenu(null); }}><Lock size={13} /> Reset password</button>}
                          {onStatusChange && user.status !== 'suspended' && <button className="ut-menu-item ut-menu-item--warn" onClick={() => { onStatusChange(user.id, 'suspended'); setOpenMenu(null); }}><AlertCircle size={13} /> Suspend</button>}
                          {onStatusChange && user.status === 'suspended' && <button className="ut-menu-item" onClick={() => { onStatusChange(user.id, 'active'); setOpenMenu(null); }}><CheckCircle2 size={13} /> Reactivate</button>}
                          {onDelete && <button className="ut-menu-item ut-menu-item--danger" onClick={() => { onDelete(user.id); setOpenMenu(null); }}><Trash2 size={13} /> Delete</button>}
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
      <style>{`
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }
        .ut-wrapper { display:flex; flex-direction:column; }
        .ut-bulk-bar { display:flex; align-items:center; gap:10px; padding:8px 14px; background:rgba(167,139,250,0.08); border:1px solid rgba(167,139,250,0.2); border-radius:8px; margin-bottom:8px; font-size:13px; color:#a78bfa; }
        .ut-bulk-delete { display:flex; align-items:center; gap:5px; padding:5px 12px; background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); border-radius:6px; color:#f87171; font-size:12px; cursor:pointer; }
        .ut-bulk-clear { background:none; border:none; color:#6b7280; font-size:12px; cursor:pointer; margin-left:4px; }
        .ut-table-wrap { overflow-x:auto; border-radius:10px; border:1px solid rgba(255,255,255,0.07); }
        .ut-table { width:100%; border-collapse:collapse; }
        .ut-th { padding:10px 14px; text-align:left; font-size:11px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:#555870; background:rgba(255,255,255,0.02); border-bottom:1px solid rgba(255,255,255,0.06); white-space:nowrap; }
        .ut-th--check, .ut-td--check { width:44px; }
        .ut-th--actions, .ut-td--actions { width:50px; }
        .ut-td { padding:12px 14px; border-bottom:1px solid rgba(255,255,255,0.04); vertical-align:middle; }
        .ut-row { transition:background 0.1s; }
        .ut-row:hover { background:rgba(255,255,255,0.025); }
        .ut-row--selected { background:rgba(167,139,250,0.06); }
        .ut-row:last-child .ut-td { border-bottom:none; }
        .ut-checkbox { accent-color:#a78bfa; cursor:pointer; }
        .ut-user { display:flex; align-items:center; gap:10px; }
        .ut-avatar { width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600; flex-shrink:0; }
        .ut-avatar__img { width:100%; height:100%; border-radius:8px; object-fit:cover; }
        .ut-user__name { font-size:13px; font-weight:500; color:#e2e4f0; }
        .ut-user__email { font-size:12px; color:#555870; }
        .ut-role { display:inline-block; padding:3px 8px; border-radius:20px; font-size:11px; font-weight:500; text-transform:capitalize; white-space:nowrap; }
        .ut-status { display:flex; align-items:center; gap:5px; font-size:12px; white-space:nowrap; }
        .ut-groups { display:flex; flex-wrap:wrap; gap:4px; }
        .ut-group-tag { padding:2px 7px; background:rgba(255,255,255,0.06); border-radius:4px; font-size:11px; color:#8b8fa8; white-space:nowrap; }
        .ut-group-tag--more { color:#555870; }
        .ut-date { font-size:12px; color:#555870; white-space:nowrap; }
        .ut-menu-wrap { position:relative; }
        .ut-menu-btn { display:flex; align-items:center; justify-content:center; width:30px; height:30px; background:none; border:none; border-radius:6px; color:#555870; cursor:pointer; transition:all 0.15s; }
        .ut-menu-btn:hover { background:rgba(255,255,255,0.07); color:#c4c7d9; }
        .ut-menu { position:absolute; right:0; top:36px; z-index:100; background:#1a1d2e; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:4px; min-width:160px; box-shadow:0 8px 24px rgba(0,0,0,0.4); }
        .ut-menu-item { display:flex; align-items:center; gap:8px; width:100%; padding:8px 10px; background:none; border:none; border-radius:6px; color:#c4c7d9; font-size:13px; cursor:pointer; text-align:left; transition:background 0.1s; }
        .ut-menu-item:hover { background:rgba(255,255,255,0.07); }
        .ut-menu-item--warn { color:#fbbf24; }
        .ut-menu-item--warn:hover { background:rgba(251,191,36,0.1); }
        .ut-menu-item--danger { color:#f87171; }
        .ut-menu-item--danger:hover { background:rgba(239,68,68,0.1); }
      `}</style>
    </div>
  );
}