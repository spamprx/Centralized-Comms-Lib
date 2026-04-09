import type { QuickAction } from '../../data/mockDashboardData';

export function QuickActionsPanel({ actions }: { actions: QuickAction[] }) {
  return (
    <div className="p-5 bg-white/[0.03] border border-white/[0.07] rounded-[10px]">
      <h3 className="text-sm font-semibold text-[#e2e4f0] mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <button
            key={action.id}
            className="flex flex-col items-center gap-2 p-4 bg-white/[0.02] border border-white/5 rounded-lg cursor-pointer transition-all duration-150 hover:bg-white/5"
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: `${action.color}22`, color: action.color }}
            >
              {action.icon === 'plus' && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>}
              {action.icon === 'upload' && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>}
              {action.icon === 'calendar' && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>}
              {action.icon === 'user' && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>}
            </div>
            <span className="text-xs text-[#8b8fa8] text-center">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
