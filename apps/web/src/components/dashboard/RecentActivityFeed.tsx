import type { Activity } from '../../data/mockDashboardData';

export function RecentActivityFeed({ activities }: { activities: Activity[] }) {
  return (
    <div className="p-5 bg-white/[0.03] border border-white/[0.07] rounded-[10px] w-80 shrink-0">
      <h3 className="text-sm font-semibold text-[#e2e4f0] mb-4">Recent Activity</h3>
      <div className="flex flex-col gap-3">
        {activities.map((activity) => (
          <div key={activity.id} className="flex gap-2.5 items-start">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-xs font-semibold text-white shrink-0">
              {activity.user.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#e2e4f0] m-0 whitespace-nowrap overflow-hidden text-ellipsis">
                <span className="font-medium">{activity.user}</span>{' '}
                <span className="text-[#8b8fa8]">{activity.action}</span>{' '}
                <span className="font-medium text-violet-400">{activity.target}</span>
              </p>
              <span className="text-[10px] text-[#555870]">{activity.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
