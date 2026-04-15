import type { CSSProperties } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { StatCard as StatCardModel } from '../../data/mockDashboardData';
import { Surface } from '../ui';

const iconColors: Record<string, string> = {
  content: '#8b5cf6',
  review: '#f59e0b',
  users: '#06b6d4',
  engagement: '#10b981',
};

export function StatCard({ stat }: { stat: StatCardModel }) {
  const TrendIcon = stat.trend === 'up' ? TrendingUp : stat.trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    stat.trend === 'up'
      ? 'text-emerald-400'
      : stat.trend === 'down'
        ? 'text-red-400'
        : 'text-app-faint';
  const accent = iconColors[stat.icon] ?? '#937cf8';

  return (
    <Surface
      variant="glass"
      padding="sm"
      className="group/card relative min-w-[200px] flex-1 overflow-hidden rounded-app-xl shadow-app-lift transition-[transform,box-shadow,border-color] duration-[var(--duration-app-slow)] ease-[var(--ease-app-out)] hover:-translate-y-1 hover:border-white/15 hover:shadow-app-glow motion-reduce:transform-none motion-reduce:transition-shadow"
    >
      <div
        className="absolute inset-x-0 top-0 z-[1] h-px opacity-95"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover/card:opacity-50"
        style={{ background: accent }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-8 left-1/2 h-20 w-[120%] -translate-x-1/2 rounded-full bg-gradient-to-t from-black/35 to-transparent opacity-70"
      />
      <div className="relative z-[1] mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-app-faint">
          {stat.label}
        </span>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-app-md ring-1 ring-white/12 transition-[transform,box-shadow] duration-[var(--duration-app-slow)] ease-[var(--ease-app-out)] group-hover/card:scale-105 group-hover/card:shadow-[0_0_20px_-4px_var(--tw-shadow-color)]"
          style={
            {
              background: `${accent}30`,
              color: accent,
              '--tw-shadow-color': accent,
            } as CSSProperties
          }
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            {stat.icon === 'content' && (
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            )}
            {stat.icon === 'review' && (
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            )}
            {stat.icon === 'users' && (
              <>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </>
            )}
            {stat.icon === 'engagement' && <path d="M22 12h-4l-3 9L9 3l-3 9H2" />}
          </svg>
        </div>
      </div>
      <div className="relative z-[1] mb-1 bg-gradient-to-br from-app-text to-app-muted bg-clip-text text-2xl font-bold tracking-tight text-transparent md:text-[1.65rem]">
        {stat.value}
      </div>
      <div className={`relative z-[1] flex items-center gap-1.5 text-xs ${trendColor}`}>
        <TrendIcon
          size={12}
          aria-hidden
          className="shrink-0 transition-transform duration-300 group-hover/card:scale-110"
        />
        <span>
          {stat.change > 0 ? '+' : ''}
          {stat.change.toFixed(1)}% from last month
        </span>
      </div>
    </Surface>
  );
}

export function StatCardsRow({ statCards }: { statCards: StatCardModel[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {statCards.map((stat, i) => (
        <div
          key={i}
          className="animate-fade-in motion-reduce:animate-none"
          style={{ animationDelay: `${i * 70}ms` }}
        >
          <StatCard stat={stat} />
        </div>
      ))}
    </div>
  );
}
