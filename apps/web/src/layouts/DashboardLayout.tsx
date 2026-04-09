import { useDashboard } from '../hooks/useDashboard';
import { StatCardsRow, QuickActionsPanel, RecentActivityFeed, PendingItemsList, NotificationsSummary } from '../components/dashboard';

export default function DashboardLayout() {
  const { statCards, quickActions, recentActivity, pendingItems, notifications, loading } = useDashboard();

  if (loading) {
    return (
      <div className="flex min-h-screen p-6">
        <div className="w-64 mr-6 bg-white/[0.03] rounded-[10px]" />
        <div className="flex-1">
          <div className="h-16 bg-white/[0.03] rounded-[10px] mb-6" />
          <div className="flex gap-4 mb-6">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 flex-1 bg-white/[0.03] rounded-[10px] animate-pulse" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar placeholder */}
      <div className="w-64 bg-white/[0.02] border-r border-white/5 p-5">
        <div className="text-sm font-bold text-[#e2e4f0] mb-6">Dashboard</div>
        <nav className="flex flex-col gap-2">
          {['Overview', 'Content', 'Analytics', 'Settings'].map(item => (
            <a key={item} href="#" className="px-3 py-2.5 rounded-md text-[#8b8fa8] no-underline text-[13px] transition-all duration-150">
              {item}
            </a>
          ))}
        </nav>
      </div>

      {/* Main content */}
      <main className="flex-1 p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#e2e4f0] mb-1">Welcome back!</h1>
          <p className="text-[13px] text-[#555870] m-0">Here's what's happening with your content today.</p>
        </div>

        {/* Stat Cards */}
        <StatCardsRow statCards={statCards} />

        {/* Quick Actions & Recent Activity */}
        <div className="flex gap-6 mb-6">
          <QuickActionsPanel actions={quickActions} />
          <RecentActivityFeed activities={recentActivity} />
        </div>

        {/* Pending Items & Notifications */}
        <div className="grid grid-cols-2 gap-6">
          <PendingItemsList items={pendingItems} />
          <NotificationsSummary notifications={notifications} />
        </div>
      </main>
    </div>
  );
}
