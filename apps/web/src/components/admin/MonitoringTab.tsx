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
          <h2 className="text-lg font-semibold text-[#e2e4f0] mb-1">Monitoring</h2>
          <p className="text-[13px] text-[#555870] m-0">System health, metrics, and activity logs</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-[7px] bg-white/5 border border-white/10 rounded-lg text-[#9094ae] text-[13px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" onClick={refetch} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[90px] bg-white/[0.04] rounded-[10px] animate-pulse" />)
          : metrics.map(m => <MetricCard key={m.label} metric={m} />)
        }
      </div>

      <div className="flex flex-col">
        <h3 className="text-sm font-semibold text-[#c4c7d9] mb-2.5">Recent Activity</h3>
        <div className="rounded-[10px] border border-white/[0.07] overflow-auto max-h-[400px]">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['User', 'Action', 'Resource', 'IP', 'Time', 'Status'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide uppercase text-[#555870] bg-white/[0.02] border-b border-white/[0.06] sticky top-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map(log => <LogRow key={log.id} log={log} />)}
              {!loading && logs.length === 0 && <tr><td colSpan={6} className="text-center text-[#555870] p-8">No activity logs available.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ metric }: { metric: SystemMetric }) {
  const TrendIcon = metric.trend === 'up' ? TrendingUp : metric.trend === 'down' ? TrendingDown : Minus;
  const trendColor = metric.trend === 'up' ? 'text-emerald-400' : metric.trend === 'down' ? 'text-red-400' : 'text-gray-500';
  return (
    <div className="p-4 bg-white/[0.03] border border-white/[0.07] rounded-[10px] flex flex-col gap-1.5 min-w-0">
      <span className="text-[11px] font-semibold tracking-wide uppercase text-[#555870] whitespace-nowrap">{metric.label}</span>
      <div className="text-[22px] font-bold text-[#e2e4f0] leading-tight break-words">{metric.value}{metric.unit && <span className="text-xs text-gray-500 ml-1.5 font-medium">{metric.unit}</span>}</div>
      {metric.trend && <div className={`flex items-center gap-1 text-xs flex-wrap ${trendColor}`}><TrendIcon size={12} />{metric.changePercent !== undefined && `${metric.changePercent > 0 ? '+' : ''}${metric.changePercent}%`}</div>}
    </div>
  );
}

function LogRow({ log }: { log: ActivityLog }) {
  return (
    <tr className="transition-colors duration-100 hover:bg-white/[0.025] last:[&>td]:border-b-0">
      <td className="px-3 py-2.5 border-b border-white/[0.04] text-xs font-medium text-[#e2e4f0]">{log.userName}</td>
      <td className="px-3 py-2.5 border-b border-white/[0.04] text-xs text-[#c4c7d9]"><code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[11px]">{log.action}</code></td>
      <td className="px-3 py-2.5 border-b border-white/[0.04] text-xs text-[#8b8fa8]">{log.resource}</td>
      <td className="px-3 py-2.5 border-b border-white/[0.04] text-xs font-mono text-[#555870]">{log.ipAddress}</td>
      <td className="px-3 py-2.5 border-b border-white/[0.04] text-xs font-mono text-[#555870]">{new Date(log.timestamp).toLocaleTimeString()}</td>
      <td className="px-3 py-2.5 border-b border-white/[0.04] text-xs">
        {log.status === 'success'
          ? <span className="flex items-center gap-1 text-[11px] text-emerald-400"><CheckCircle2 size={12} /> OK</span>
          : <span className="flex items-center gap-1 text-[11px] text-red-400"><XCircle size={12} /> Failed</span>
        }
      </td>
    </tr>
  );
}