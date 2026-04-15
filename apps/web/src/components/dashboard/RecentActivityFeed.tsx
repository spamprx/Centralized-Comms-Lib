import type { Activity } from '../../data/mockDashboardData';
import { Surface } from '../ui';

export function RecentActivityFeed({ activities }: { activities: Activity[] }) {
  return (
    <Surface className="flex h-full min-h-[300px] w-full flex-col">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-app-faint">
        Recent activity
      </h3>
      <p className="mb-4 text-sm font-semibold text-app-text">Live from your workspace</p>
      <div className="flex flex-col gap-3">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-app-accent to-cyan-500 text-xs font-semibold text-white">
              {activity.user
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </div>
            <div className="min-w-0 flex-1">
              <p className="m-0 truncate text-xs text-app-text">
                <span className="font-medium">{activity.user}</span>{' '}
                <span className="text-app-muted">{activity.action}</span>{' '}
                <span className="font-medium text-app-accent">{activity.target}</span>
              </p>
              <span className="text-[10px] text-app-faint">{activity.time}</span>
            </div>
          </div>
        ))}
      </div>
    </Surface>
  );
}
