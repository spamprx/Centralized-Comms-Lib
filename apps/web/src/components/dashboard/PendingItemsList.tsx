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
    <div className="p-5 bg-white/[0.03] border border-white/[0.07] rounded-[10px]">
      <h3 className="text-sm font-semibold text-[#e2e4f0] mb-4">Pending Review</h3>
      <div className="flex flex-col gap-2.5">
        {items.map((item) => (
          <div key={item.id} className="p-3 bg-white/[0.02] rounded-md border border-white/[0.04]">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2 text-[#8b8fa8]">
                {typeIcons[item.type] || typeIcons.Document}
                <span className="text-[11px] text-[#555870]">{item.type}</span>
              </div>
              <span
                className="text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase"
                style={{ background: `${priorityColors[item.priority]}22`, color: priorityColors[item.priority] }}
              >{item.priority}</span>
            </div>
            <p className="text-[13px] font-medium text-[#e2e4f0] mb-1">{item.title}</p>
            <p className="text-[11px] text-[#555870] m-0">Submitted by {item.submittedBy} • {new Date(item.submittedAt).toLocaleDateString()}</p>
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
    <div className="p-5 bg-white/[0.03] border border-white/[0.07] rounded-[10px]">
      <h3 className="text-sm font-semibold text-[#e2e4f0] mb-4">Notifications</h3>
      <div className="flex flex-col gap-2.5">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            className={`p-2.5 rounded-md border-l-[3px] ${notif.read ? 'bg-white/[0.01]' : 'bg-white/[0.03]'}`}
            style={{ borderLeftColor: typeColors[notif.type] }}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-semibold text-[#e2e4f0]">{notif.title}</span>
              <span className="text-[10px] text-[#555870]">{notif.time}</span>
            </div>
            <p className="text-[11px] text-[#8b8fa8] m-0">{notif.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
