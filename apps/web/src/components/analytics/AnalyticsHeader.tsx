import { Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ─── Analytics Header ─────────────────────────────────────────────────────────

export function AnalyticsHeader() {
  return (
    <div className="analytics-header">
      <h1 className="analytics-header__title">Analytics Dashboard</h1>
      <p className="analytics-header__subtitle">Track your content performance and engagement metrics</p>
      <style>{`
        .analytics-header { display: flex; flex-direction: column; gap: 4px; }
        .analytics-header__title { font-size: 24px; font-weight: 700; color: #e2e4f0; margin: 0; }
        .analytics-header__subtitle { font-size: 13px; color: #555870; margin: 0; }
      `}</style>
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
    <div className="date-range-picker">
      <Calendar size={14} className="date-range-picker__icon" />
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="date-range-picker__select"
      >
        {DATE_RANGES.map(range => (
          <option key={range.value} value={range.value}>{range.label}</option>
        ))}
      </select>
      <style>{`
        .date-range-picker {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 12px; background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
        }
        .date-range-picker__icon { color: #555870; }
        .date-range-picker__select {
          background: none; border: none; color: #e2e4f0;
          font-size: 13px; cursor: pointer; outline: none;
        }
        .date-range-picker__select option { background: #1a1d2e; color: #e2e4f0; }
      `}</style>
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
  const trendColor = kpi.trend === 'up' ? '#34d399' : kpi.trend === 'down' ? '#f87171' : '#6b7280';

  return (
    <div className="kpi-card">
      <div className="kpi-card__label">{kpi.label}</div>
      <div className="kpi-card__value">{kpi.value}</div>
      <div className="kpi-card__trend" style={{ color: trendColor }}>
        <TrendIcon size={12} />
        <span>{kpi.change > 0 ? '+' : ''}{kpi.change.toFixed(1)}%</span>
      </div>
      <style>{`
        .kpi-card {
          flex: 1; min-width: 12rem; padding: 16px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px; display: flex; flex-direction: column; gap: 8px;
        }
        .kpi-card__label { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #555870; }
        .kpi-card__value { font-size: 24px; font-weight: 700; color: #e2e4f0; }
        .kpi-card__trend { display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 500; }
      `}</style>
    </div>
  );
}

// ─── KPI Cards Row ────────────────────────────────────────────────────────────

export function KPICardsRow({ kpis }: { kpis: KPI[] }) {
  return (
    <div className="kpi-cards-row">
      {kpis.map((kpi, i) => <KPICard key={i} kpi={kpi} />)}
      <style>{`
        .kpi-cards-row { display: flex; gap: 16px; flex-wrap: wrap; }
      `}</style>
    </div>
  );
}
