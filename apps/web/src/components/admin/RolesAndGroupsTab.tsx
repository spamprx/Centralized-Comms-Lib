import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Trash2, Users, Shield, Edit2 } from 'lucide-react';
import { useAdminRolesAndGroups, useAdminUsers } from '../../hooks/useAdmin';
import RoleModal from './RoleModal';
import GroupModal from './GroupModal';
import type { Role, Group } from '../../types/admin';

type View = 'roles' | 'groups';

const ROLE_TOP_BORDER: Record<string, string> = {
  'Super Admin': '#fbbf24',
  'Admin': '#818cf8',
  'Moderator': '#38bdf8',
  'Editor': '#a78bfa',
  'Viewer': '#6b7280',
};

/** Deterministic hue from name string */
function nameToHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ((hash % 360) + 360) % 360;
}

export default function RolesAndGroupsTab() {
  const { roles, groups, loading, error, deleteRole, deleteGroup, refetch, createRole, updateRole, createGroup, updateGroup } = useAdminRolesAndGroups();
  const { users } = useAdminUsers();
  const [view, setView] = useState<View>('roles');
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: 'role' | 'group'; id: string; name: string } | null>(null);

  // Pill toggle indicator
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const toggleContainerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  const updateIndicator = useCallback(() => {
    const idx = view === 'roles' ? 0 : 1;
    const btn = btnRefs.current[idx];
    const container = toggleContainerRef.current;
    if (btn && container) {
      const cRect = container.getBoundingClientRect();
      const bRect = btn.getBoundingClientRect();
      setIndicatorStyle({ left: bRect.left - cRect.left, width: bRect.width });
    }
  }, [view]);

  useEffect(() => { updateIndicator(); }, [updateIndicator, view]);

  const handleCreateRole = async (data: Omit<Role, 'id' | 'userCount' | 'createdAt'>) => {
    await createRole(data);
    refetch();
  };

  const handleUpdateRole = async (data: Omit<Role, 'id' | 'userCount' | 'createdAt'>) => {
    if (editingRole) {
      await updateRole(editingRole.id, data);
      refetch();
    }
  };

  const handleCreateGroup = async (data: Omit<Group, 'id' | 'createdAt'>) => {
    await createGroup(data);
    refetch();
  };

  const handleUpdateGroup = async (data: Omit<Group, 'id' | 'createdAt'>) => {
    if (editingGroup) {
      await updateGroup(editingGroup.id, data);
      refetch();
    }
  };

  const handleDelete = async () => {
    if (showDeleteConfirm?.type === 'role') {
      await deleteRole(showDeleteConfirm.id);
    } else if (showDeleteConfirm?.type === 'group') {
      await deleteGroup(showDeleteConfirm.id);
    }
    setShowDeleteConfirm(null);
    refetch();
  };

  if (loading) return <div className="flex flex-col gap-3">{[1,2,3].map(i => <div key={i} className="h-[120px] rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />)}</div>;
  if (error) return (
    <div className="p-12 text-center text-red-400 text-sm">
      <p>⚠ {error}</p>
      <button onClick={refetch} className="mt-3 px-4 py-1.5 admin-glass-button rounded-lg text-app-text">Retry</button>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-app-text mb-1">Roles &amp; Groups</h2>
          <p className="text-[13px] text-app-faint m-0">Control access levels and team organization</p>
        </div>
        <button 
          className="flex items-center gap-1.5 px-3.5 py-2 admin-glass-button rounded-xl text-app-accent text-[13px] font-medium" 
          onClick={() => view === 'roles' ? setShowRoleModal(true) : setShowGroupModal(true)}
        >
          <Plus size={14} /> New {view === 'roles' ? 'role' : 'group'}
        </button>
      </div>

      {/* Pill toggle */}
      <div ref={toggleContainerRef} className="admin-pill-toggle w-fit">
        <div className="admin-pill-toggle-indicator" style={{ left: indicatorStyle.left, width: indicatorStyle.width }} />
        <button
          ref={el => { btnRefs.current[0] = el; }}
          type="button"
          data-active={view === 'roles'}
          onClick={() => setView('roles')}
          className="flex items-center gap-1.5"
        >
          <Shield size={14} /> Roles ({roles.length})
        </button>
        <button
          ref={el => { btnRefs.current[1] = el; }}
          type="button"
          data-active={view === 'groups'}
          onClick={() => setView('groups')}
          className="flex items-center gap-1.5"
        >
          <Users size={14} /> Groups ({groups.length})
        </button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
        {view === 'roles'
          ? roles.map((role, idx) => (
              <RoleCard 
                key={role.id} 
                role={role} 
                index={idx}
                onEdit={() => setEditingRole(role)}
                onDelete={() => setShowDeleteConfirm({ type: 'role', id: role.id, name: role.name })} 
              />
            ))
          : groups.map((group, idx) => (
              <GroupCard 
                key={group.id} 
                group={group} 
                index={idx}
                onEdit={() => setEditingGroup(group)}
                onDelete={() => setShowDeleteConfirm({ type: 'group', id: group.id, name: group.name })} 
              />
            ))
        }
      </div>

      {showRoleModal && (
        <RoleModal
          role={editingRole}
          onClose={() => { setShowRoleModal(false); setEditingRole(null); }}
          onSave={editingRole ? handleUpdateRole : handleCreateRole}
        />
      )}

      {showGroupModal && (
        <GroupModal
          group={editingGroup}
          users={users.map(u => ({ id: u.id, name: u.name, email: u.email }))}
          roles={roles.map(r => ({ id: r.id, name: r.name }))}
          onClose={() => { setShowGroupModal(false); setEditingGroup(null); }}
          onSave={editingGroup ? handleUpdateGroup : handleCreateGroup}
        />
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] backdrop-blur-sm admin-modal-backdrop" onClick={() => setShowDeleteConfirm(null)}>
          <div className="admin-glass rounded-2xl p-6 max-w-[400px] w-full shadow-app-soft admin-modal-enter" style={{ background: 'rgba(15, 20, 32, 0.9)' }} onClick={e => e.stopPropagation()}>
            <h3 className="m-0 mb-3 text-base font-semibold text-app-text">Delete {showDeleteConfirm.type === 'role' ? 'Role' : 'Group'}</h3>
            <p className="m-0 mb-5 text-[13px] text-app-muted leading-relaxed">Are you sure you want to delete <strong className="text-app-text">{showDeleteConfirm.name}</strong>? This action cannot be undone.</p>
            <div className="flex gap-2.5 justify-end">
              <button className="px-5 py-2.5 admin-glass-button rounded-xl text-app-muted text-[13px]" onClick={() => setShowDeleteConfirm(null)}>Cancel</button>
              <button className="px-5 py-2.5 bg-red-400/10 border border-red-400/20 rounded-xl text-red-400 text-[13px] font-medium cursor-pointer admin-btn-lift hover:bg-red-400/15" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Role Card ────────────────────────────────────────────────────────

function RoleCard({ role, index, onEdit, onDelete }: { role: Role; index: number; onEdit: () => void; onDelete: () => void }) {
  const topColor = ROLE_TOP_BORDER[role.name] || '#6b7280';
  const memberCount = role.userCount;

  return (
    <div
      className="admin-glass admin-card-hover rounded-xl flex flex-col gap-3 p-4 group admin-row-enter relative overflow-hidden"
      style={{ '--row-index': index, borderTop: `2px solid ${topColor}` } as React.CSSProperties}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${topColor}15`, color: topColor }}
        >
          <Shield size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="block text-[13px] font-semibold text-app-text">{role.name}</span>
          {/* Mini avatar stack */}
          <div className="flex items-center mt-0.5">
            {Array.from({ length: Math.min(memberCount, 4) }).map((_, i) => (
              <div
                key={i}
                className="w-4 h-4 rounded-full border border-app-bg-subtle"
                style={{
                  background: `hsl(${(i * 71 + 180) % 360}, 50%, 50%)`,
                  marginLeft: i === 0 ? 0 : -4,
                  zIndex: 4 - i,
                }}
              />
            ))}
            {memberCount > 4 && (
              <span className="text-[10px] text-app-faint ml-1">+{memberCount - 4}</span>
            )}
            {memberCount <= 4 && (
              <span className="text-[10px] text-app-faint ml-1.5">{memberCount} user{memberCount !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>

        {/* Actions — hidden by default, visible on hover */}
        <div className="flex gap-1 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200">
          <button className="flex items-center justify-center w-7 h-7 bg-transparent border-none rounded-lg text-app-faint cursor-pointer hover:bg-app-surface-hover hover:text-app-muted" onClick={onEdit}><Edit2 size={13} /></button>
          <button className="flex items-center justify-center w-7 h-7 bg-transparent border-none rounded-lg text-app-faint cursor-pointer hover:bg-red-400/10 hover:text-red-400" onClick={onDelete}><Trash2 size={13} /></button>
        </div>
      </div>
      <p className="text-[12px] text-app-faint m-0 leading-relaxed">{role.description}</p>
      {/* Monospace permission chips */}
      <div className="flex flex-wrap gap-1">
        {role.permissions.slice(0, 4).map(p => (
          <span key={p.id} className="px-2 py-0.5 bg-white/[0.04] rounded-md text-[10px] text-app-muted font-mono tracking-tight">{p.resource}:{p.action}</span>
        ))}
        {role.permissions.length > 4 && <span className="px-2 py-0.5 bg-white/[0.04] rounded-md text-[10px] text-app-faint font-mono">+{role.permissions.length - 4}</span>}
      </div>
    </div>
  );
}

// ─── Group Card ───────────────────────────────────────────────────────

function GroupCard({ group, index, onEdit, onDelete }: { group: Group; index: number; onEdit: () => void; onDelete: () => void }) {
  const memberCount = group.members.length;

  return (
    <div
      className="admin-glass admin-card-hover rounded-xl flex flex-col gap-3 p-4 group admin-row-enter relative overflow-hidden"
      style={{ '--row-index': index, borderTop: '2px solid #38bdf8' } as React.CSSProperties}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-sky-400/10 flex items-center justify-center text-sky-400 shrink-0">
          <Users size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="block text-[13px] font-semibold text-app-text">{group.name}</span>
          {/* Mini avatar stack */}
          <div className="flex items-center mt-0.5">
            {Array.from({ length: Math.min(memberCount, 4) }).map((_, i) => (
              <div
                key={i}
                className="w-4 h-4 rounded-full border border-app-bg-subtle"
                style={{
                  background: `hsl(${nameToHue(`member-${i}-${group.id}`)}, 50%, 50%)`,
                  marginLeft: i === 0 ? 0 : -4,
                  zIndex: 4 - i,
                }}
              />
            ))}
            {memberCount > 4 && (
              <span className="text-[10px] text-app-faint ml-1">+{memberCount - 4}</span>
            )}
            {memberCount <= 4 && (
              <span className="text-[10px] text-app-faint ml-1.5">{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>

        <div className="flex gap-1 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200">
          <button className="flex items-center justify-center w-7 h-7 bg-transparent border-none rounded-lg text-app-faint cursor-pointer hover:bg-app-surface-hover hover:text-app-muted" onClick={onEdit}><Edit2 size={13} /></button>
          <button className="flex items-center justify-center w-7 h-7 bg-transparent border-none rounded-lg text-app-faint cursor-pointer hover:bg-red-400/10 hover:text-red-400" onClick={onDelete}><Trash2 size={13} /></button>
        </div>
      </div>
      <p className="text-[12px] text-app-faint m-0 leading-relaxed">{group.description}</p>
      <div className="flex flex-wrap gap-1">
        {group.roles.slice(0, 3).map(r => <span key={r} className="px-2 py-0.5 bg-sky-400/8 rounded-md text-[10px] text-sky-400 font-mono">{r}</span>)}
        {group.roles.length > 3 && <span className="px-2 py-0.5 bg-white/[0.04] rounded-md text-[10px] text-app-faint">+{group.roles.length - 3}</span>}
      </div>
    </div>
  );
}