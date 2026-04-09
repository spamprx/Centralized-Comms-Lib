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
  const trendColor = stat.trend === 'up' ? 'text-emerald-400' : stat.trend === 'down' ? 'text-red-400' : 'text-gray-500';

  return (
    <div className="p-4 bg-white/[0.03] border border-white/[0.07] rounded-[10px] flex-1 min-w-[200px]">
      <div className="flex justify-between items-center mb-3">
        <span className="text-[11px] text-[#555870] uppercase font-semibold">{stat.label}</span>
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center"
          style={{ background: `${iconColors[stat.icon]}22`, color: iconColors[stat.icon] }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {stat.icon === 'content' && <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />}
            {stat.icon === 'review' && <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />}
            {stat.icon === 'users' && <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>}
            {stat.icon === 'engagement' && <><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></>}
          </svg>
        </div>
      </div>
      <div className="text-2xl font-bold text-[#e2e4f0] mb-2">{stat.value}</div>
      <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
        <TrendIcon size={12} />
        <span>{stat.change > 0 ? '+' : ''}{stat.change.toFixed(1)}% from last month</span>
      </div>
    </div>
  );
}

export function StatCardsRow({ statCards }: { statCards: StatCard[] }) {
  return (
    <div className="flex gap-4 flex-wrap mb-6">
      {statCards.map((stat, i) => <StatCard key={i} stat={stat} />)}
    </div>
  );
}
