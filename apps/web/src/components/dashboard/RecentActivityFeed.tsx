import type { Activity } from '../../data/mockDashboardData';
import { Surface } from '../ui';

export function RecentActivityFeed({ activities }: { activities: Activity[] }) {
  return (
    <Surface
      variant="glass"
      className="flex h-full min-h-[300px] w-full flex-col overflow-hidden shadow-app-lift transition-shadow duration-[var(--duration-app-slow)] ease-[var(--ease-app-out)] hover:shadow-app-soft"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-1/2 h-48 w-32 -translate-y-1/2 rounded-full bg-app-accent/12 blur-3xl"
      />
      <div className="relative z-[1] mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-app-accent-2/90">
        Recent activity
      </div>
      <p className="relative z-[1] mb-5 text-sm font-semibold tracking-tight text-app-text">
        Live from your workspace
      </p>
      <div className="relative z-[1] flex flex-1 flex-col gap-0 pl-1">
        {activities.map((activity, idx) => (
          <div key={activity.id} className="group/feed relative flex gap-3 pb-4 last:pb-0">
            {idx < activities.length - 1 && (
              <div
                aria-hidden
                className="absolute left-[18px] top-10 bottom-0 w-px bg-gradient-to-b from-white/18 via-white/08 to-transparent"
              />
            )}
            <div className="relative shrink-0">
              <div
                aria-hidden
                className="absolute inset-0 scale-125 rounded-full bg-gradient-to-br from-app-accent/40 to-cyan-500/30 opacity-0 blur-md transition-opacity duration-500 group-hover/feed:opacity-100"
              />
              <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-app-accent to-cyan-500 text-[11px] font-semibold text-white ring-2 ring-white/15 shadow-[0_0_20px_-4px_rgba(147,124,248,0.55)] transition-[transform,box-shadow] duration-[var(--duration-app-slow)] ease-[var(--ease-app-out)] group-hover/feed:scale-105 group-hover/feed:shadow-[0_0_28px_-2px_rgba(45,212,191,0.35)]">
                {activity.user
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </div>
            </div>
            <div className="min-w-0 flex-1 rounded-app-md border border-white/[0.06] bg-app-bg/30 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm transition-[border-color,background-color,transform] duration-[var(--duration-app-slow)] ease-[var(--ease-app-material)] group-hover/feed:border-white/12 group-hover/feed:bg-white/[0.04] motion-reduce:transition-colors">
              <p className="m-0 text-xs leading-snug text-app-text">
                <span className="font-semibold text-app-text">{activity.user}</span>{' '}
                <span className="text-app-muted">{activity.action}</span>{' '}
                <span className="font-medium text-app-accent">{activity.target}</span>
              </p>
              <span className="mt-1 inline-block text-[10px] tabular-nums text-app-faint transition-colors group-hover/feed:text-app-muted">
                {activity.time}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Surface>
  );
}
