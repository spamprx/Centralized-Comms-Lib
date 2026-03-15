import type { PendingItem, Notification } from '../../data/mockDashboardData';

const priorityColors = {
  high: '#f87171',
  medium: '#fbbf24',
  low: '#6b7280',
};

const typeIcons: Record<string, any> = {
  Article: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  Video: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
  Document: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  Image: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
};

export function PendingItemsList({ items }: { items: PendingItem[] }) {
  return (
    <div style={{ padding: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e4f0', margin: '0 0 16px' }}>Pending Review</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item) => (
          <div key={item.id} style={{
            padding: 12,
            background: 'rgba(255,255,255,0.02)',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.04)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8b8fa8' }}>
                {typeIcons[item.type] || typeIcons.Document}
                <span style={{ fontSize: 11, color: '#555870' }}>{item.type}</span>
              </div>
              <span style={{
                fontSize: 9,
                padding: '2px 6px',
                borderRadius: 4,
                background: `${priorityColors[item.priority]}22`,
                color: priorityColors[item.priority],
                fontWeight: 600,
                textTransform: 'uppercase',
              }}>{item.priority}</span>
            </div>
            <p style={{ fontSize: 13, fontWeight: 500, color: '#e2e4f0', margin: '0 0 4px' }}>{item.title}</p>
            <p style={{ fontSize: 11, color: '#555870', margin: 0 }}>Submitted by {item.submittedBy} • {new Date(item.submittedAt).toLocaleDateString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NotificationsSummary({ notifications }: { notifications: Notification[] }) {
  const typeColors = {
    info: '#06b6d4',
    warning: '#fbbf24',
    success: '#10b981',
    error: '#f87171',
  };

  return (
    <div style={{ padding: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e4f0', margin: '0 0 16px' }}>Notifications</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {notifications.map((notif) => (
          <div key={notif.id} style={{
            padding: 10,
            background: notif.read ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.03)',
            borderRadius: 6,
            borderLeft: `3px solid ${typeColors[notif.type]}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e4f0' }}>{notif.title}</span>
              <span style={{ fontSize: 10, color: '#555870' }}>{notif.time}</span>
            </div>
            <p style={{ fontSize: 11, color: '#8b8fa8', margin: 0 }}>{notif.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
