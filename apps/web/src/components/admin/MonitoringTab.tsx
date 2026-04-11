import { useAdminMonitoring } from '../../hooks/useAdmin';
import { RefreshCw, TrendingUp, TrendingDown, Minus, CheckCircle2, XCircle } from 'lucide-react';
import type { SystemMetric, ActivityLog } from '../../types/admin';

export default function MonitoringTab() {
  const { metrics, logs, loading, error, refetch } = useAdminMonitoring();
  if (error) return <div className="text-red-400 p-6">⚠ {error}</div>;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-app-text mb-1">Monitoring</h2>
          <p className="text-[13px] text-app-faint m-0">System health, metrics, and activity logs</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-[7px] bg-app-surface border border-app-border rounded-lg text-app-muted text-[13px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" onClick={refetch} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[90px] bg-app-surface rounded-app-lg animate-pulse" />)
          : metrics.map(m => <MetricCard key={m.label} metric={m} />)
        }
      </div>

      <div className="flex flex-col">
        <h3 className="text-sm font-semibold text-app-muted mb-2.5">Recent Activity</h3>
        <div className="rounded-app-lg border border-app-border overflow-auto max-h-[400px]">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['User', 'Action', 'Resource', 'IP', 'Time', 'Status'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide uppercase text-app-faint bg-app-bg/60 border-b border-app-border sticky top-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map(log => <LogRow key={log.id} log={log} />)}
              {!loading && logs.length === 0 && <tr><td colSpan={6} className="text-center text-app-faint p-8">No activity logs available.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ metric }: { metric: SystemMetric }) {
  const TrendIcon = metric.trend === 'up' ? TrendingUp : metric.trend === 'down' ? TrendingDown : Minus;
  const trendColor = metric.trend === 'up' ? 'text-emerald-400' : metric.trend === 'down' ? 'text-red-400' : 'text-app-faint';
  return (
    <div className="p-4 bg-app-surface border border-app-border rounded-app-lg flex flex-col gap-1.5 min-w-0">
      <span className="text-[11px] font-semibold tracking-wide uppercase text-app-faint whitespace-nowrap">{metric.label}</span>
      <div className="text-[22px] font-bold text-app-text leading-tight break-words">{metric.value}{metric.unit && <span className="text-xs text-app-faint ml-1.5 font-medium">{metric.unit}</span>}</div>
      {metric.trend && <div className={`flex items-center gap-1 text-xs flex-wrap ${trendColor}`}><TrendIcon size={12} />{metric.changePercent !== undefined && `${metric.changePercent > 0 ? '+' : ''}${metric.changePercent}%`}</div>}
    </div>
  );
}

function LogRow({ log }: { log: ActivityLog }) {
  return (
    <tr className="transition-colors duration-100 hover:bg-app-surface/50 last:[&>td]:border-b-0">
      <td className="px-3 py-2.5 border-b border-app-border text-xs font-medium text-app-text">{log.userName}</td>
      <td className="px-3 py-2.5 border-b border-app-border text-xs text-app-muted"><code className="bg-app-elevated px-1.5 py-0.5 rounded text-[11px]">{log.action}</code></td>
      <td className="px-3 py-2.5 border-b border-app-border text-xs text-app-muted">{log.resource}</td>
      <td className="px-3 py-2.5 border-b border-app-border text-xs font-mono text-app-faint">{log.ipAddress}</td>
      <td className="px-3 py-2.5 border-b border-app-border text-xs font-mono text-app-faint">{new Date(log.timestamp).toLocaleTimeString()}</td>
      <td className="px-3 py-2.5 border-b border-app-border text-xs">
        {log.status === 'success'
          ? <span className="flex items-center gap-1 text-[11px] text-emerald-400"><CheckCircle2 size={12} /> OK</span>
          : <span className="flex items-center gap-1 text-[11px] text-red-400"><XCircle size={12} /> Failed</span>
        }
      </td>
    </tr>
  );
}