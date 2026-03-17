import { useDashboard } from '../hooks/useDashboard';
import { StatCardsRow, QuickActionsPanel, RecentActivityFeed, PendingItemsList, NotificationsSummary } from '../components/dashboard';

export default function DashboardLayout() {
  const { statCards, quickActions, recentActivity, pendingItems, notifications, loading } = useDashboard();

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', padding: 24 }}>
        <div style={{ width: 256, marginRight: 24, background: 'rgba(255,255,255,0.03)', borderRadius: 10 }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 64, background: 'rgba(255,255,255,0.03)', borderRadius: 10, marginBottom: 24 }} />
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 96, flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: 10, animation: 'pulse 1.5s infinite' }} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar placeholder */}
      <div style={{
        width: 256,
        background: 'rgba(255,255,255,0.02)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        padding: 20,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e4f0', marginBottom: 24 }}>Dashboard</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {['Overview', 'Content', 'Analytics', 'Settings'].map(item => (
            <a key={item} href="#" style={{
              padding: '10px 12px',
              borderRadius: 6,
              color: '#8b8fa8',
              textDecoration: 'none',
              fontSize: 13,
              transition: 'all 0.15s',
            }}>{item}</a>
          ))}
        </nav>
      </div>

      {/* Main content */}
      <main style={{ flex: 1, padding: 24 }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e2e4f0', margin: '0 0 4px' }}>Welcome back!</h1>
          <p style={{ fontSize: 13, color: '#555870', margin: 0 }}>Here's what's happening with your content today.</p>
        </div>

        {/* Stat Cards */}
        <StatCardsRow statCards={statCards} />

        {/* Quick Actions & Recent Activity */}
        <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
          <QuickActionsPanel actions={quickActions} />
          <RecentActivityFeed activities={recentActivity} />
        </div>

        {/* Pending Items & Notifications */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
          <PendingItemsList items={pendingItems} />
          <NotificationsSummary notifications={notifications} />
        </div>
      </main>
    </div>
  );
}
