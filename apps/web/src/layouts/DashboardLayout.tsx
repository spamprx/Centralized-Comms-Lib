import { useDashboard } from '../hooks/useDashboard';
import {
  StatCardsRow,
  QuickActionsPanel,
  RecentActivityFeed,
  PendingItemsList,
  NotificationsSummary,
} from '../components/dashboard';
import { PageHeader, PageShell } from '../components/ui';

export default function DashboardLayout() {
  const { statCards, quickActions, recentActivity, pendingItems, notifications, loading } =
    useDashboard();

  if (loading) {
    return (
      <PageShell wide className="app-main-canvas">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
          <div className="absolute -left-32 top-24 h-72 w-72 rounded-full bg-app-accent/10 blur-[100px]" />
          <div className="absolute -right-24 top-1/3 h-64 w-64 rounded-full bg-app-accent-2/10 blur-[90px]" />
        </div>
        <div className="space-y-10">
          <div className="space-y-3">
            <div className="app-skeleton-shimmer h-3 w-28 rounded-full" />
            <div className="app-skeleton-shimmer h-9 max-w-md rounded-app-lg" />
            <div className="app-skeleton-shimmer h-3 max-w-lg rounded-full" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="relative overflow-hidden rounded-app-xl border border-white/[0.07] bg-app-bg/35 p-5 shadow-app-lift backdrop-blur-xl supports-[backdrop-filter]:bg-app-bg/25"
              >
                <div className="app-skeleton-shimmer mb-4 h-3 w-24 rounded-full" />
                <div className="app-skeleton-shimmer mb-3 h-10 w-10 rounded-app-md" />
                <div className="app-skeleton-shimmer mb-2 h-8 w-2/3 max-w-[8rem] rounded-app-md" />
                <div className="app-skeleton-shimmer h-3 w-32 rounded-full" />
              </div>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="relative min-h-[18rem] overflow-hidden rounded-app-xl border border-white/[0.07] bg-app-bg/35 p-6 shadow-app-lift backdrop-blur-xl lg:col-span-2 supports-[backdrop-filter]:bg-app-bg/25">
              <div className="app-skeleton-shimmer mb-2 h-3 w-28 rounded-full" />
              <div className="app-skeleton-shimmer mb-6 h-4 w-48 rounded-app-md" />
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-2">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="app-skeleton-shimmer h-24 rounded-app-lg" />
                ))}
              </div>
            </div>
            <div className="relative min-h-[18rem] overflow-hidden rounded-app-xl border border-white/[0.07] bg-app-bg/35 p-6 shadow-app-lift backdrop-blur-xl supports-[backdrop-filter]:bg-app-bg/25">
              <div className="app-skeleton-shimmer mb-2 h-3 w-28 rounded-full" />
              <div className="app-skeleton-shimmer mb-6 h-4 w-44 rounded-app-md" />
              <div className="flex flex-col gap-3">
                {[1, 2, 3, 4].map((k) => (
                  <div key={k} className="flex items-start gap-3">
                    <div className="app-skeleton-shimmer size-9 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="app-skeleton-shimmer h-3 w-full rounded-full" />
                      <div className="app-skeleton-shimmer h-2.5 w-16 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="relative min-h-[14rem] overflow-hidden rounded-app-xl border border-white/[0.07] bg-app-bg/35 p-6 shadow-app-lift backdrop-blur-xl supports-[backdrop-filter]:bg-app-bg/25">
              <div className="app-skeleton-shimmer mb-5 h-4 w-36 rounded-app-md" />
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="app-skeleton-shimmer h-20 rounded-app-lg" />
                ))}
              </div>
            </div>
            <div className="relative min-h-[14rem] overflow-hidden rounded-app-xl border border-white/[0.07] bg-app-bg/35 p-6 shadow-app-lift backdrop-blur-xl supports-[backdrop-filter]:bg-app-bg/25">
              <div className="app-skeleton-shimmer mb-5 h-4 w-32 rounded-app-md" />
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((m) => (
                  <div key={m} className="app-skeleton-shimmer h-16 rounded-app-lg" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell wide className="app-main-canvas">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute -left-32 top-24 h-72 w-72 rounded-full bg-app-accent/10 blur-[100px]" />
        <div className="absolute -right-24 top-1/3 h-64 w-64 rounded-full bg-app-accent-2/10 blur-[90px]" />
        <div className="absolute bottom-0 left-1/2 h-48 w-[min(90%,48rem)] -translate-x-1/2 rounded-full bg-app-accent-deep/20 blur-[120px]" />
      </div>

      <PageHeader
        title="Welcome back"
        accentWord="back"
        description="Here's what's happening with your content today."
      />

      <div className="animate-fade-in space-y-10">
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
