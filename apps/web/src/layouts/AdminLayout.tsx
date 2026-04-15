import Slot from '../components/ui/Slot';

export default function AdminLayout() {
  return (
    <div className="relative isolate flex min-h-screen bg-app-bg font-sans text-app-text antialiased app-main-canvas">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -right-20 top-20 h-72 w-72 rounded-full bg-app-accent/10 blur-[90px]" />
      </div>
      <Slot
        name="AdminSidebar"
        className="relative z-[1] w-56 shrink-0 border-r border-white/[0.08] bg-app-bg/75 backdrop-blur-xl"
      />
      <main className="relative z-[1] flex-1 overflow-auto p-6 md:p-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-wrap gap-2 border-b border-white/[0.08] pb-5">
            <Slot name="UserManagementTab" className="h-9 w-24" />
            <Slot name="RolesAndGroupsTab" className="h-9 w-24" />
            <Slot name="MonitoringTab" className="h-9 w-24" />
            <Slot name="SystemSettingsTab" className="h-9 w-24" />
          </div>
          <Slot name="SearchAndFilterBar" className="mb-6 h-10 w-full max-w-md" />
          <div className="admin-glass overflow-hidden rounded-app-xl">
            <Slot name="UsersTable" className="min-h-[28rem] w-full" />
          </div>
        </div>
      </main>
    </div>
  );
}
