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
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SystemMetric, ActivityLog } from '../../types/admin';
import { joinApiV1Path } from '../../lib/apiBase';

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
      const haystack =
        `${log.action} ${log.resource} ${log.resourceId ?? ''} ${log.ipAddress} ${log.userAgent ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [logs, query, severity]);

  const lifecycleData = useMemo(() => {
    const histogramMetric = metrics.find((m) => m.label === 'Content lifecycle histogram');
    const histogram = histogramMetric?.details?.histogram;
    if (!histogram || typeof histogram !== 'object') return [];
    const rows = Object.entries(histogram as Record<string, unknown>).map(([state, count]) => ({
      state: state.replaceAll('_', ' '),
      count: typeof count === 'number' ? count : 0,
    }));
    return rows;
  }, [metrics]);

  const lifecycleSummary = useMemo(() => {
    const total = lifecycleData.reduce((sum, row) => sum + row.count, 0);
    const peak = lifecycleData.reduce<{ state: string; count: number } | null>((best, row) => {
      if (!best || row.count > best.count) return row;
      return best;
    }, null);
    return { total, peak };
  }, [lifecycleData]);

  const auditExportHref = useMemo(() => {
    const url = new URL(joinApiV1Path('/admin/logs/export'), window.location.origin);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1000');
    return url.toString();
  }, []);

  if (error)
    return (
      <div className="admin-glass relative overflow-hidden rounded-app-xl p-8 text-center text-sm font-medium text-red-300">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-400/35 to-transparent" />
        {error}
      </div>
    );
  return (
    <div className="flex flex-col gap-6">
      <div className="admin-glass relative overflow-hidden rounded-app-xl p-5 sm:p-6 ring-1 ring-white/[0.04]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <h2 className="mb-1 text-lg font-semibold tracking-tight text-app-text">Monitoring</h2>
            <p className="m-0 text-[13px] text-app-muted">
              System health, metrics, and detailed audit activity
            </p>
          </div>
          <button
            type="button"
            className="admin-glass-button inline-flex items-center gap-2 rounded-app-lg px-3.5 py-2 text-[13px] font-semibold text-app-muted disabled:cursor-not-allowed disabled:opacity-45"
            onClick={refetch}
            disabled={loading}
          >
            <RefreshCw size={14} strokeWidth={2} className={loading ? 'animate-spin' : ''} />{' '}
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="app-skeleton-shimmer h-[110px] rounded-app-xl border border-white/[0.06]"
              />
            ))
          : metrics.map((m, idx) => <MetricCard key={m.label} metric={m} index={idx} />)}
      </div>

      <div className="admin-glass relative overflow-hidden rounded-app-xl p-5 sm:p-6 ring-1 ring-white/[0.04]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
          <div className="absolute -left-8 top-10 h-36 w-36 rounded-full bg-violet-500/12 blur-3xl" />
          <div className="absolute right-0 top-4 h-32 w-32 rounded-full bg-cyan-500/10 blur-3xl" />
        </div>
        <div className="relative mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="m-0 text-base font-semibold tracking-tight text-app-text">
              Content lifecycle distribution
            </h3>
            <p className="mt-1 text-xs text-app-faint">
              Live every 30s from `/admin/monitoring/metrics`
            </p>
          </div>
          <div className="flex gap-2">
            <span className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-xs text-app-muted">
              Total: <span className="font-semibold text-app-text">{lifecycleSummary.total}</span>
            </span>
            <span className="rounded-full border border-violet-300/20 bg-violet-500/10 px-3 py-1 text-xs text-violet-100">
              Peak:{' '}
              <span className="font-semibold">
                {lifecycleSummary.peak ? `${lifecycleSummary.peak.state} (${lifecycleSummary.peak.count})` : '—'}
              </span>
            </span>
          </div>
        </div>
        <div className="relative rounded-app-lg border border-white/8 bg-app-bg/35 p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-app-faint">
            {[
              { key: 'DRAFT', color: '#f59e0b' },
              { key: 'IN REVIEW', color: '#38bdf8' },
              { key: 'PUBLISHED', color: '#34d399' },
              { key: 'ARCHIVED', color: '#a78bfa' },
            ].map((item) => (
              <span key={item.key} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2 py-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                {item.key}
              </span>
            ))}
          </div>
          <div className="h-64">
          {loading ? (
            <div className="app-skeleton-shimmer h-full rounded-app-xl border border-white/[0.06]" />
          ) : lifecycleData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={lifecycleData}
                layout="vertical"
                margin={{ top: 6, right: 28, left: 12, bottom: 2 }}
                barCategoryGap={16}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="state"
                  tick={{ fill: '#cbd5e1', fontSize: 11, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                  width={94}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                  contentStyle={{
                    background: 'rgba(15,23,42,0.95)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '12px',
                    boxShadow: '0 8px 28px rgba(2,6,23,0.35)',
                  }}
                />
                <Bar dataKey="count" radius={[0, 999, 999, 0]} barSize={14}>
                  <LabelList dataKey="count" position="right" fill="#d1d5db" fontSize={11} />
                  {lifecycleData.map((row) => {
                    const state = row.state.toUpperCase();
                    const fill =
                      state === 'DRAFT'
                        ? '#f59e0b'
                        : state === 'IN REVIEW'
                          ? '#38bdf8'
                          : state === 'PUBLISHED'
                            ? '#34d399'
                            : '#a78bfa';
                    return <Cell key={row.state} fill={fill} fillOpacity={0.9} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-app-faint">
              No lifecycle data available.
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Activity Log Stream */}
      <div className="admin-glass relative overflow-hidden rounded-app-xl p-5 sm:p-6 ring-1 ring-white/[0.04]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
        <div className="relative mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="m-0 text-sm font-semibold tracking-tight text-app-text">
            Recent activity
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={auditExportHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center rounded-app-lg border border-white/[0.1] bg-white/[0.04] px-3 text-[12px] text-app-muted shadow-inner backdrop-blur-sm transition-[border-color] hover:border-app-accent/45"
            >
              Drill-down export (JSON)
            </a>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter logs..."
              className="h-9 w-44 rounded-app-lg border border-white/[0.1] bg-white/[0.04] px-3 text-[12px] text-app-text shadow-inner outline-none backdrop-blur-sm transition-[border-color,box-shadow] focus:border-app-accent/45 focus:ring-2 focus:ring-app-accent/12"
            />
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as 'all' | ActivityLog['severity'])}
              className="h-9 rounded-app-lg border border-white/[0.1] bg-white/[0.04] px-3 text-[12px] text-app-muted shadow-inner outline-none backdrop-blur-sm transition-[border-color] focus:border-app-accent/45"
            >
              <option value="all">All severities</option>
              <option value="success">Success</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>
        </div>

        <div className="chat-premium-scroll relative flex max-h-[560px] flex-col gap-2 overflow-y-auto overflow-x-hidden pr-1">
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
  const numericValue =
    typeof metric.value === 'number' ? metric.value : parseFloat(String(metric.value));

  const animatedVal = useAnimatedNumber(isNaN(numericValue) ? 0 : numericValue);
  const animatedDisplay = isNaN(numericValue)
    ? metric.value
    : Number.isInteger(numericValue)
      ? Math.round(animatedVal)
      : animatedVal.toFixed(2);

  const changePercent =
    metric.changePercent !== undefined ? parseFloat(metric.changePercent.toFixed(2)) : undefined;

  const TrendIcon =
    metric.trend === 'up' ? TrendingUp : metric.trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    metric.trend === 'up' ? '#34d399' : metric.trend === 'down' ? '#f87171' : '#8f96ad';
  const chipBg =
    metric.trend === 'up'
      ? 'rgba(52,211,153,0.1)'
      : metric.trend === 'down'
        ? 'rgba(248,113,113,0.1)'
        : 'rgba(143,150,173,0.1)';

  const sparkData = generateSparkline(isNaN(numericValue) ? 50 : numericValue);

  // Gradient colors for border
  const gradientFrom =
    metric.trend === 'up'
      ? 'rgba(52,211,153,0.35)'
      : metric.trend === 'down'
        ? 'rgba(248,113,113,0.3)'
        : 'rgba(147,124,248,0.3)';
  const gradientTo = 'rgba(147,124,248,0.1)';

  return (
    <div
      className="admin-gradient-border admin-row-enter"
      style={
        {
          '--row-index': index,
          '--gradient-from': gradientFrom,
          '--gradient-to': gradientTo,
        } as React.CSSProperties
      }
    >
      <div className="flex h-full min-w-0 flex-col gap-2 rounded-[15px] bg-gradient-to-b from-white/[0.05] to-transparent p-4 backdrop-blur-sm">
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
              {changePercent > 0 ? '+' : ''}
              {changePercent}%
            </span>
          )}
        </div>
        <div className="text-[24px] font-bold text-app-text leading-tight break-words tabular-nums">
          {animatedDisplay}
          {metric.unit && (
            <span className="text-[12px] text-app-faint ml-1 font-medium">{metric.unit}</span>
          )}
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
  const severityIcon =
    log.severity === 'error' ? (
      <ShieldAlert size={13} />
    ) : log.severity === 'warning' ? (
      <AlertTriangle size={13} />
    ) : log.severity === 'success' ? (
      <CheckCircle2 size={13} />
    ) : (
      <Clock3 size={13} />
    );
  const severityTone =
    log.severity === 'error'
      ? 'text-rose-300 bg-rose-500/10 border-rose-400/30'
      : log.severity === 'warning'
        ? 'text-amber-300 bg-amber-500/10 border-amber-400/30'
        : log.severity === 'success'
          ? 'text-emerald-300 bg-emerald-500/10 border-emerald-400/30'
          : 'text-blue-300 bg-blue-500/10 border-blue-400/30';

  return (
    <div
      className="admin-row-enter rounded-app-lg border border-white/[0.08] bg-app-bg/55 shadow-sm transition-[border-color,box-shadow] hover:border-white/[0.12] hover:bg-app-bg/70 hover:shadow-app-soft"
      style={{ '--row-index': index } as React.CSSProperties}
    >
      <div className="flex min-h-[44px] flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4">
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
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${severityTone}`}
        >
          {severityIcon}
          {log.severity}
        </span>
        <span className="ml-auto text-[11px] text-app-faint">
          {new Date(log.timestamp).toLocaleString()}
        </span>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1 rounded-app-md border border-white/[0.1] bg-white/[0.04] px-2.5 text-[11px] font-medium text-app-muted transition-[border-color,background-color,color] hover:border-white/[0.16] hover:bg-white/[0.07] hover:text-app-text"
          onClick={() => setExpanded((v) => !v)}
        >
          details {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {expanded ? (
        <div className="grid gap-2 border-t border-white/[0.08] bg-app-bg/20 px-3 py-3 md:grid-cols-2 sm:px-4">
          <div className="rounded-app-md border border-white/[0.08] bg-app-bg/70 p-3">
            <div className="mb-1 text-[10px] uppercase tracking-wide text-app-faint">
              Actor / Network
            </div>
            <div className="text-[12px] text-app-text">
              Actor: {log.userName} ({log.userId})
            </div>
            <div className="text-[12px] text-app-muted">IP: {log.ipAddress}</div>
            <div className="text-[11px] text-app-faint wrap-break-word">
              UA: {log.userAgent || '—'}
            </div>
          </div>
          <div className="rounded-app-md border border-white/[0.08] bg-app-bg/70 p-3">
            <div className="mb-1 text-[10px] uppercase tracking-wide text-app-faint">Status</div>
            <div className="text-[12px] text-app-text">
              {isSuccess ? 'Completed successfully' : 'Failed'}
            </div>
            <div className="text-[11px] text-app-faint">Event ID: {log.id}</div>
          </div>
          <div className="rounded-app-md border border-white/[0.08] bg-app-bg/70 p-3 md:col-span-2">
            <div className="mb-1 text-[10px] uppercase tracking-wide text-app-faint">
              Change payload
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <div className="mb-1 text-[11px] text-app-muted">Previous</div>
                <pre className="max-h-28 overflow-auto rounded-app-md border border-white/[0.06] bg-app-bg/80 p-2 text-[10px] text-app-faint">
                  {compactJson(log.oldValue)}
                </pre>
              </div>
              <div>
                <div className="mb-1 text-[11px] text-app-muted">Current</div>
                <pre className="max-h-28 overflow-auto rounded-app-md border border-white/[0.06] bg-app-bg/80 p-2 text-[10px] text-app-faint">
                  {compactJson(log.newValue)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
