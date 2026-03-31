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
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, padding:48, color:'#f87171', fontSize:14 }}>
      <p>⚠ {error}</p>
      <button onClick={refetch} style={{ padding:'6px 16px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, color:'#e2e4f0', cursor:'pointer' }}>Retry</button>
    </div>
  );

  return (
    <div className="umt-wrapper">
      <div className="umt-header">
        <div>
          <h2 className="umt-title">Users</h2>
          <p className="umt-subtitle">Manage accounts, roles, and permissions</p>
        </div>
        <button className="umt-add-btn" onClick={() => setShowInviteModal(true)}><Plus size={14} /> Invite user</button>
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
        <div className="umt-pagination">
          <button className="umt-page-btn" disabled={pagination.page === 1} onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}>← Prev</button>
          <span className="umt-page-info">Page {pagination.page} of {Math.ceil(pagination.total / pagination.limit)}</span>
          <button className="umt-page-btn" disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)} onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}>Next →</button>
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
        <div className="umt-toast">
          <span>✓ Password reset email sent</span>
        </div>
      )}

      <style>{`
        .umt-wrapper { display:flex; flex-direction:column; gap:16px; }
        .umt-header { display:flex; align-items:flex-start; justify-content:space-between; }
        .umt-title { font-size:18px; font-weight:600; color:#e2e4f0; margin:0 0 4px; }
        .umt-subtitle { font-size:13px; color:#555870; margin:0; }
        .umt-add-btn { display:flex; align-items:center; gap:6px; padding:8px 14px; background:rgba(167,139,250,0.15); border:1px solid rgba(167,139,250,0.3); border-radius:8px; color:#a78bfa; font-size:13px; font-weight:500; cursor:pointer; }
        .umt-add-btn:hover { background:rgba(167,139,250,0.25); }
        .umt-pagination { display:flex; align-items:center; justify-content:center; gap:16px; padding-top:8px; }
        .umt-page-btn { padding:6px 14px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:6px; color:#9094ae; font-size:13px; cursor:pointer; }
        .umt-page-btn:disabled { opacity:.3; cursor:not-allowed; }
        .umt-page-info { font-size:13px; color:#555870; }
        .umt-toast {
          position: fixed;
          bottom: 24px;
          right: 24px;
          background: #1a1d29;
          border: 1px solid rgba(52, 211, 153, 0.3);
          border-radius: 8px;
          padding: 12px 20px;
          color: #34d399;
          font-size: 13px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
          animation: slideIn 0.3s ease-out;
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}