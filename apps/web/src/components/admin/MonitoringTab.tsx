import { useEffect, useState, useRef } from 'react';
import { useAdminMonitoring } from '../../hooks/useAdmin';
import { RefreshCw, TrendingUp, TrendingDown, Minus, Check, X as XIcon } from 'lucide-react';
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

// ─── Main Component ──────────────────────────────────────────────────

export default function MonitoringTab() {
  const { metrics, logs, loading, error, refetch } = useAdminMonitoring();
  if (error) return <div className="text-red-400 p-6">⚠ {error}</div>;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-app-text mb-1">Monitoring</h2>
          <p className="text-[13px] text-app-faint m-0">System health, metrics, and activity logs</p>
        </div>
        <button
          className="flex items-center gap-1.5 px-3 py-[7px] admin-glass-button rounded-xl text-app-muted text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={refetch}
          disabled={loading}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[110px] rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />
            ))
          : metrics.map((m, idx) => <MetricCard key={m.label} metric={m} index={idx} />)}
      </div>

      {/* Activity Log Timeline */}
      <div className="flex flex-col">
        <h3 className="text-sm font-semibold text-app-muted mb-3">Recent Activity</h3>
        <div className="flex flex-col gap-0 max-h-[480px] overflow-y-auto pr-2">
          {logs.map((log, idx) => (
            <TimelineRow key={log.id} log={log} index={idx} />
          ))}
          {!loading && logs.length === 0 && (
            <div className="text-center text-app-faint p-8 text-sm">No activity logs available.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Metric Card ─────────────────────────────────────────────────────

function MetricCard({ metric, index }: { metric: SystemMetric; index: number }) {
  const numericValue = typeof metric.value === 'number' ? metric.value : parseFloat(String(metric.value));
  const displayValue = isNaN(numericValue)
    ? metric.value
    : Number.isInteger(numericValue)
    ? numericValue
    : numericValue.toFixed(2);

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

function TimelineRow({ log, index }: { log: ActivityLog; index: number }) {
  const actionColor = getActionColor(log.action);
  const isSuccess = log.status === 'success';

  return (
    <div
      className="admin-timeline-item py-3 admin-row-enter"
      style={{ '--row-index': index } as React.CSSProperties}
    >
      {/* Timeline dot */}
      <div
        className="admin-timeline-dot"
        style={{ borderColor: actionColor }}
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
        {/* User */}
        <span className="text-[13px] font-medium text-app-text whitespace-nowrap">{log.userName}</span>

        {/* Action badge */}
        <span
          className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-mono whitespace-nowrap"
          style={{
            color: actionColor,
            background: `${actionColor}15`,
            border: `1px solid ${actionColor}25`,
          }}
        >
          {log.action}
        </span>

        {/* Resource */}
        <span className="text-[12px] text-app-muted truncate flex-1">{log.resource}</span>

        {/* Meta info */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[11px] font-mono text-app-faint">{log.ipAddress}</span>
          <span className="text-[11px] font-mono text-app-faint">
            {new Date(log.timestamp).toLocaleTimeString()}
          </span>

          {/* Status icon */}
          {isSuccess ? (
            <span
              className="flex items-center justify-center w-5 h-5 rounded-full"
              style={{
                color: '#34d399',
                background: 'rgba(52,211,153,0.1)',
                boxShadow: '0 0 8px rgba(52,211,153,0.15)',
              }}
            >
              <Check size={11} strokeWidth={3} />
            </span>
          ) : (
            <span
              className="flex items-center justify-center w-5 h-5 rounded-full"
              style={{
                color: '#f87171',
                background: 'rgba(248,113,113,0.1)',
                boxShadow: '0 0 8px rgba(248,113,113,0.15)',
              }}
            >
              <XIcon size={11} strokeWidth={3} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}