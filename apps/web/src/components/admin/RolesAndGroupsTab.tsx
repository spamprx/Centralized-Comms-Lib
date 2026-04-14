import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Trash2, Users, Shield, Edit2 } from 'lucide-react';
import { useAdminRolesAndGroups, useAdminUsers } from '../../hooks/useAdmin';
import RoleModal from './RoleModal';
import GroupModal from './GroupModal';
import type { Role, Group } from '../../types/admin';
import { useTwoStepAdminConfirm } from './useTwoStepAdminConfirm';
import { AdminActionCancelled } from './adminActionCancelled';

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
  const { roles, groups, loading, error, deleteRole, deleteGroup, refetch, createRole, updateRole, createGroup, updateGroup } =
    useAdminRolesAndGroups();
  const { users } = useAdminUsers();
  const { promptTwoStep, dialog: twoStepDialog } = useTwoStepAdminConfirm();
  const [view, setView] = useState<View>('roles');
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showDeleteRoleConfirm, setShowDeleteRoleConfirm] = useState<{ id: string; name: string; isSystem?: boolean } | null>(
    null,
  );
  const [roleActionError, setRoleActionError] = useState<string | null>(null);

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

  useEffect(() => {
    updateIndicator();
  }, [updateIndicator, view]);

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
    const ok = await promptTwoStep({
      title: 'Create group',
      body1: `Create the group “${data.name}” with ${data.members.length} member(s)?`,
      body2: 'Final confirmation: the group will be saved and memberships applied on the server.',
      confirm2: 'Create group',
    });
    if (!ok) throw new AdminActionCancelled();
    await createGroup(data);
    refetch();
  };

  const handleUpdateGroup = async (data: Omit<Group, 'id' | 'createdAt'>) => {
    if (!editingGroup) return;
    const ok = await promptTwoStep({
      title: 'Update group',
      body1: `Save changes to “${editingGroup.name}”?`,
      body2: 'Final confirmation: name, description, and member list will be updated on the server.',
      confirm2: 'Save group',
    });
    if (!ok) throw new AdminActionCancelled();
    await updateGroup(editingGroup.id, data);
    refetch();
  };

  const confirmDeleteGroup = async (group: Group) => {
    const ok = await promptTwoStep({
      title: 'Delete group',
      body1: `You are about to delete the group “${group.name}”. Members will lose this group label (not their accounts).`,
      body2: 'Final confirmation: this cannot be undone.',
      confirm2: 'Delete group',
    });
    if (!ok) return;
    await deleteGroup(group.id);
    refetch();
  };

  const handleDeleteRole = async () => {
    if (!showDeleteRoleConfirm) return;
    setRoleActionError(null);
    try {
      await deleteRole(showDeleteRoleConfirm.id);
      setShowDeleteRoleConfirm(null);
      await refetch();
    } catch (e) {
      setRoleActionError(e instanceof Error ? e.message : 'Failed to delete role');
    }
  };

  const openNewRole = () => {
    setRoleActionError(null);
    setEditingGroup(null);
    setShowGroupModal(false);
    setEditingRole(null);
    setShowRoleModal(true);
  };

  const openEditRole = (role: Role) => {
    setRoleActionError(null);
    setEditingGroup(null);
    setShowGroupModal(false);
    setEditingRole(role);
    setShowRoleModal(true);
  };

  const openNewGroup = () => {
    setRoleActionError(null);
    setEditingRole(null);
    setShowRoleModal(false);
    setEditingGroup(null);
    setShowGroupModal(true);
  };

  const openEditGroup = (group: Group) => {
    setRoleActionError(null);
    setEditingRole(null);
    setShowRoleModal(false);
    setEditingGroup(group);
    setShowGroupModal(true);
  };

  const closeRoleModal = () => {
    setShowRoleModal(false);
    setEditingRole(null);
  };

  const closeGroupModal = () => {
    setShowGroupModal(false);
    setEditingGroup(null);
  };

  if (loading)
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[120px] rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />
        ))}
      </div>
    );
  if (error)
    return (
      <div className="p-12 text-center text-red-400 text-sm">
        <p>⚠ {error}</p>
        <button onClick={refetch} className="mt-3 px-4 py-1.5 admin-glass-button rounded-lg text-app-text">
          Retry
        </button>
      </div>
    );

  return (
    <div className="flex flex-col gap-5">
      {twoStepDialog}

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-app-text mb-1">Roles &amp; Groups</h2>
          <p className="text-[13px] text-app-faint m-0">Control access levels and team organization</p>
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 px-3.5 py-2 admin-glass-button rounded-xl text-app-accent text-[13px] font-medium"
          onClick={() => (view === 'roles' ? openNewRole() : openNewGroup())}
        >
          <Plus size={14} /> New {view === 'roles' ? 'role' : 'group'}
        </button>
      </div>

      <div ref={toggleContainerRef} className="admin-pill-toggle w-fit">
        <div className="admin-pill-toggle-indicator" style={{ left: indicatorStyle.left, width: indicatorStyle.width }} />
        <button
          ref={(el) => {
            btnRefs.current[0] = el;
          }}
          type="button"
          data-active={view === 'roles'}
          onClick={() => setView('roles')}
          className="flex items-center gap-1.5"
        >
          <Shield size={14} /> Roles ({roles.length})
        </button>
        <button
          ref={(el) => {
            btnRefs.current[1] = el;
          }}
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
                onEdit={() => openEditRole(role)}
                onDelete={() => {
                  setRoleActionError(null);
                  setShowDeleteRoleConfirm({ id: role.id, name: role.name, isSystem: role.isSystem });
                }}
              />
            ))
          : groups.map((group, idx) => (
              <GroupCard
                key={group.id}
                group={group}
                index={idx}
                onEdit={() => openEditGroup(group)}
                onDelete={() => void confirmDeleteGroup(group)}
              />
            ))}
      </div>

      {showRoleModal && (
        <RoleModal role={editingRole} onClose={closeRoleModal} onSave={editingRole ? handleUpdateRole : handleCreateRole} />
      )}

      {showGroupModal && (
        <GroupModal
          group={editingGroup}
          users={users.map((u) => ({ id: u.id, name: u.name, email: u.email }))}
          roles={roles.map((r) => ({ id: r.id, name: r.name }))}
          onClose={closeGroupModal}
          onSave={editingGroup ? handleUpdateGroup : handleCreateGroup}
        />
      )}

      {showDeleteRoleConfirm && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 backdrop-blur-sm admin-modal-backdrop"
          onClick={() => {
            setShowDeleteRoleConfirm(null);
            setRoleActionError(null);
          }}
        >
          <div
            className="admin-glass admin-modal-enter w-full max-w-[400px] rounded-2xl p-6 shadow-app-soft"
            style={{ background: 'rgba(15, 20, 32, 0.9)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="m-0 mb-3 text-base font-semibold text-app-text">Delete role</h3>
            {showDeleteRoleConfirm.isSystem ? (
              <p className="m-0 mb-5 text-[13px] leading-relaxed text-amber-200/90">
                System roles cannot be deleted. Remove the <strong className="text-app-text">Admin</strong> assignment from
                users in User Management if you need to change access.
              </p>
            ) : (
              <p className="m-0 mb-5 text-[13px] leading-relaxed text-app-muted">
                Are you sure you want to delete <strong className="text-app-text">{showDeleteRoleConfirm.name}</strong>? This
                cannot be undone.
              </p>
            )}
            {roleActionError ? (
              <p className="mb-4 rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-[13px] text-red-300">
                {roleActionError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                className="rounded-xl px-5 py-2.5 text-[13px] text-app-muted admin-glass-button"
                onClick={() => {
                  setShowDeleteRoleConfirm(null);
                  setRoleActionError(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cursor-pointer rounded-xl border border-red-400/20 bg-red-400/10 px-5 py-2.5 text-[13px] font-medium text-red-400 admin-btn-lift hover:bg-red-400/15 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={Boolean(showDeleteRoleConfirm.isSystem)}
                onClick={() => void handleDeleteRole()}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RoleCard({ role, index, onEdit, onDelete }: { role: Role; index: number; onEdit: () => void; onDelete: () => void }) {
  const topColor = ROLE_TOP_BORDER[role.name] || '#6b7280';
  const memberCount = role.userCount;
  const isSystem = Boolean(role.isSystem);

  return (
    <div
      className="admin-glass admin-card-hover group relative flex flex-col gap-3 rounded-xl p-4 admin-row-enter"
      style={{ '--row-index': index, borderTop: `2px solid ${topColor}` } as React.CSSProperties}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `${topColor}15`, color: topColor }}
        >
          <Shield size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-app-text">{role.name}</span>
          <div className="mt-0.5 flex items-center">
            {Array.from({ length: Math.min(memberCount, 4) }).map((_, i) => (
              <div
                key={i}
                className="h-4 w-4 rounded-full border border-app-bg-subtle"
                style={{
                  background: `hsl(${(i * 71 + 180) % 360}, 50%, 50%)`,
                  marginLeft: i === 0 ? 0 : -4,
                  zIndex: 4 - i,
                }}
              />
            ))}
            {memberCount > 4 && <span className="ml-1 text-[10px] text-app-faint">+{memberCount - 4}</span>}
            {memberCount <= 4 && (
              <span className="ml-1.5 text-[10px] text-app-faint">
                {memberCount} user{memberCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <div className="relative z-10 flex shrink-0 gap-0.5">
          <button
            type="button"
            aria-label={`Edit role ${role.name}`}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/[0.06] bg-app-surface/80 text-app-muted hover:bg-app-surface-hover hover:text-app-text md:opacity-90"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Edit2 size={14} />
          </button>
          <button
            type="button"
            aria-label={isSystem ? `Cannot delete system role ${role.name}` : `Delete role ${role.name}`}
            title={isSystem ? 'System roles cannot be deleted' : 'Delete role'}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-app-surface/80 md:opacity-90 ${
              isSystem
                ? 'cursor-not-allowed text-app-faint opacity-40'
                : 'cursor-pointer text-app-muted hover:bg-red-400/15 hover:text-red-400'
            }`}
            disabled={isSystem}
            onClick={(e) => {
              e.stopPropagation();
              if (!isSystem) onDelete();
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <p className="m-0 text-[12px] leading-relaxed text-app-faint">{role.description}</p>
      <div className="flex flex-wrap gap-1">
        {role.permissions.slice(0, 4).map((p) => (
          <span
            key={p.id}
            className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] tracking-tight text-app-muted"
          >
            {p.resource}:{p.action}
          </span>
        ))}
        {role.permissions.length > 4 && (
          <span className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-app-faint">
            +{role.permissions.length - 4}
          </span>
        )}
      </div>
    </div>
  );
}

function GroupCard({ group, index, onEdit, onDelete }: { group: Group; index: number; onEdit: () => void; onDelete: () => void }) {
  const memberCount = group.members.length;

  return (
    <div
      className="admin-glass admin-card-hover group relative flex flex-col gap-3 rounded-xl p-4 admin-row-enter"
      style={{ '--row-index': index, borderTop: '2px solid #38bdf8' } as React.CSSProperties}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-400/10 text-sky-400">
          <Users size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-app-text">{group.name}</span>
          <div className="mt-0.5 flex items-center">
            {Array.from({ length: Math.min(memberCount, 4) }).map((_, i) => (
              <div
                key={i}
                className="h-4 w-4 rounded-full border border-app-bg-subtle"
                style={{
                  background: `hsl(${nameToHue(`member-${i}-${group.id}`)}, 50%, 50%)`,
                  marginLeft: i === 0 ? 0 : -4,
                  zIndex: 4 - i,
                }}
              />
            ))}
            {memberCount > 4 && <span className="ml-1 text-[10px] text-app-faint">+{memberCount - 4}</span>}
            {memberCount <= 4 && (
              <span className="ml-1.5 text-[10px] text-app-faint">
                {memberCount} member{memberCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <div className="relative z-10 flex shrink-0 gap-0.5">
          <button
            type="button"
            aria-label={`Edit group ${group.name}`}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/[0.06] bg-app-surface/80 text-app-muted hover:bg-app-surface-hover hover:text-app-text md:opacity-90"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Edit2 size={14} />
          </button>
          <button
            type="button"
            aria-label={`Delete group ${group.name}`}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/[0.06] bg-app-surface/80 text-app-muted hover:bg-red-400/15 hover:text-red-400 md:opacity-90"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <p className="m-0 text-[12px] leading-relaxed text-app-faint">{group.description}</p>
      <div className="flex flex-wrap gap-1">
        {group.roles.slice(0, 3).map((r) => (
          <span key={r} className="rounded-md bg-sky-400/8 px-2 py-0.5 font-mono text-[10px] text-sky-400">
            {r}
          </span>
        ))}
        {group.roles.length > 3 && (
          <span className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[10px] text-app-faint">+{group.roles.length - 3}</span>
        )}
      </div>
    </div>
  );
}
