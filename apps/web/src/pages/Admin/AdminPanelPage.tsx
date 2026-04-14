import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AdminSidebar, { type AdminTab } from "../../components/admin/AdminSidebar";
import UserManagementTab from "../../components/admin/UserManagementTab";
import RolesAndGroupsTab from "../../components/admin/RolesAndGroupsTab";
import MonitoringTab from "../../components/admin/MonitoringTab";
import SystemSettingsTab from "../../components/admin/SystemSettingsTab";
import { Users, Shield, Activity, Settings } from "lucide-react";

const TAB_META: Record<AdminTab, { label: string; icon: React.ElementType }> = {
  users: { label: "User Management", icon: Users },
  roles: { label: "Roles & Groups", icon: Shield },
  monitoring: { label: "Monitoring", icon: Activity },
  settings: { label: "System Settings", icon: Settings },
};

export default function AdminPanelPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("users");

  const meta = TAB_META[activeTab];
  const TabIcon = meta.icon;

  const renderTab = () => {
    switch (activeTab) {
      case "users":
        return <UserManagementTab />;
      case "roles":
        return <RolesAndGroupsTab />;
      case "monitoring":
        return <MonitoringTab />;
      case "settings":
        return <SystemSettingsTab />;
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col overflow-hidden bg-app-bg font-sans text-app-text md:h-[100dvh] md:flex-row">
      <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Mobile tab bar */}
      <div className="flex md:hidden gap-1 p-2 border-b border-app-border bg-app-bg-subtle overflow-x-auto">
        {(Object.keys(TAB_META) as AdminTab[]).map((tab) => {
          const { label, icon: Icon } = TAB_META[tab];
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border-none text-[13px] shrink-0 transition-colors duration-150 ${
                isActive
                  ? "bg-app-accent-muted text-app-accent-hover"
                  : "bg-transparent text-app-muted"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              <Icon size={14} />
              {label}
            </button>
          );
        })}
      </div>

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1400px] px-app-page py-app-page md:px-app-page-lg md:py-app-page-lg">
          {/* Floating breadcrumb pill */}
          <div className="mb-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full admin-glass text-[13px]">
              <TabIcon size={14} className="text-app-accent" />
              <span className="text-app-muted">{meta.label}</span>
            </div>
          </div>

          {/* Animated tab content */}
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
