import { useState } from 'react';
import { Plus } from 'lucide-react';
import SearchAndFilterBar from '../components/SearchAndFilterBar';
import UsersTable from '../components/UsersTable';
import { useAdminUsers } from '../../../hooks/useAdmin';
import { adminUserService } from '../../../services/adminService';
import type { User } from '../../../types/admin';

export default function UserManagementTab() {
  const {
    users, loading, error, filters, pagination,
    setFilters, setPagination, refetch,
    deleteUser, bulkDelete, updateStatus,
  } = useAdminUsers({ role: 'all', status: 'all', group: 'all', sortBy: 'createdAt', sortOrder: 'desc' });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_editUser, setEditUser] = useState<User | null>(null);

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
        <button className="umt-add-btn"><Plus size={14} /> Invite user</button>
      </div>

      <SearchAndFilterBar filters={filters} onFilterChange={setFilters} totalResults={pagination.total} loading={loading} />

      <UsersTable
        users={users}
        loading={loading}
        onEdit={setEditUser}
        onDelete={deleteUser}
        onStatusChange={updateStatus}
        onBulkDelete={bulkDelete}
        onResetPassword={id => adminUserService.resetUserPassword(id)}
      />

      {pagination.total > pagination.limit && (
        <div className="umt-pagination">
          <button className="umt-page-btn" disabled={pagination.page === 1} onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}>← Prev</button>
          <span className="umt-page-info">Page {pagination.page} of {Math.ceil(pagination.total / pagination.limit)}</span>
          <button className="umt-page-btn" disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)} onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}>Next →</button>
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
      `}</style>
    </div>
  );
}