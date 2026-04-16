import { useMemo, useState } from 'react';
// import { Plus } from 'lucide-react';
import SearchAndFilterBar from './SearchAndFilterBar';
import UsersTable from './UsersTable';
// import UserModal from './UserModal'; // next sprint: invite / row actions
import { useAdminUsers, useAdminRolesAndGroups } from '../../hooks/useAdmin';
import { useTwoStepAdminConfirm } from './useTwoStepAdminConfirm';

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
    // createUser, // next sprint: “Invite user”
    bulkSetActive,
  } = useAdminUsers({
    role: 'all',
    group: 'all',
    accountStatus: 'all',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const { groups } = useAdminRolesAndGroups();
  const [rowActionError, setRowActionError] = useState<string | null>(null);
  const { promptTwoStep, dialog: twoStepDialog } = useTwoStepAdminConfirm();

  const groupLookup = useMemo(
    () => Object.fromEntries(groups.map((g) => [g.id, g.name])),
    [groups],
  );

  /*
   * ─── Invite user (next sprint) ─────────────────────────────────────────
   * const [showInviteModal, setShowInviteModal] = useState(false);
   * const handleInviteUser = async (data: UserFormPayload) => { ... createUser ... };
   */

  const handleBulkDeactivate = async (ids: string[]): Promise<boolean> => {
    setRowActionError(null);
    const ok = await promptTwoStep({
      title: 'Deactivate accounts',
      body1: `${ids.length} active account(s) will be set to inactive.`,
      body2: 'Those users will not be able to sign in or use the API until reactivated.',
      confirm2: 'Deactivate',
    });
    if (!ok) return false;
    try {
      await bulkSetActive(ids, false);
      await refetch();
      return true;
    } catch (e) {
      setRowActionError(e instanceof Error ? e.message : 'Bulk deactivate failed');
      return false;
    }
  };

  const handleBulkActivate = async (ids: string[]): Promise<boolean> => {
    setRowActionError(null);
    const ok = await promptTwoStep({
      title: 'Activate accounts',
      body1: `${ids.length} inactive account(s) will be set to active.`,
      body2: 'Those users will be able to sign in again with their existing password.',
      confirm2: 'Activate',
    });
    if (!ok) return false;
    try {
      await bulkSetActive(ids, true);
      await refetch();
      return true;
    } catch (e) {
      setRowActionError(e instanceof Error ? e.message : 'Bulk activate failed');
      return false;
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
        {/*
        <button
          type="button"
          className="admin-glass-button inline-flex items-center justify-center gap-2 self-start rounded-app-lg border border-app-accent/25 bg-app-accent-muted/40 px-4 py-2.5 text-[13px] font-semibold text-app-accent shadow-[0_0_24px_-10px_rgba(147,124,248,0.45)] sm:self-auto"
          onClick={() => setShowInviteModal(true)}
        >
          <Plus size={15} strokeWidth={2} /> Invite user
        </button>
        */}
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
        onBulkDeactivate={handleBulkDeactivate}
        onBulkActivate={handleBulkActivate}
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

      {/*
      {showInviteModal && (
        <UserModal
          groups={groups.map((g) => ({ id: g.id, name: g.name }))}
          roles={roleOptions}
          onClose={() => setShowInviteModal(false)}
          onSave={handleInviteUser}
        />
      )}
      */}
    </div>
  );
}
