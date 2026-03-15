import { useState } from 'react';
import { Plus, Trash2, Users, Shield, Edit2 } from 'lucide-react';
import { useAdminRolesAndGroups } from '../../../hooks/useAdmin';
import type { Role, Group } from '../../../types/admin';

type View = 'roles' | 'groups';

export default function RolesAndGroupsTab() {
  const { roles, groups, loading, error, deleteRole, deleteGroup, refetch } = useAdminRolesAndGroups();
  const [view, setView] = useState<View>('roles');

  if (loading) return <div style={{ display:'flex', flexDirection:'column', gap:8 }}>{[1,2,3].map(i => <div key={i} style={{ height:100, background:'rgba(255,255,255,0.04)', borderRadius:8, animation:'pulse 1.5s infinite' }} />)}</div>;
  if (error) return <div style={{ padding:48, textAlign:'center', color:'#f87171', fontSize:14 }}><p>⚠ {error}</p><button onClick={refetch} style={{ marginTop:12, padding:'6px 16px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, color:'#e2e4f0', cursor:'pointer' }}>Retry</button></div>;

  return (
    <div className="rgt-wrapper">
      <div className="rgt-header">
        <div>
          <h2 className="rgt-title">Roles &amp; Groups</h2>
          <p className="rgt-subtitle">Control access levels and team organization</p>
        </div>
        <button className="rgt-add-btn"><Plus size={14} /> New {view === 'roles' ? 'role' : 'group'}</button>
      </div>

      <div className="rgt-tabs">
        <button className={`rgt-tab ${view === 'roles' ? 'rgt-tab--active' : ''}`} onClick={() => setView('roles')}><Shield size={14} /> Roles ({roles.length})</button>
        <button className={`rgt-tab ${view === 'groups' ? 'rgt-tab--active' : ''}`} onClick={() => setView('groups')}><Users size={14} /> Groups ({groups.length})</button>
      </div>

      <div className="rgt-grid">
        {view === 'roles'
          ? roles.map(role => <RoleCard key={role.id} role={role} onDelete={() => deleteRole(role.id)} />)
          : groups.map(group => <GroupCard key={group.id} group={group} onDelete={() => deleteGroup(group.id)} />)
        }
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }
        .rgt-wrapper { display:flex; flex-direction:column; gap:16px; }
        .rgt-header { display:flex; align-items:flex-start; justify-content:space-between; }
        .rgt-title { font-size:18px; font-weight:600; color:#e2e4f0; margin:0 0 4px; }
        .rgt-subtitle { font-size:13px; color:#555870; margin:0; }
        .rgt-add-btn { display:flex; align-items:center; gap:6px; padding:8px 14px; background:rgba(167,139,250,0.15); border:1px solid rgba(167,139,250,0.3); border-radius:8px; color:#a78bfa; font-size:13px; cursor:pointer; }
        .rgt-tabs { display:flex; gap:4px; padding:4px; background:rgba(255,255,255,0.03); border-radius:8px; width:fit-content; }
        .rgt-tab { display:flex; align-items:center; gap:6px; padding:6px 14px; background:none; border:none; border-radius:6px; color:#8b8fa8; font-size:13px; cursor:pointer; }
        .rgt-tab--active { background:rgba(255,255,255,0.08); color:#e2e4f0; }
        .rgt-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:12px; }
        .rgt-card { padding:16px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:10px; display:flex; flex-direction:column; gap:10px; transition:border-color 0.15s; }
        .rgt-card:hover { border-color:rgba(167,139,250,0.2); }
        .rgt-card__header { display:flex; align-items:center; gap:10px; }
        .rgt-card__icon { width:30px; height:30px; border-radius:7px; background:rgba(167,139,250,0.15); display:flex; align-items:center; justify-content:center; color:#a78bfa; flex-shrink:0; }
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
      `}</style>
    </div>
  );
}

function RoleCard({ role, onDelete }: { role: Role; onDelete: () => void }) {
  return (
    <div className="rgt-card">
      <div className="rgt-card__header">
        <div className="rgt-card__icon"><Shield size={14} /></div>
        <div className="rgt-card__meta">
          <span className="rgt-card__name">{role.name}</span>
          <span className="rgt-card__count">{role.userCount} users</span>
        </div>
        <div className="rgt-card__actions">
          <button className="rgt-icon-btn"><Edit2 size={13} /></button>
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

function GroupCard({ group, onDelete }: { group: Group; onDelete: () => void }) {
  return (
    <div className="rgt-card">
      <div className="rgt-card__header">
        <div className="rgt-card__icon"><Users size={14} /></div>
        <div className="rgt-card__meta">
          <span className="rgt-card__name">{group.name}</span>
          <span className="rgt-card__count">{group.members.length} members</span>
        </div>
        <div className="rgt-card__actions">
          <button className="rgt-icon-btn"><Edit2 size={13} /></button>
          <button className="rgt-icon-btn rgt-icon-btn--danger" onClick={onDelete}><Trash2 size={13} /></button>
        </div>
      </div>
      <p className="rgt-card__desc">{group.description}</p>
      <div className="rgt-perms">
        {group.roles.map(r => <span key={r} className="rgt-perm-tag">{r}</span>)}
      </div>
    </div>
  );
}