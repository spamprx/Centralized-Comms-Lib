import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { StatCard } from '../../data/mockDashboardData';

const iconColors: Record<string, string> = {
  content: '#8b5cf6',
  review: '#f59e0b',
  users: '#06b6d4',
  engagement: '#10b981',
};

export function StatCard({ stat }: { stat: StatCard }) {
  const TrendIcon = stat.trend === 'up' ? TrendingUp : stat.trend === 'down' ? TrendingDown : Minus;
  const trendColor = stat.trend === 'up' ? '#34d399' : stat.trend === 'down' ? '#f87171' : '#6b7280';

  return (
    <div style={{
      padding: 16,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10,
      flex: 1,
      minWidth: 200,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: '#555870', textTransform: 'uppercase', fontWeight: 600 }}>{stat.label}</span>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          background: `${iconColors[stat.icon]}22`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: iconColors[stat.icon],
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {stat.icon === 'content' && <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />}
            {stat.icon === 'review' && <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />}
            {stat.icon === 'users' && <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>}
            {stat.icon === 'engagement' && <><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></>}
          </svg>
        </div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#e2e4f0', marginBottom: 8 }}>{stat.value}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: trendColor }}>
        <TrendIcon size={12} />
        <span>{stat.change > 0 ? '+' : ''}{stat.change.toFixed(1)}% from last month</span>
      </div>
    </div>
  );
}

export function StatCardsRow({ statCards }: { statCards: StatCard[] }) {
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
      {statCards.map((stat, i) => <StatCard key={i} stat={stat} />)}
    </div>
  );
}
