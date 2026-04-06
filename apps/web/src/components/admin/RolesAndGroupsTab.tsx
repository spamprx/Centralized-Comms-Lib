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

  if (loading) return <div style={{ display:'flex', flexDirection:'column', gap:8 }}>{[1,2,3].map(i => <div key={i} style={{ height:100, background:'rgba(255,255,255,0.04)', borderRadius:8, animation:'pulse 1.5s infinite' }} />)}</div>;
  if (error) return <div style={{ padding:48, textAlign:'center', color:'#f87171', fontSize:14 }}><p>⚠ {error}</p><button onClick={refetch} style={{ marginTop:12, padding:'6px 16px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, color:'#e2e4f0', cursor:'pointer' }}>Retry</button></div>;

  return (
    <div className="rgt-wrapper">
      <div className="rgt-header">
        <div>
          <h2 className="rgt-title">Roles &amp; Groups</h2>
          <p className="rgt-subtitle">Control access levels and team organization</p>
        </div>
        <button 
          className="rgt-add-btn" 
          onClick={() => view === 'roles' ? setShowRoleModal(true) : setShowGroupModal(true)}
        >
          <Plus size={14} /> New {view === 'roles' ? 'role' : 'group'}
        </button>
      </div>

      <div className="rgt-tabs">
        <button className={`rgt-tab ${view === 'roles' ? 'rgt-tab--active' : ''}`} onClick={() => setView('roles')}><Shield size={14} /> Roles ({roles.length})</button>
        <button className={`rgt-tab ${view === 'groups' ? 'rgt-tab--active' : ''}`} onClick={() => setView('groups')}><Users size={14} /> Groups ({groups.length})</button>
      </div>

      <div className="rgt-grid">
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
        <div className="rgt-delete-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div className="rgt-delete-modal" onClick={e => e.stopPropagation()}>
            <h3>Delete {showDeleteConfirm.type === 'role' ? 'Role' : 'Group'}</h3>
            <p>Are you sure you want to delete <strong>{showDeleteConfirm.name}</strong>? This action cannot be undone.</p>
            <div className="rgt-delete-actions">
              <button className="rgt-delete-cancel" onClick={() => setShowDeleteConfirm(null)}>Cancel</button>
              <button className="rgt-delete-confirm" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }
        .rgt-wrapper { display:flex; flex-direction:column; gap:16px; }
        .rgt-header { display:flex; align-items:flex-start; justify-content:space-between; }
        .rgt-title { font-size:18px; font-weight:600; color:#e2e4f0; margin:0 0 4px; }
        .rgt-subtitle { font-size:13px; color:#555870; margin:0; }
        .rgt-add-btn { display:flex; align-items:center; gap:6px; padding:8px 14px; background:rgba(167,139,250,0.15); border:1px solid rgba(167,139,250,0.3); border-radius:8px; color:#a78bfa; font-size:13px; cursor:pointer; }
        .rgt-add-btn:hover { background:rgba(167,139,250,0.25); }
        .rgt-tabs { display:flex; gap:4px; padding:4px; background:rgba(255,255,255,0.03); border-radius:8px; width:fit-content; }
        .rgt-tab { display:flex; align-items:center; gap:6px; padding:6px 14px; background:none; border:none; border-radius:6px; color:#8b8fa8; font-size:13px; cursor:pointer; }
        .rgt-tab--active { background:rgba(255,255,255,0.08); color:#e2e4f0; }
        .rgt-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:12px; }
        .rgt-card { padding:16px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:10px; display:flex; flex-direction:column; gap:10px; transition:border-color 0.15s; }
        .rgt-card:hover { border-color:rgba(167,139,250,0.2); }
        .rgt-card__header { display:flex; align-items:center; gap:10px; }
        .rgt-card__icon { width:30px; height:30px; border-radius:7px; background:rgba(167,139,250,0.15); display:flex; align-items:center; justify-content:center; color:#a78bfa; flex-shrink:0; }
        .rgt-card__icon--group { background:rgba(56,189,248,0.15); color:#38bdf8; }
        .rgt-card__meta { flex:1; min-width:0; }
        .rgt-card__name { display:block; font-size:13px; font-weight:600; color:#e2e4f0; }
        .rgt-card__count { font-size:11px; color:#555870; }
        .rgt-card__actions { display:flex; gap:4px; }
        .rgt-card__desc { font-size:12px; color:#6b7280; margin:0; line-height:1.5; }
        .rgt-icon-btn { display:flex; align-items:center; justify-content:center; width:26px; height:26px; background:none; border:none; border-radius:5px; color:#555870; cursor:pointer; }
        .rgt-icon-btn:hover { background:rgba(255,255,255,0.07); color:#c4c7d9; }
        .rgt-icon-btn--danger:hover { background:rgba(239,68,68,0.1); color:#f87171; }
        .rgt-perms { display:flex; flex-wrap:wrap; gap:4px; }
        .rgt-perm-tag { padding:2px 7px; background:rgba(255,255,255,0.05); border-radius:4px; font-size:11px; color:#8b8fa8; font-family:monospace; }
        .rgt-perm-tag--more { color:#555870; }
        .rgt-members { display:flex; flex-wrap:wrap; gap:4px; }
        .rgt-member-tag { padding:2px 7px; background:rgba(56,189,248,0.1); border-radius:4px; font-size:11px; color:#38bdf8; }
        .rgt-delete-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }
        .rgt-delete-modal {
          background: #1a1d29;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 24px;
          max-width: 400px;
          width: 100%;
        }
        .rgt-delete-modal h3 {
          margin: 0 0 12px;
          font-size: 16px;
          font-weight: 600;
          color: #e2e4f0;
        }
        .rgt-delete-modal p {
          margin: 0 0 20px;
          font-size: 13px;
          color: #8b8fa8;
          line-height: 1.5;
        }
        .rgt-delete-modal strong {
          color: #e2e4f0;
        }
        .rgt-delete-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }
        .rgt-delete-cancel {
          padding: 10px 20px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #9094ae;
          font-size: 13px;
          cursor: pointer;
        }
        .rgt-delete-cancel:hover {
          background: rgba(255, 255, 255, 0.08);
        }
        .rgt-delete-confirm {
          padding: 10px 20px;
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          color: #f87171;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }
        .rgt-delete-confirm:hover {
          background: rgba(239, 68, 68, 0.25);
        }
      `}</style>
    </div>
  );
}

function RoleCard({ role, onEdit, onDelete }: { role: Role; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="rgt-card">
      <div className="rgt-card__header">
        <div className="rgt-card__icon"><Shield size={14} /></div>
        <div className="rgt-card__meta">
          <span className="rgt-card__name">{role.name}</span>
          <span className="rgt-card__count">{role.userCount} users</span>
        </div>
        <div className="rgt-card__actions">
          <button className="rgt-icon-btn" onClick={onEdit}><Edit2 size={13} /></button>
          <button className="rgt-icon-btn rgt-icon-btn--danger" onClick={onDelete}><Trash2 size={13} /></button>
        </div>
      </div>
      <p className="rgt-card__desc">{role.description}</p>
      <div className="rgt-perms">
        {role.permissions.slice(0, 4).map(p => <span key={p.id} className="rgt-perm-tag">{p.resource}:{p.action}</span>)}
        {role.permissions.length > 4 && <span className="rgt-perm-tag rgt-perm-tag--more">+{role.permissions.length - 4} more</span>}
      </div>
    </div>
  );
}

function GroupCard({ group, onEdit, onDelete }: { group: Group; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="rgt-card">
      <div className="rgt-card__header">
        <div className="rgt-card__icon rgt-card__icon--group"><Users size={14} /></div>
        <div className="rgt-card__meta">
          <span className="rgt-card__name">{group.name}</span>
          <span className="rgt-card__count">{group.members.length} members</span>
        </div>
        <div className="rgt-card__actions">
          <button className="rgt-icon-btn" onClick={onEdit}><Edit2 size={13} /></button>
          <button className="rgt-icon-btn rgt-icon-btn--danger" onClick={onDelete}><Trash2 size={13} /></button>
        </div>
      </div>
      <p className="rgt-card__desc">{group.description}</p>
      <div className="rgt-members">
        {group.roles.slice(0, 3).map(r => <span key={r} className="rgt-member-tag">{r}</span>)}
        {group.roles.length > 3 && <span className="rgt-perm-tag rgt-perm-tag--more">+{group.roles.length - 3} roles</span>}
      </div>
    </div>
  );
}