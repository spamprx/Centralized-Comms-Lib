import { useState } from 'react';
import AdminSidebar, { type AdminTab } from '../../components/admin/AdminSidebar';
import UserManagementTab from '../../components/admin/UserManagementTab';
import RolesAndGroupsTab from '../../components/admin/RolesAndGroupsTab';
import MonitoringTab from '../../components/admin/MonitoringTab';
import SystemSettingsTab from '../../components/admin/SystemSettingsTab';

export default function AdminPanelPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('users');

  const renderTab = () => {
    switch (activeTab) {
      case 'users':      return <UserManagementTab />;
      case 'roles':      return <RolesAndGroupsTab />;
      case 'monitoring': return <MonitoringTab />;
      case 'settings':   return <SystemSettingsTab />;
    }
  };

  return (
    <div className="flex h-screen bg-[#0b0d14] font-sans text-[#e2e4f0] overflow-hidden">
      <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 overflow-y-auto min-w-0">
        <div className="p-6 max-w-[1400px] mx-auto">
          {renderTab()}
        </div>
      </main>
    </div>
  );
}
