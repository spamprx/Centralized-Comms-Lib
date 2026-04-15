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
    <Surface
      variant="glass"
      className="overflow-hidden shadow-app-lift transition-shadow duration-[var(--duration-app-slow)] ease-[var(--ease-app-out)] hover:shadow-app-soft"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -left-12 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-amber-500/8 blur-3xl"
      />
      <div className="relative z-[1]">
        <h3 className="mb-5 text-sm font-semibold tracking-tight text-app-text">Pending review</h3>
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="group/pend relative overflow-hidden rounded-app-lg border border-white/[0.07] bg-app-bg/35 p-3.5 pl-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md transition-[border-color,transform,box-shadow] duration-[var(--duration-app-slow)] ease-[var(--ease-app-material)] hover:-translate-y-px hover:border-white/12 hover:bg-white/[0.04] hover:shadow-[0_16px_48px_-20px_rgba(0,0,0,0.5)] motion-reduce:transition-colors motion-reduce:hover:transform-none"
            >
              <div
                aria-hidden
                className="absolute bottom-0 left-0 top-0 w-0.5 rounded-full opacity-90 transition-[width,opacity] duration-300 group-hover/pend:opacity-100"
                style={{
                  background: `linear-gradient(180deg, ${priorityColors[item.priority]}, transparent)`,
                }}
              />
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-app-muted transition-colors group-hover/pend:text-app-text">
                  <span className="flex h-7 w-7 items-center justify-center rounded-app-md bg-white/[0.05] ring-1 ring-white/10 transition-[transform,background-color] duration-300 group-hover/pend:bg-white/[0.08] group-hover/pend:ring-white/15">
                    {typeIcons[item.type] || typeIcons.Document}
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-app-faint">
                    {item.type}
                  </span>
                </div>
                <span
                  className="rounded-app-sm px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ring-1 ring-white/10"
                  style={{
                    background: `${priorityColors[item.priority]}22`,
                    color: priorityColors[item.priority],
                  }}
                >
                  {item.priority}
                </span>
              </div>
              <p className="mb-1 text-[13px] font-semibold leading-snug text-app-text">
                {item.title}
              </p>
              <p className="m-0 text-[11px] text-app-faint">
                Submitted by {item.submittedBy} • {new Date(item.submittedAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
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
    <Surface
      variant="glass"
      className="overflow-hidden shadow-app-lift transition-shadow duration-[var(--duration-app-slow)] ease-[var(--ease-app-out)] hover:shadow-app-soft"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 top-0 h-36 w-36 rounded-full bg-cyan-500/10 blur-3xl"
      />
      <div className="relative z-[1]">
        <h3 className="mb-5 text-sm font-semibold tracking-tight text-app-text">Notifications</h3>
        <div className="flex flex-col gap-3">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`group/notif relative overflow-hidden rounded-app-lg border border-white/[0.06] p-3 pl-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md transition-[border-color,transform,box-shadow] duration-[var(--duration-app-slow)] ease-[var(--ease-app-material)] hover:-translate-y-px hover:border-white/11 hover:shadow-[0_14px_40px_-18px_rgba(0,0,0,0.45)] motion-reduce:transition-colors motion-reduce:hover:transform-none ${
                notif.read ? 'bg-app-bg/25' : 'bg-white/[0.04]'
              }`}
            >
              <div
                className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
                style={{
                  background: `linear-gradient(180deg, ${typeColors[notif.type]}, transparent)`,
                }}
              />
              {!notif.read && (
                <span
                  aria-hidden
                  className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full shadow-[0_0_12px_2px] transition-transform duration-300 group-hover/notif:scale-125"
                  style={{
                    backgroundColor: typeColors[notif.type],
                    boxShadow: `0 0 12px 2px ${typeColors[notif.type]}66`,
                  }}
                />
              )}
              <div className="mb-1 flex items-center justify-between gap-2 pr-5">
                <span className="text-xs font-semibold text-app-text">{notif.title}</span>
                <span className="shrink-0 text-[10px] tabular-nums text-app-faint">
                  {notif.time}
                </span>
              </div>
              <p className="m-0 text-[11px] leading-relaxed text-app-muted">{notif.message}</p>
            </div>
          ))}
        </div>
      </div>
    </Surface>
  );
}
