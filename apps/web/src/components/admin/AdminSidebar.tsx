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
    <aside className="w-[220px] min-h-full bg-[#0f1117] border-r border-white/[0.07] flex flex-col shrink-0">
      <div className="px-4 pt-5 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 text-violet-400 text-[13px] font-semibold tracking-wide">
          <LayoutDashboard size={18} />
          <span>Admin Panel</span>
        </div>
      </div>

      <nav className="p-3 px-2 flex flex-col gap-0.5">
        {navItems.map(({ id, label, icon: Icon, description }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg border-none cursor-pointer text-left transition-colors duration-150 ${
                isActive
                  ? 'bg-violet-400/[0.12] text-violet-400'
                  : 'bg-transparent text-[#8b8fa8] hover:bg-white/5 hover:text-[#c4c7d9]'
              }`}
              onClick={() => onTabChange(id)}
            >
              <div className={`flex items-center justify-center w-7 h-7 rounded-md shrink-0 ${
                isActive ? 'bg-violet-400/20' : 'bg-white/5'
              }`}>
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-[13px] font-medium leading-tight whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>
                <span className="block text-[11px] opacity-60 whitespace-nowrap overflow-hidden text-ellipsis">{description}</span>
              </div>
              {isActive && <ChevronRight size={14} className="shrink-0 opacity-60" />}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}