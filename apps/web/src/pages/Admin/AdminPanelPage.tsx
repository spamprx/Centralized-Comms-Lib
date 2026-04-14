import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Shield, Activity, LayoutDashboard, ChevronLeft } from "lucide-react";
import UserManagementTab from "../../components/admin/UserManagementTab";
import RolesAndGroupsTab from "../../components/admin/RolesAndGroupsTab";
import MonitoringTab from "../../components/admin/MonitoringTab";

export type AdminTab = "users" | "roles" | "monitoring";

const ADMIN_TABS: AdminTab[] = ["users", "roles", "monitoring"];

const TAB_META: Record<AdminTab, { label: string; subtitle: string; icon: React.ElementType }> = {
  users: { label: "Users", subtitle: "Accounts and access", icon: Users },
  roles: { label: "Roles & groups", subtitle: "Permissions and groups", icon: Shield },
  monitoring: { label: "Monitoring", subtitle: "Health and activity", icon: Activity },
};

export default function AdminPanelPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("users");

  const renderTab = () => {
    switch (activeTab) {
      case "users":
        return <UserManagementTab />;
      case "roles":
        return <RolesAndGroupsTab />;
      case "monitoring":
        return <MonitoringTab />;
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col overflow-hidden bg-app-bg font-sans text-app-text md:h-[100dvh]">
      <header className="sticky top-0 z-20 shrink-0 border-b border-app-border bg-app-bg/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-app-page py-3 md:flex-row md:items-center md:justify-between md:gap-4 md:px-app-page-lg md:py-3.5">
          <div className="flex min-w-0 items-center justify-between gap-3 md:justify-start">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl admin-glass">
                <LayoutDashboard size={18} className="text-app-accent" aria-hidden />
              </div>
              <div className="min-w-0">
                <h1 className="text-[15px] font-semibold tracking-tight text-app-text">Admin panel</h1>
                <p className="truncate text-[12px] text-app-muted">{TAB_META[activeTab].subtitle}</p>
              </div>
            </div>
            <Link
              to="/dashboard"
              className="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] text-app-muted no-underline transition-colors hover:bg-app-surface-hover hover:text-app-text md:hidden"
            >
              <ChevronLeft size={16} aria-hidden />
              Dashboard
            </Link>
          </div>

          <nav
            className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto pb-0.5 md:justify-center md:pb-0"
            aria-label="Admin sections"
          >
            {ADMIN_TABS.map((tab) => {
              const { label, icon: Icon } = TAB_META[tab];
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left text-[13px] font-medium transition-all duration-150 ${
                    isActive
                      ? "border-app-accent/35 bg-app-accent-muted text-app-accent-hover shadow-[0_0_0_1px_rgba(147,124,248,0.12)]"
                      : "border-transparent bg-transparent text-app-muted hover:bg-app-surface-hover hover:text-app-text"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      isActive ? "bg-app-accent/20 text-app-accent-hover" : "text-app-muted"
                    }`}
                  >
                    <Icon size={16} aria-hidden />
                  </span>
                  <span className="whitespace-nowrap">{label}</span>
                </button>
              );
            })}
          </nav>

          <Link
            to="/dashboard"
            className="hidden shrink-0 items-center gap-1.5 rounded-xl border border-app-border bg-app-surface/40 px-3 py-2 text-[13px] font-medium text-app-muted no-underline transition-colors hover:border-app-accent/25 hover:bg-app-surface-hover hover:text-app-text md:inline-flex"
          >
            <ChevronLeft size={16} aria-hidden />
            Dashboard
          </Link>
        </div>
      </header>

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1400px] px-app-page py-app-page md:px-app-page-lg md:py-app-page-lg">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              {renderTab()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
