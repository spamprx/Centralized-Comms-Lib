import Slot from "../components/ui/Slot";

export default function AdminLayout() {
  return (
    <div className="flex h-screen">
      <Slot name="AdminSidebar" className="w-56 shrink-0" />
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6 flex gap-2 border-b border-gray-700 pb-4">
          <Slot name="UserManagementTab" className="h-9 w-24" />
          <Slot name="RolesAndGroupsTab" className="h-9 w-24" />
          <Slot name="MonitoringTab" className="h-9 w-24" />
          <Slot name="SystemSettingsTab" className="h-9 w-24" />
        </div>
        <Slot name="SearchAndFilterBar" className="mb-6 h-10 w-full max-w-md" />
        <Slot name="UsersTable" className="min-h-[28rem] w-full" />
      </main>
    </div>
  );
}
