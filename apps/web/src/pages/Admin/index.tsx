import { useState } from 'react';
import AdminSidebar, { type AdminTab } from './components/AdminSidebar';
import UserManagementTab from './tabs/UserManagementTab';
import RolesAndGroupsTab from './tabs/RolesAndGroupsTab';
import MonitoringTab from './tabs/MonitoringTab';
import SystemSettingsTab from './tabs/SystemSettingsTab';

export default function AdminPage() {
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
    <div className="admin-page">
      <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="admin-main">
        <div className="admin-content">
          {renderTab()}
        </div>
      </main>

      <style>{`
        .admin-page {
          display: flex;
          height: 100vh;
          background: #0b0d14;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color: #e2e4f0;
          overflow: hidden;
        }
        .admin-main {
          flex: 1;
          overflow-y: auto;
          min-width: 0;
        }
        .admin-content {
          padding: 24px;
          max-width: 1200px;
        }
      `}</style>
    </div>
  );
}