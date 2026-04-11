import { useDashboard } from "../hooks/useDashboard";
import {
  StatCardsRow,
  QuickActionsPanel,
  RecentActivityFeed,
  PendingItemsList,
  NotificationsSummary,
} from "../components/dashboard";
import { PageHeader, PageShell } from "../components/ui";

export default function DashboardLayout() {
  const {
    statCards,
    quickActions,
    recentActivity,
    pendingItems,
    notifications,
    loading,
  } = useDashboard();

  if (loading) {
    return (
      <PageShell wide className="animate-pulse">
        <div className="mb-8 h-10 max-w-md rounded-app-xl bg-app-surface" />
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-app-xl bg-app-surface" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="h-72 rounded-app-xl bg-app-surface lg:col-span-2" />
          <div className="h-72 rounded-app-xl bg-app-surface" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell wide>
      <PageHeader
        title="Welcome back"
        accentWord="back"
        description="Here's what's happening with your content today."
      />

      <div className="animate-fade-in space-y-8">
        <StatCardsRow statCards={statCards} />

        <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
          <div className="min-w-0 lg:col-span-2">
            <QuickActionsPanel actions={quickActions} />
          </div>
          <RecentActivityFeed activities={recentActivity} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <PendingItemsList items={pendingItems} />
          <NotificationsSummary notifications={notifications} />
        </div>
      </div>
    </PageShell>
  );
}
