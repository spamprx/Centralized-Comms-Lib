import { useState } from 'react';
import { Plus } from 'lucide-react';
import SearchAndFilterBar from './SearchAndFilterBar';
import UsersTable from './UsersTable';
import UserModal from './UserModal';
import { useAdminUsers, useAdminRolesAndGroups } from '../../hooks/useAdmin';
import { adminUserService } from '../../services/adminService';
import type { User } from '../../types/admin';

export default function UserManagementTab() {
  const {
    users, loading, error, filters, pagination,
    setFilters, setPagination, refetch,
    createUser, deleteUser, bulkDelete, updateStatus, updateUser,
  } = useAdminUsers({ role: 'all', status: 'all', group: 'all', sortBy: 'createdAt', sortOrder: 'desc' });

  const { groups } = useAdminRolesAndGroups();
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showPasswordResetToast, setShowPasswordResetToast] = useState(false);

  const handleInviteUser = async (data: Omit<User, 'id' | 'createdAt' | 'lastActive'>) => {
    await createUser(data);
    refetch();
  };

  const handleUpdateUser = async (data: Omit<User, 'id' | 'createdAt' | 'lastActive'>) => {
    if (editingUser) {
      await updateUser(editingUser.id, data);
      refetch();
    }
  };

  const handleResetPassword = async (id: string) => {
    await adminUserService.resetUserPassword(id);
    setShowPasswordResetToast(true);
    setTimeout(() => setShowPasswordResetToast(false), 3000);
  };

  if (error) return (
    <div className="flex flex-col items-center gap-3 p-12 text-red-400 text-sm">
      <p>⚠ {error}</p>
      <button onClick={refetch} className="px-4 py-1.5 admin-glass-button rounded-lg text-app-text">Retry</button>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-app-text mb-1">Users</h2>
          <p className="text-[13px] text-app-faint m-0">Manage accounts, roles, and permissions</p>
        </div>
        <button
          className="flex items-center gap-1.5 px-3.5 py-2 admin-glass-button rounded-xl text-app-accent text-[13px] font-medium"
          onClick={() => setShowInviteModal(true)}
        >
          <Plus size={14} /> Invite user
        </button>
      </div>

      <SearchAndFilterBar 
        filters={filters} 
        onFilterChange={setFilters} 
        totalResults={pagination.total} 
        loading={loading}
        groups={groups.map(g => ({ id: g.id, name: g.name }))}
      />

      <UsersTable
        users={users}
        loading={loading}
        onEdit={setEditingUser}
        onDelete={deleteUser}
        onStatusChange={updateStatus}
        onBulkDelete={bulkDelete}
        onResetPassword={handleResetPassword}
      />

      {pagination.total > pagination.limit && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            className="px-4 py-2 admin-glass-button rounded-lg text-app-muted text-[13px] disabled:opacity-30 disabled:cursor-not-allowed"
            disabled={pagination.page === 1}
            onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
          >
            ← Prev
          </button>
          <span className="text-[13px] text-app-faint">
            Page {pagination.page} of {Math.ceil(pagination.total / pagination.limit)}
          </span>
          <button
            className="px-4 py-2 admin-glass-button rounded-lg text-app-muted text-[13px] disabled:opacity-30 disabled:cursor-not-allowed"
            disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
            onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
          >
            Next →
          </button>
        </div>
      )}

      {showInviteModal && (
        <UserModal
          groups={groups.map(g => ({ id: g.id, name: g.name }))}
          onClose={() => setShowInviteModal(false)}
          onSave={handleInviteUser}
        />
      )}

      {editingUser && (
        <UserModal
          user={editingUser}
          groups={groups.map(g => ({ id: g.id, name: g.name }))}
          onClose={() => setEditingUser(null)}
          onSave={handleUpdateUser}
        />
      )}

      {showPasswordResetToast && (
        <div className="fixed bottom-6 right-6 admin-glass rounded-xl px-5 py-3 text-emerald-400 text-[13px] shadow-app-soft admin-modal-enter">
          <span>✓ Password reset email sent</span>
        </div>
      )}
    </div>
  );
}