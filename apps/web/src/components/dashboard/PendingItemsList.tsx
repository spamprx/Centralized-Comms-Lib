import type { ReactNode } from 'react';
import type { PendingItem, Notification } from '../../data/mockDashboardData';
import { Surface } from '../ui';

const priorityColors = {
  high: '#f87171',
  medium: '#fbbf24',
  low: '#6b7280',
};

const typeIcons: Record<string, ReactNode> = {
  Article: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  Video: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  ),
  Document: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  Image: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  ),
};

export function PendingItemsList({ items }: { items: PendingItem[] }) {
  return (
    <Surface>
      <h3 className="mb-4 text-sm font-semibold text-app-text">Pending review</h3>
      <div className="flex flex-col gap-2.5">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-app-md border border-app-border/60 bg-app-bg/50 p-3 transition-colors hover:border-app-border"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-app-muted">
                {typeIcons[item.type] || typeIcons.Document}
                <span className="text-[11px] text-app-faint">{item.type}</span>
              </div>
              <span
                className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase"
                style={{
                  background: `${priorityColors[item.priority]}22`,
                  color: priorityColors[item.priority],
                }}
              >
                {item.priority}
              </span>
            </div>
            <p className="mb-1 text-[13px] font-medium text-app-text">{item.title}</p>
            <p className="m-0 text-[11px] text-app-faint">
              Submitted by {item.submittedBy} • {new Date(item.submittedAt).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </Surface>
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
    <Surface>
      <h3 className="mb-4 text-sm font-semibold text-app-text">Notifications</h3>
      <div className="flex flex-col gap-2.5">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            className={`rounded-app-md border-l-[3px] p-2.5 ${
              notif.read ? 'bg-app-bg/30' : 'bg-app-surface/50'
            }`}
            style={{ borderLeftColor: typeColors[notif.type] }}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-app-text">{notif.title}</span>
              <span className="shrink-0 text-[10px] text-app-faint">{notif.time}</span>
            </div>
            <p className="m-0 text-[11px] text-app-muted">{notif.message}</p>
          </div>
        ))}
      </div>
    </Surface>
  );
}
