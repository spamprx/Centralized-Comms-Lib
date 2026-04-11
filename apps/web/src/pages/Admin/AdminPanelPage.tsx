import { useState } from "react";
import AdminSidebar, { type AdminTab } from "../../components/admin/AdminSidebar";
import UserManagementTab from "../../components/admin/UserManagementTab";
import RolesAndGroupsTab from "../../components/admin/RolesAndGroupsTab";
import MonitoringTab from "../../components/admin/MonitoringTab";
import SystemSettingsTab from "../../components/admin/SystemSettingsTab";

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
      case "settings":
        return <SystemSettingsTab />;
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col overflow-hidden bg-app-bg font-sans text-app-text md:h-[100dvh] md:flex-row">
      <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1400px] px-app-page py-app-page md:px-app-page-lg md:py-app-page-lg">
          {renderTab()}
        </div>
      </main>
    </div>
  );
}
