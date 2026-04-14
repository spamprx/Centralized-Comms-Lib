import { useEffect, useMemo, useRef, useState } from 'react';
import { useAdminMonitoring } from '../../hooks/useAdmin';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Minus,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import type { SystemMetric, ActivityLog } from '../../types/admin';

// ─── Counter Animation Hook ──────────────────────────────────────────

function useAnimatedNumber(target: number, duration = 800): number {
  const [value, setValue] = useState(0);
  const startRef = useRef<number>(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = value;
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(startRef.current + (target - startRef.current) * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [target, duration]);

  return value;
}

// ─── Fake sparkline data helper ──────────────────────────────────────

function generateSparkline(baseValue: number): { v: number }[] {
  const points: { v: number }[] = [];
  let v = baseValue;
  for (let i = 0; i < 7; i++) {
    v = v + (Math.random() - 0.45) * baseValue * 0.15;
    points.push({ v: Math.max(0, v) });
  }
  return points;
}

// ─── Action color coding ─────────────────────────────────────────────

function getActionColor(action: string): string {
  if (action.startsWith('user.') || action.startsWith('role.')) return '#818cf8';
  if (action.startsWith('content.')) return '#a78bfa';
  if (action.startsWith('settings.')) return '#fbbf24';
  if (action === 'login') return '#6b7280';
  return '#8f96ad';
}

function compactJson(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// ─── Main Component ──────────────────────────────────────────────────

export default function MonitoringTab() {
  const { metrics, logs, loading, error, refetch } = useAdminMonitoring();
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState<'all' | ActivityLog['severity']>('all');

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesSeverity = severity === 'all' || log.severity === severity;
      if (!matchesSeverity) return false;
      if (!q) return true;
      const haystack = `${log.action} ${log.resource} ${log.resourceId ?? ''} ${log.ipAddress} ${log.userAgent ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [logs, query, severity]);

  if (error) return <div className="text-red-400 p-6">⚠ {error}</div>;
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-app-border bg-app-bg-subtle p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
        <div>
            <h2 className="text-lg font-medium text-app-text mb-1">Monitoring</h2>
            <p className="text-[13px] text-app-faint m-0">System health, metrics, and detailed audit activity</p>
        </div>
        <button
            className="flex items-center gap-1.5 px-3 py-[7px] rounded-xl border border-app-border bg-app-surface text-app-muted text-[13px] transition-colors hover:border-app-border-strong hover:text-app-text disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={refetch}
          disabled={loading}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[110px] rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />
            ))
          : metrics.map((m, idx) => <MetricCard key={m.label} metric={m} index={idx} />)}
      </div>

      {/* Activity Log Stream */}
      <div className="rounded-xl border border-app-border bg-app-bg-subtle p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-app-muted m-0">Recent activity</h3>
          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter logs..."
              className="h-8 w-44 rounded-lg border border-app-border bg-app-bg px-2.5 text-[12px] text-app-text outline-none transition-colors focus:border-app-accent"
            />
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as 'all' | ActivityLog['severity'])}
              className="h-8 rounded-lg border border-app-border bg-app-bg px-2.5 text-[12px] text-app-muted outline-none transition-colors focus:border-app-accent"
            >
              <option value="all">All severities</option>
              <option value="success">Success</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>
        </div>

        <div className="flex max-h-[560px] flex-col gap-2 overflow-y-auto pr-1">
          {filteredLogs.map((log, idx) => (
            <LogRow key={log.id} log={log} index={idx} />
          ))}
          {!loading && filteredLogs.length === 0 && (
            <div className="text-center text-app-faint p-8 text-sm">No matching logs found.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Metric Card ─────────────────────────────────────────────────────

function MetricCard({ metric, index }: { metric: SystemMetric; index: number }) {
  const numericValue = typeof metric.value === 'number' ? metric.value : parseFloat(String(metric.value));

  const animatedVal = useAnimatedNumber(isNaN(numericValue) ? 0 : numericValue);
  const animatedDisplay = isNaN(numericValue)
    ? metric.value
    : Number.isInteger(numericValue)
    ? Math.round(animatedVal)
    : animatedVal.toFixed(2);

  const changePercent = metric.changePercent !== undefined ? parseFloat(metric.changePercent.toFixed(2)) : undefined;

  const TrendIcon = metric.trend === 'up' ? TrendingUp : metric.trend === 'down' ? TrendingDown : Minus;
  const trendColor = metric.trend === 'up' ? '#34d399' : metric.trend === 'down' ? '#f87171' : '#8f96ad';
  const chipBg = metric.trend === 'up' ? 'rgba(52,211,153,0.1)' : metric.trend === 'down' ? 'rgba(248,113,113,0.1)' : 'rgba(143,150,173,0.1)';

  const sparkData = generateSparkline(isNaN(numericValue) ? 50 : numericValue);

  // Gradient colors for border
  const gradientFrom = metric.trend === 'up'
    ? 'rgba(52,211,153,0.35)'
    : metric.trend === 'down'
    ? 'rgba(248,113,113,0.3)'
    : 'rgba(147,124,248,0.3)';
  const gradientTo = 'rgba(147,124,248,0.1)';

  return (
    <div
      className="admin-gradient-border admin-row-enter"
      style={{
        '--row-index': index,
        '--gradient-from': gradientFrom,
        '--gradient-to': gradientTo,
      } as React.CSSProperties}
    >
      <div className="p-4 rounded-[15px] bg-app-bg-subtle flex flex-col gap-2 min-w-0 h-full">
        <div className="flex items-start justify-between">
          <span className="text-[11px] font-semibold tracking-wide uppercase text-app-faint whitespace-nowrap">
            {metric.label}
          </span>
          {/* Floating change chip */}
          {metric.trend && changePercent !== undefined && (
            <span
              className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap"
              style={{ color: trendColor, background: chipBg }}
            >
              <TrendIcon size={10} />
              {changePercent > 0 ? '+' : ''}{changePercent}%
            </span>
          )}
        </div>
        <div className="text-[24px] font-bold text-app-text leading-tight break-words tabular-nums">
          {animatedDisplay}
          {metric.unit && <span className="text-[12px] text-app-faint ml-1 font-medium">{metric.unit}</span>}
        </div>
        {/* Sparkline */}
        <div className="h-[28px] -mx-1 mt-auto">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <Line
                type="monotone"
                dataKey="v"
                stroke={trendColor}
                strokeWidth={1.5}
                dot={false}
                strokeOpacity={0.6}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── Timeline Row ────────────────────────────────────────────────────

function LogRow({ log, index }: { log: ActivityLog; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const actionColor = getActionColor(log.action);
  const isSuccess = log.status === 'success';
  const severityIcon = log.severity === 'error'
    ? <ShieldAlert size={13} />
    : log.severity === 'warning'
      ? <AlertTriangle size={13} />
      : log.severity === 'success'
        ? <CheckCircle2 size={13} />
        : <Clock3 size={13} />;
  const severityTone = log.severity === 'error'
    ? 'text-rose-300 bg-rose-500/10 border-rose-400/30'
    : log.severity === 'warning'
      ? 'text-amber-300 bg-amber-500/10 border-amber-400/30'
      : log.severity === 'success'
        ? 'text-emerald-300 bg-emerald-500/10 border-emerald-400/30'
        : 'text-blue-300 bg-blue-500/10 border-blue-400/30';

  return (
    <div className="admin-row-enter rounded-lg border border-app-border bg-app-bg/35" style={{ '--row-index': index } as React.CSSProperties}>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <span
          className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-mono"
          style={{
            color: actionColor,
            background: `${actionColor}15`,
            border: `1px solid ${actionColor}25`,
          }}
        >
          {log.action}
        </span>
        <span className="text-[12px] text-app-text">{log.resource}</span>
        {log.resourceId ? (
          <span className="rounded-md border border-app-border bg-app-bg px-1.5 py-0.5 text-[10px] font-mono text-app-faint">
            {log.resourceId.slice(0, 12)}
          </span>
        ) : null}
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${severityTone}`}>
          {severityIcon}
          {log.severity}
        </span>
        <span className="ml-auto text-[11px] text-app-faint">{new Date(log.timestamp).toLocaleString()}</span>
        <button
          className="inline-flex h-6 items-center gap-1 rounded-md border border-app-border px-2 text-[11px] text-app-muted transition-colors hover:border-app-border-strong hover:text-app-text"
          onClick={() => setExpanded((v) => !v)}
        >
          details {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {expanded ? (
        <div className="grid gap-2 border-t border-app-border px-3 py-2.5 md:grid-cols-2">
          <div className="rounded-md border border-app-border/70 bg-app-bg/60 p-2">
            <div className="mb-1 text-[10px] uppercase tracking-wide text-app-faint">Actor / Network</div>
            <div className="text-[12px] text-app-text">Actor: {log.userName} ({log.userId})</div>
            <div className="text-[12px] text-app-muted">IP: {log.ipAddress}</div>
            <div className="text-[11px] text-app-faint wrap-break-word">UA: {log.userAgent || '—'}</div>
          </div>
          <div className="rounded-md border border-app-border/70 bg-app-bg/60 p-2">
            <div className="mb-1 text-[10px] uppercase tracking-wide text-app-faint">Status</div>
            <div className="text-[12px] text-app-text">
              {isSuccess ? 'Completed successfully' : 'Failed'}
            </div>
            <div className="text-[11px] text-app-faint">Event ID: {log.id}</div>
          </div>
          <div className="rounded-md border border-app-border/70 bg-app-bg/60 p-2 md:col-span-2">
            <div className="mb-1 text-[10px] uppercase tracking-wide text-app-faint">Change payload</div>
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <div className="mb-1 text-[11px] text-app-muted">Previous</div>
                <pre className="max-h-28 overflow-auto rounded bg-app-bg p-2 text-[10px] text-app-faint">{compactJson(log.oldValue)}</pre>
              </div>
              <div>
                <div className="mb-1 text-[11px] text-app-muted">Current</div>
                <pre className="max-h-28 overflow-auto rounded bg-app-bg p-2 text-[10px] text-app-faint">{compactJson(log.newValue)}</pre>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}