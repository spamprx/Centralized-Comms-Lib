import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import SearchAndFilterBar from './SearchAndFilterBar';
import UsersTable from './UsersTable';
import UserModal from './UserModal';
import { useAdminUsers, useAdminRolesAndGroups, type UserFormPayload } from '../../hooks/useAdmin';
import { adminUserService } from '../../services/adminService';
import type { User } from '../../types/admin';
import { useTwoStepAdminConfirm } from './useTwoStepAdminConfirm';
import { AdminActionCancelled } from './adminActionCancelled';

export default function UserManagementTab() {
  const {
    users,
    loading,
    error,
    filters,
    pagination,
    setFilters,
    setPagination,
    refetch,
    createUser,
    deleteUser,
    bulkDelete,
    updateStatus,
    updateUser,
  } = useAdminUsers({
    role: 'all',
    status: 'all',
    group: 'all',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const { groups, roles } = useAdminRolesAndGroups();
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showPasswordResetToast, setShowPasswordResetToast] = useState(false);
  const [passwordResetMessage, setPasswordResetMessage] = useState('');
  const [rowActionError, setRowActionError] = useState<string | null>(null);
  const { promptTwoStep, dialog: twoStepDialog } = useTwoStepAdminConfirm();

  const groupLookup = useMemo(
    () => Object.fromEntries(groups.map((g) => [g.id, g.name])),
    [groups],
  );

  const roleOptions = useMemo(() => roles.map((r) => ({ id: r.id, name: r.name })), [roles]);

  const handleInviteUser = async (data: UserFormPayload) => {
    const ok = await promptTwoStep({
      title: 'Invite user',
      body1: `You are about to create an account for ${data.email}.`,
      body2:
        'Final confirmation: the user will be stored in the database with the role and groups you selected.',
      confirm2: 'Create user',
    });
    if (!ok) throw new AdminActionCancelled();
    await createUser(data);
    refetch();
  };

  const handleUpdateUser = async (data: UserFormPayload) => {
    if (!editingUser) return;
    const ok = await promptTwoStep({
      title: 'Update user',
      body1: `Save changes for ${editingUser.email}?`,
      body2:
        'Final confirmation: profile, role, status, and group memberships will be updated on the server.',
      confirm2: 'Save changes',
    });
    if (!ok) throw new AdminActionCancelled();
    await updateUser(editingUser.id, data);
    refetch();
  };

  const handleDeleteUser = async (id: string) => {
    setRowActionError(null);
    const u = users.find((x) => x.id === id);
    const label = u ? `${u.name} (${u.email})` : id;
    const ok = await promptTwoStep({
      title: 'Deactivate user',
      body1: `You are about to deactivate ${label}. They will no longer be able to sign in.`,
      body2:
        'Final confirmation: this account will be marked inactive. You can still see audit history for past actions.',
      confirm2: 'Deactivate',
    });
    if (!ok) return;
    try {
      await deleteUser(id);
      await refetch();
    } catch (e) {
      setRowActionError(e instanceof Error ? e.message : 'Failed to deactivate user');
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    setRowActionError(null);
    const ok = await promptTwoStep({
      title: 'Bulk deactivate users',
      body1: `You selected ${ids.length} user(s) to deactivate.`,
      body2: 'Final confirmation: all selected accounts will be marked inactive.',
      confirm2: 'Deactivate all',
    });
    if (!ok) return;
    try {
      await bulkDelete(ids);
      await refetch();
    } catch (e) {
      setRowActionError(e instanceof Error ? e.message : 'Bulk deactivate failed');
    }
  };

  const handleStatusChange = async (id: string, status: User['status']) => {
    setRowActionError(null);
    const u = users.find((x) => x.id === id);
    const ok = await promptTwoStep({
      title: 'Change account status',
      body1: `Change status for ${u?.email ?? id} to “${status}”?`,
      body2: 'Final confirmation: this updates whether the account can sign in.',
      confirm2: 'Update status',
    });
    if (!ok) return;
    try {
      await updateStatus(id, status);
      await refetch();
    } catch (e) {
      setRowActionError(e instanceof Error ? e.message : 'Failed to update status');
    }
  };

  const handleResetPassword = async (id: string) => {
    setRowActionError(null);
    const u = users.find((x) => x.id === id);
    const ok = await promptTwoStep({
      title: 'Password reset',
      body1: `Trigger a password reset flow for ${u?.email ?? id}?`,
      body2:
        'Final confirmation: the server will attempt to send reset instructions if outbound email is configured.',
      confirm2: 'Send reset',
    });
    if (!ok) return;
    try {
      const res = await adminUserService.resetUserPassword(id);
      const msg = res.data.emailSent
        ? 'If this account exists, a reset email was sent.'
        : (res.data.message ?? 'Password reset is not configured for this environment.');
      setPasswordResetMessage(msg);
      setShowPasswordResetToast(true);
      setTimeout(() => setShowPasswordResetToast(false), 5000);
    } catch (e) {
      setRowActionError(e instanceof Error ? e.message : 'Password reset request failed');
    }
  };

  if (error)
    return (
      <div className="admin-glass relative flex flex-col items-center gap-4 overflow-hidden rounded-app-xl p-12 text-center">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-400/30 to-transparent" />
        <p className="m-0 max-w-md text-sm font-medium text-red-300">{error}</p>
        <button
          type="button"
          onClick={refetch}
          className="admin-glass-button rounded-app-lg px-5 py-2.5 text-[13px] font-semibold text-app-text"
        >
          Retry
        </button>
      </div>
    );

  return (
    <div className="relative flex flex-col gap-6">
      {twoStepDialog}

      {rowActionError && (
        <div className="relative flex items-center justify-between gap-3 overflow-hidden rounded-app-xl border border-red-400/25 bg-gradient-to-r from-red-500/12 to-red-500/5 px-4 py-3 text-[13px] text-red-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md">
          <span className="font-medium">{rowActionError}</span>
          <button
            type="button"
            className="shrink-0 rounded-app-md border border-white/[0.1] bg-white/[0.06] px-3 py-1.5 text-[12px] font-semibold text-app-muted transition-colors hover:bg-white/[0.1] hover:text-app-text"
            onClick={() => setRowActionError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="mb-1 text-lg font-semibold tracking-tight text-app-text">Users</h2>
          <p className="m-0 text-[13px] text-app-muted">Manage accounts, roles, and permissions</p>
        </div>
        <button
          type="button"
          className="admin-glass-button inline-flex items-center justify-center gap-2 self-start rounded-app-lg border border-app-accent/25 bg-app-accent-muted/40 px-4 py-2.5 text-[13px] font-semibold text-app-accent shadow-[0_0_24px_-10px_rgba(147,124,248,0.45)] sm:self-auto"
          onClick={() => setShowInviteModal(true)}
        >
          <Plus size={15} strokeWidth={2} /> Invite user
        </button>
      </div>

      <SearchAndFilterBar
        filters={filters}
        onFilterChange={setFilters}
        totalResults={pagination.total}
        loading={loading}
        groups={groups.map((g) => ({ id: g.id, name: g.name }))}
      />

      <UsersTable
        users={users}
        loading={loading}
        groupLookup={groupLookup}
        onEdit={setEditingUser}
        onDelete={handleDeleteUser}
        onStatusChange={handleStatusChange}
        onBulkDelete={handleBulkDelete}
        onResetPassword={handleResetPassword}
      />

      {pagination.total > pagination.limit && (
        <div className="admin-glass flex items-center justify-center gap-4 overflow-hidden rounded-app-xl px-4 py-3">
          <button
            type="button"
            className="admin-glass-button rounded-app-md px-4 py-2 text-[13px] font-medium text-app-muted disabled:cursor-not-allowed disabled:opacity-35"
            disabled={pagination.page === 1}
            onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
          >
            ← Prev
          </button>
          <span className="text-[13px] font-semibold tabular-nums text-app-muted">
            Page {pagination.page} of {Math.ceil(pagination.total / pagination.limit)}
          </span>
          <button
            type="button"
            className="admin-glass-button rounded-app-md px-4 py-2 text-[13px] font-medium text-app-muted disabled:cursor-not-allowed disabled:opacity-35"
            disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
            onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
          >
            Next →
          </button>
        </div>
      )}

      {showInviteModal && (
        <UserModal
          groups={groups.map((g) => ({ id: g.id, name: g.name }))}
          roles={roleOptions}
          onClose={() => setShowInviteModal(false)}
          onSave={handleInviteUser}
        />
      )}

      {editingUser && (
        <UserModal
          user={editingUser}
          groups={groups.map((g) => ({ id: g.id, name: g.name }))}
          roles={roleOptions}
          onClose={() => setEditingUser(null)}
          onSave={handleUpdateUser}
        />
      )}

      {showPasswordResetToast && (
        <div className="admin-modal-enter admin-modal-panel fixed bottom-6 right-6 z-[1300] max-w-sm rounded-app-xl px-5 py-3.5 text-[13px] font-medium text-emerald-300 shadow-app-glow">
          <span>{passwordResetMessage}</span>
        </div>
      )}
    </div>
  );
}
