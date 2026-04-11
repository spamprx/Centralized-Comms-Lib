import type { ElementType } from "react";
import { Users, Shield, Activity, Settings, ChevronRight, LayoutDashboard } from "lucide-react";

export type AdminTab = "users" | "roles" | "monitoring" | "settings";

interface AdminSidebarProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
}

const navItems: {
  id: AdminTab;
  label: string;
  icon: ElementType;
  description: string;
}[] = [
  { id: "users", label: "User Management", icon: Users, description: "Manage accounts & access" },
  { id: "roles", label: "Roles & Groups", icon: Shield, description: "Permissions & teams" },
  { id: "monitoring", label: "Monitoring", icon: Activity, description: "Logs & system health" },
  { id: "settings", label: "System Settings", icon: Settings, description: "App configuration" },
];

export default function AdminSidebar({ activeTab, onTabChange }: AdminSidebarProps) {
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-app-border bg-app-bg-subtle md:h-full md:w-[220px] md:border-b-0 md:border-r">
      <div className="border-b border-app-border px-4 pb-3 pt-4 md:pb-4 md:pt-5">
        <div className="flex items-center gap-2 text-[13px] font-semibold tracking-wide text-app-accent">
          <LayoutDashboard size={18} aria-hidden />
          <span>Admin panel</span>
        </div>
      </div>

      <nav
        className="flex gap-1 overflow-x-auto p-2 md:flex-col md:gap-0.5"
        aria-label="Admin sections"
      >
        {navItems.map(({ id, label, icon: Icon, description }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              className={`flex min-w-[10.5rem] shrink-0 cursor-pointer items-center gap-2.5 rounded-app-md border-none p-2.5 text-left transition-colors duration-150 md:min-w-0 ${
                isActive
                  ? "bg-app-accent-muted text-app-accent-hover"
                  : "bg-transparent text-app-muted hover:bg-app-surface-hover hover:text-app-text"
              }`}
              onClick={() => onTabChange(id)}
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-app-md ${
                  isActive ? "bg-app-accent/25" : "bg-app-surface"
                }`}
              >
                <Icon size={16} aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium leading-tight">{label}</span>
                <span className="hidden truncate text-[11px] opacity-70 md:block">{description}</span>
              </div>
              {isActive ? (
                <ChevronRight size={14} className="hidden shrink-0 opacity-60 md:block" aria-hidden />
              ) : null}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
