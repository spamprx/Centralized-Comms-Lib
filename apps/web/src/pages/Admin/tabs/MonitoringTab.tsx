import { useAdminMonitoring } from '../../../hooks/useAdmin';
import { RefreshCw, TrendingUp, TrendingDown, Minus, CheckCircle2, XCircle } from 'lucide-react';
import type { SystemMetric, ActivityLog } from '../../../types/admin';

export default function MonitoringTab() {
  const { metrics, logs, loading, error, refetch } = useAdminMonitoring();
  if (error) return <div style={{ color: '#f87171', padding: 24 }}>⚠ {error}</div>;
  return (
    <div className="mt-wrapper">
      <div className="mt-header">
        <div>
          <h2 className="mt-title">Monitoring</h2>
          <p className="mt-subtitle">System health, metrics, and activity logs</p>
        </div>
        <button className="mt-refresh-btn" onClick={refetch} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'mt-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="mt-metrics">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="mt-metric-skeleton" />)
          : metrics.map(m => <MetricCard key={m.label} metric={m} />)
        }
      </div>

      <div className="mt-logs-section">
        <h3 className="mt-section-title">Recent Activity</h3>
        <div className="mt-logs-table-wrap">
          <table className="mt-logs-table">
            <thead>
              <tr>
                <th>User</th><th>Action</th><th>Resource</th><th>IP</th><th>Time</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => <LogRow key={log.id} log={log} />)}
              {!loading && logs.length === 0 && <tr><td colSpan={6} className="mt-empty">No activity logs available.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }
        @keyframes spin { to { transform:rotate(360deg); } }
        .mt-wrapper { display:flex; flex-direction:column; gap:20px; }
        .mt-header { display:flex; align-items:flex-start; justify-content:space-between; }
        .mt-title { font-size:18px; font-weight:600; color:#e2e4f0; margin:0 0 4px; }
        .mt-subtitle { font-size:13px; color:#555870; margin:0; }
        .mt-refresh-btn { display:flex; align-items:center; gap:6px; padding:7px 12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#9094ae; font-size:13px; cursor:pointer; }
        .mt-refresh-btn:disabled { opacity:.5; cursor:not-allowed; }
        .mt-spin { animation:spin 1s linear infinite; }
        .mt-metrics { display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:10px; }
        .mt-metric-skeleton { height:90px; background:rgba(255,255,255,0.04); border-radius:10px; animation:pulse 1.5s infinite; }
        .mt-metric { padding:16px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:10px; display:flex; flex-direction:column; gap:6px; }
        .mt-metric__label { font-size:11px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:#555870; }
        .mt-metric__value { font-size:24px; font-weight:700; color:#e2e4f0; line-height:1; }
        .mt-metric__unit { font-size:13px; color:#6b7280; margin-left:4px; }
        .mt-metric__trend { display:flex; align-items:center; gap:4px; font-size:12px; }
        .mt-logs-section { display:flex; flex-direction:column; }
        .mt-section-title { font-size:14px; font-weight:600; color:#c4c7d9; margin:0 0 10px; }
        .mt-logs-table-wrap { border-radius:10px; border:1px solid rgba(255,255,255,0.07); overflow:auto; max-height:400px; }
        .mt-logs-table { width:100%; border-collapse:collapse; }
        .mt-logs-table th { padding:9px 12px; text-align:left; font-size:11px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:#555870; background:rgba(255,255,255,0.02); border-bottom:1px solid rgba(255,255,255,0.06); position:sticky; top:0; }
        .mt-td { padding:9px 12px; border-bottom:1px solid rgba(255,255,255,0.04); font-size:12px; color:#c4c7d9; }
        .mt-log-row:last-child .mt-td { border-bottom:none; }
        .mt-log-row:hover { background:rgba(255,255,255,0.025); }
        .mt-action { background:rgba(255,255,255,0.06); padding:2px 5px; border-radius:4px; font-size:11px; }
        .mt-td--ip, .mt-td--time { font-family:monospace; color:#555870; }
        .mt-status { display:flex; align-items:center; gap:4px; font-size:11px; }
        .mt-status--ok { color:#34d399; }
        .mt-status--fail { color:#f87171; }
        .mt-empty { text-align:center; color:#555870; padding:32px; }
      `}</style>
    </div>
  );
}

function MetricCard({ metric }: { metric: SystemMetric }) {
  const TrendIcon = metric.trend === 'up' ? TrendingUp : metric.trend === 'down' ? TrendingDown : Minus;
  const trendColor = metric.trend === 'up' ? '#34d399' : metric.trend === 'down' ? '#f87171' : '#6b7280';
  return (
    <div className="mt-metric">
      <span className="mt-metric__label">{metric.label}</span>
      <div className="mt-metric__value">{metric.value}{metric.unit && <span className="mt-metric__unit">{metric.unit}</span>}</div>
      {metric.trend && <div className="mt-metric__trend" style={{ color: trendColor }}><TrendIcon size={12} />{metric.changePercent !== undefined && `${metric.changePercent > 0 ? '+' : ''}${metric.changePercent}%`}</div>}
    </div>
  );
}

function LogRow({ log }: { log: ActivityLog }) {
  return (
    <tr className="mt-log-row">
      <td className="mt-td" style={{ fontWeight:500, color:'#e2e4f0' }}>{log.userName}</td>
      <td className="mt-td"><code className="mt-action">{log.action}</code></td>
      <td className="mt-td" style={{ color:'#8b8fa8' }}>{log.resource}</td>
      <td className="mt-td mt-td--ip">{log.ipAddress}</td>
      <td className="mt-td mt-td--time">{new Date(log.timestamp).toLocaleTimeString()}</td>
      <td className="mt-td">
        {log.status === 'success'
          ? <span className="mt-status mt-status--ok"><CheckCircle2 size={12} /> OK</span>
          : <span className="mt-status mt-status--fail"><XCircle size={12} /> Failed</span>
        }
      </td>
    </tr>
  );
}