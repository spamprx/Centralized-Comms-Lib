import Slot from "../components/ui/Slot";

export default function DashboardLayout() {
  return (
    <div className="flex min-h-screen">
      <Slot name="Sidebar" className="w-64 shrink-0" />
      <main className="flex-1 overflow-auto p-6">
        <Slot name="DashboardHeader" className="mb-6 h-16 w-full" />
        <div className="mb-6 flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Slot key={i} name="StatCard" className="h-24 min-w-[12rem] flex-1" />
          ))}
        </div>
        <div className="mb-6 flex gap-6">
          <Slot name="QuickActionsPanel" className="min-h-[12rem] flex-1" />
          <Slot name="RecentActivityFeed" className="min-h-[12rem] w-80 shrink-0" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Slot name="PendingItemsList" className="min-h-[16rem]" />
          <Slot name="NotificationsSummary" className="min-h-[16rem]" />
        </div>
      </main>
    </div>
  );
}
