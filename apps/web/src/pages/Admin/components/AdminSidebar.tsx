import { Users, Shield, Activity, Settings, ChevronRight, LayoutDashboard } from 'lucide-react';

export type AdminTab = 'users' | 'roles' | 'monitoring' | 'settings';

interface AdminSidebarProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
}

const navItems: { id: AdminTab; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'users',      label: 'User Management', icon: Users,    description: 'Manage accounts & access' },
  { id: 'roles',      label: 'Roles & Groups',  icon: Shield,   description: 'Permissions & teams' },
  { id: 'monitoring', label: 'Monitoring',       icon: Activity, description: 'Logs & system health' },
  { id: 'settings',   label: 'System Settings', icon: Settings, description: 'App configuration' },
];

export default function AdminSidebar({ activeTab, onTabChange }: AdminSidebarProps) {
  return (
    <aside className="admin-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <LayoutDashboard size={18} />
          <span>Admin Panel</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(({ id, label, icon: Icon, description }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              className={`nav-item ${isActive ? 'nav-item--active' : ''}`}
              onClick={() => onTabChange(id)}
            >
              <div className="nav-item__icon"><Icon size={16} /></div>
              <div className="nav-item__content">
                <span className="nav-item__label">{label}</span>
                <span className="nav-item__desc">{description}</span>
              </div>
              {isActive && <ChevronRight size={14} className="nav-item__arrow" />}
            </button>
          );
        })}
      </nav>

      <style>{`
        .admin-sidebar {
          width: 220px; min-height: 100%; background: #0f1117;
          border-right: 1px solid rgba(255,255,255,0.07);
          display: flex; flex-direction: column; flex-shrink: 0;
        }
        .sidebar-header { padding: 20px 16px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .sidebar-logo { display:flex; align-items:center; gap:8px; color:#a78bfa; font-size:13px; font-weight:600; letter-spacing:0.02em; }
        .sidebar-nav { padding:12px 8px; display:flex; flex-direction:column; gap:2px; }
        .nav-item {
          width:100%; display:flex; align-items:center; gap:10px; padding:10px;
          border-radius:8px; border:none; background:transparent; cursor:pointer;
          text-align:left; transition:background 0.15s; color:#8b8fa8;
        }
        .nav-item:hover { background:rgba(255,255,255,0.05); color:#c4c7d9; }
        .nav-item--active { background:rgba(167,139,250,0.12); color:#a78bfa; }
        .nav-item__icon {
          display:flex; align-items:center; justify-content:center;
          width:28px; height:28px; border-radius:6px;
          background:rgba(255,255,255,0.05); flex-shrink:0;
        }
        .nav-item--active .nav-item__icon { background:rgba(167,139,250,0.2); }
        .nav-item__content { flex:1; min-width:0; }
        .nav-item__label { display:block; font-size:13px; font-weight:500; line-height:1.3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .nav-item__desc  { display:block; font-size:11px; opacity:0.6; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .nav-item__arrow { flex-shrink:0; opacity:0.6; }
      `}</style>
    </aside>
  );
}