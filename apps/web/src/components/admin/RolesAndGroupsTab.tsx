import { useState } from 'react';
import { Plus, Trash2, Users, Shield, Edit2 } from 'lucide-react';
import { useAdminRolesAndGroups, useAdminUsers } from '../../hooks/useAdmin';
import RoleModal from './RoleModal';
import GroupModal from './GroupModal';
import type { Role, Group } from '../../types/admin';

type View = 'roles' | 'groups';

export default function RolesAndGroupsTab() {
  const { roles, groups, loading, error, deleteRole, deleteGroup, refetch, createRole, updateRole, createGroup, updateGroup } = useAdminRolesAndGroups();
  const { users } = useAdminUsers();
  const [view, setView] = useState<View>('roles');
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: 'role' | 'group'; id: string; name: string } | null>(null);

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

  if (loading) return <div className="flex flex-col gap-2">{[1,2,3].map(i => <div key={i} className="h-[100px] bg-white/[0.04] rounded-lg animate-pulse" />)}</div>;
  if (error) return (
    <div className="p-12 text-center text-red-400 text-sm">
      <p>⚠ {error}</p>
      <button onClick={refetch} className="mt-3 px-4 py-1.5 bg-white/[0.07] border border-white/10 rounded-md text-[#e2e4f0] cursor-pointer">Retry</button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#e2e4f0] mb-1">Roles &amp; Groups</h2>
          <p className="text-[13px] text-[#555870] m-0">Control access levels and team organization</p>
        </div>
        <button 
          className="flex items-center gap-1.5 px-3.5 py-2 bg-violet-400/15 border border-violet-400/30 rounded-lg text-violet-400 text-[13px] cursor-pointer hover:bg-violet-400/25" 
          onClick={() => view === 'roles' ? setShowRoleModal(true) : setShowGroupModal(true)}
        >
          <Plus size={14} /> New {view === 'roles' ? 'role' : 'group'}
        </button>
      </div>

      <div className="flex gap-1 p-1 bg-white/[0.03] rounded-lg w-fit">
        <button className={`flex items-center gap-1.5 px-3.5 py-1.5 border-none rounded-md text-[13px] cursor-pointer ${view === 'roles' ? 'bg-white/[0.08] text-[#e2e4f0]' : 'bg-transparent text-[#8b8fa8]'}`} onClick={() => setView('roles')}><Shield size={14} /> Roles ({roles.length})</button>
        <button className={`flex items-center gap-1.5 px-3.5 py-1.5 border-none rounded-md text-[13px] cursor-pointer ${view === 'groups' ? 'bg-white/[0.08] text-[#e2e4f0]' : 'bg-transparent text-[#8b8fa8]'}`} onClick={() => setView('groups')}><Users size={14} /> Groups ({groups.length})</button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
        {view === 'roles'
          ? roles.map(role => (
              <RoleCard 
                key={role.id} 
                role={role} 
                onEdit={() => setEditingRole(role)}
                onDelete={() => setShowDeleteConfirm({ type: 'role', id: role.id, name: role.name })} 
              />
            ))
          : groups.map(group => (
              <GroupCard 
                key={group.id} 
                group={group} 
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

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] backdrop-blur-sm" onClick={() => setShowDeleteConfirm(null)}>
          <div className="bg-[#1a1d29] border border-white/10 rounded-xl p-6 max-w-[400px] w-full" onClick={e => e.stopPropagation()}>
            <h3 className="m-0 mb-3 text-base font-semibold text-[#e2e4f0]">Delete {showDeleteConfirm.type === 'role' ? 'Role' : 'Group'}</h3>
            <p className="m-0 mb-5 text-[13px] text-[#8b8fa8] leading-relaxed">Are you sure you want to delete <strong className="text-[#e2e4f0]">{showDeleteConfirm.name}</strong>? This action cannot be undone.</p>
            <div className="flex gap-2.5 justify-end">
              <button className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#9094ae] text-[13px] cursor-pointer hover:bg-white/[0.08]" onClick={() => setShowDeleteConfirm(null)}>Cancel</button>
              <button className="px-5 py-2.5 bg-red-500/15 border border-red-500/30 rounded-lg text-red-400 text-[13px] font-medium cursor-pointer hover:bg-red-500/25" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RoleCard({ role, onEdit, onDelete }: { role: Role; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="p-4 bg-white/[0.03] border border-white/[0.07] rounded-[10px] flex flex-col gap-2.5 transition-colors duration-150 hover:border-violet-400/20">
      <div className="flex items-center gap-2.5">
        <div className="w-[30px] h-[30px] rounded-[7px] bg-violet-400/15 flex items-center justify-center text-violet-400 shrink-0"><Shield size={14} /></div>
        <div className="flex-1 min-w-0">
          <span className="block text-[13px] font-semibold text-[#e2e4f0]">{role.name}</span>
          <span className="text-[11px] text-[#555870]">{role.userCount} users</span>
        </div>
        <div className="flex gap-1">
          <button className="flex items-center justify-center w-[26px] h-[26px] bg-transparent border-none rounded-[5px] text-[#555870] cursor-pointer hover:bg-white/[0.07] hover:text-[#c4c7d9]" onClick={onEdit}><Edit2 size={13} /></button>
          <button className="flex items-center justify-center w-[26px] h-[26px] bg-transparent border-none rounded-[5px] text-[#555870] cursor-pointer hover:bg-red-500/10 hover:text-red-400" onClick={onDelete}><Trash2 size={13} /></button>
        </div>
      </div>
      <p className="text-xs text-gray-500 m-0 leading-relaxed">{role.description}</p>
      <div className="flex flex-wrap gap-1">
        {role.permissions.slice(0, 4).map(p => <span key={p.id} className="px-[7px] py-0.5 bg-white/5 rounded text-[11px] text-[#8b8fa8] font-mono">{p.resource}:{p.action}</span>)}
        {role.permissions.length > 4 && <span className="px-[7px] py-0.5 bg-white/5 rounded text-[11px] text-[#555870] font-mono">+{role.permissions.length - 4} more</span>}
      </div>
    </div>
  );
}

function GroupCard({ group, onEdit, onDelete }: { group: Group; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="p-4 bg-white/[0.03] border border-white/[0.07] rounded-[10px] flex flex-col gap-2.5 transition-colors duration-150 hover:border-violet-400/20">
      <div className="flex items-center gap-2.5">
        <div className="w-[30px] h-[30px] rounded-[7px] bg-sky-400/15 flex items-center justify-center text-sky-400 shrink-0"><Users size={14} /></div>
        <div className="flex-1 min-w-0">
          <span className="block text-[13px] font-semibold text-[#e2e4f0]">{group.name}</span>
          <span className="text-[11px] text-[#555870]">{group.members.length} members</span>
        </div>
        <div className="flex gap-1">
          <button className="flex items-center justify-center w-[26px] h-[26px] bg-transparent border-none rounded-[5px] text-[#555870] cursor-pointer hover:bg-white/[0.07] hover:text-[#c4c7d9]" onClick={onEdit}><Edit2 size={13} /></button>
          <button className="flex items-center justify-center w-[26px] h-[26px] bg-transparent border-none rounded-[5px] text-[#555870] cursor-pointer hover:bg-red-500/10 hover:text-red-400" onClick={onDelete}><Trash2 size={13} /></button>
        </div>
      </div>
      <p className="text-xs text-gray-500 m-0 leading-relaxed">{group.description}</p>
      <div className="flex flex-wrap gap-1">
        {group.roles.slice(0, 3).map(r => <span key={r} className="px-[7px] py-0.5 bg-sky-400/10 rounded text-[11px] text-sky-400">{r}</span>)}
        {group.roles.length > 3 && <span className="px-[7px] py-0.5 bg-white/5 rounded text-[11px] text-[#555870]">+{group.roles.length - 3} roles</span>}
      </div>
    </div>
  );
}