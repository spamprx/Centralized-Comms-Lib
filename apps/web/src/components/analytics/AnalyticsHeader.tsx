import { Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ─── Analytics Header ─────────────────────────────────────────────────────────

export function AnalyticsHeader() {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-bold text-[#e2e4f0] m-0">Analytics Dashboard</h1>
      <p className="text-[13px] text-[#555870] m-0">Track your content performance and engagement metrics</p>
    </div>
  );
}

// ─── Date Range Picker ────────────────────────────────────────────────────────

const DATE_RANGES = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 14 days', value: '14d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'This month', value: 'month' },
  { label: 'Last month', value: 'last-month' },
];

interface DateRangePickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg">
      <Calendar size={14} className="text-[#555870]" />
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-transparent border-none text-[#e2e4f0] text-[13px] cursor-pointer outline-none [&_option]:bg-[#1a1d2e] [&_option]:text-[#e2e4f0]"
      >
        {DATE_RANGES.map(range => (
          <option key={range.value} value={range.value}>{range.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KPI {
  label: string;
  value: string | number;
  change: number;
  trend: 'up' | 'down' | 'stable';
}

export function KPICard({ kpi }: { kpi: KPI }) {
  const TrendIcon = kpi.trend === 'up' ? TrendingUp : kpi.trend === 'down' ? TrendingDown : Minus;
  const trendColor = kpi.trend === 'up' ? 'text-emerald-400' : kpi.trend === 'down' ? 'text-red-400' : 'text-gray-500';

  return (
    <div className="flex-1 min-w-[12rem] p-4 bg-white/[0.03] border border-white/[0.07] rounded-[10px] flex flex-col gap-2">
      <div className="text-[11px] font-semibold tracking-wide uppercase text-[#555870]">{kpi.label}</div>
      <div className="text-2xl font-bold text-[#e2e4f0]">{kpi.value}</div>
      <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
        <TrendIcon size={12} />
        <span>{kpi.change > 0 ? '+' : ''}{kpi.change.toFixed(1)}%</span>
      </div>
    </div>
  );
}

// ─── KPI Cards Row ────────────────────────────────────────────────────────────

export function KPICardsRow({ kpis }: { kpis: KPI[] }) {
  return (
    <div className="flex gap-4 flex-wrap">
      {kpis.map((kpi, i) => <KPICard key={i} kpi={kpi} />)}
    </div>
  );
}
