import type { QuickAction } from '../../data/mockDashboardData';
import { Surface } from '../ui';

export function QuickActionsPanel({ actions }: { actions: QuickAction[] }) {
  return (
    <Surface
      variant="glass"
      className="h-full overflow-hidden shadow-app-lift transition-shadow duration-[var(--duration-app-slow)] ease-[var(--ease-app-out)] hover:shadow-app-soft"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 top-0 h-40 w-40 rounded-full bg-app-accent/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-12 left-1/4 h-32 w-32 rounded-full bg-app-accent-2/10 blur-3xl"
      />
      <div className="relative z-[1]">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-app-accent-2/90">
          Quick actions
        </h3>
        <p className="mb-5 text-sm font-semibold tracking-tight text-app-text">
          Jump back into your flow
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-2">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              className="group/qa relative flex flex-col items-center gap-2.5 overflow-hidden rounded-app-lg border border-white/[0.08] bg-app-bg/35 p-4 text-app-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md transition-[transform,background-color,border-color,box-shadow,color] duration-[var(--duration-app-slow)] ease-[var(--ease-app-material)] hover:-translate-y-0.5 hover:border-white/14 hover:bg-white/[0.06] hover:text-app-text hover:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.55)] active:translate-y-0 active:scale-[0.98] motion-reduce:transition-shadow motion-reduce:hover:transform-none"
            >
              <span
                aria-hidden
                className="app-shimmer-hover pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/qa:opacity-100"
              />
              <div
                className="relative flex h-11 w-11 items-center justify-center rounded-app-md ring-1 ring-white/10 transition-[transform,box-shadow] duration-[var(--duration-app-slow)] ease-[var(--ease-app-out)] group-hover/qa:scale-105 group-hover/qa:shadow-lg"
                style={{
                  background: `${action.color}26`,
                  color: action.color,
                  boxShadow: `0 0 24px -8px ${action.color}55`,
                }}
              >
                {action.icon === 'plus' && (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                )}
                {action.icon === 'upload' && (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                )}
                {action.icon === 'calendar' && (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                )}
                {action.icon === 'user' && (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <line x1="20" y1="8" x2="20" y2="14" />
                    <line x1="23" y1="11" x2="17" y2="11" />
                  </svg>
                )}
              </div>
              <span className="relative text-center text-xs font-medium text-app-muted transition-colors duration-300 group-hover/qa:text-app-text">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </Surface>
  );
}
