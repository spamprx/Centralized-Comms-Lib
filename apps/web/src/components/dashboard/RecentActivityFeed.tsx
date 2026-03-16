import type { Activity } from '../../data/mockDashboardData';

export function RecentActivityFeed({ activities }: { activities: Activity[] }) {
  return (
    <div style={{
      padding: 20,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10,
      width: 320,
      flexShrink: 0,
    }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e4f0', margin: '0 0 16px' }}>Recent Activity</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {activities.map((activity) => (
          <div key={activity.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 600,
              color: '#fff',
              flexShrink: 0,
            }}>
              {activity.user.split(' ').map(n => n[0]).join('')}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, color: '#e2e4f0', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <span style={{ fontWeight: 500 }}>{activity.user}</span>{' '}
                <span style={{ color: '#8b8fa8' }}>{activity.action}</span>{' '}
                <span style={{ fontWeight: 500, color: '#a78bfa' }}>{activity.target}</span>
              </p>
              <span style={{ fontSize: 10, color: '#555870' }}>{activity.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
