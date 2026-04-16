import { useMemo } from 'react';
import {
  Download,
  FileText,
  Loader2,
  Moon,
  TrendingUp,
  Trophy,
  Video,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type {
  KPI,
  TimeSeriesPoint,
  EngagementData,
  ReadingTimeBucket,
  ContentTypeBreakdown,
  TopContentItem,
  AIInsight,
} from '../../types/analytics';
import { EnhancedDateRangePicker } from './EnhancedDateRangePicker';
import type { DateRange } from '../../lib/dateUtils';
import { formatDate, parsePresetRange } from '../../lib/dateUtils';

/** Chart strokes/fills aligned with `index.css` app tokens */
const SURFACE_GLASS =
  'relative overflow-hidden rounded-app-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.07] to-white/[0.02] shadow-app-lift backdrop-blur-xl supports-backdrop-filter:bg-app-bg/40';
const BORDER_SUBTLE = 'rgba(255,255,255,0.06)';
const MUTED = 'rgba(236,238,244,0.5)';
const PURPLE = '#937cf8';
const AMBER = '#fbbf24';
const TEAL = '#2dd4bf';
const BLUE = '#38bdf8';
const RED = '#f87171';
const GRAY = '#8892a8';

const TYPE_FILLS: Record<string, string> = {
  articles: PURPLE,
  videos: TEAL,
  podcasts: AMBER,
  infographics: BLUE,
  documents: GRAY,
};

function typeFill(type: string): string {
  const key = type.trim().toLowerCase();
  return TYPE_FILLS[key] ?? PURPLE;
}

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${mm}-${dd}`;
}

function rangeDisplayLabel(dateRange: string | DateRange): string {
  if (typeof dateRange === 'string') {
    const parsed = parsePresetRange(dateRange);
    if (parsed) {
      return `${formatDate(parsed.from)} — ${formatDate(parsed.to)}`;
    }
    return dateRange;
  }
  return `${formatDate(dateRange.from)} — ${formatDate(dateRange.to)}`;
}

function Sparkline({ values }: { values: number[] }) {
  const w = 40;
  const h = 24;
  if (values.length < 2) {
    return <svg width={w} height={h} aria-hidden className="shrink-0 opacity-40" />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const rng = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / rng) * (h - 2) - 1;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden>
      <polyline
        fill="none"
        stroke={PURPLE}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
        style={{ filter: 'drop-shadow(0 0 6px rgba(147,124,248,0.35))' }}
      />
    </svg>
  );
}

function MetricCardsRow({
  kpis,
  viewsData,
  engagementData,
}: {
  kpis: KPI[];
  viewsData: TimeSeriesPoint[];
  engagementData: EngagementData[];
}) {
  const sparkByIndex = useMemo(() => {
    const v = viewsData.slice(-7).map((d) => d.value);
    const eng = engagementData
      .slice(-7)
      .map((d) =>
        d.views ? Math.round(((d.likes + d.shares + d.comments) / d.views) * 1000) / 10 : 0,
      );
    const act = engagementData.slice(-7).map((d) => Math.round(d.views / 12));
    const pub = engagementData.slice(-7).map((d) => d.shares * 3 + d.comments * 2);
    return [v, eng, act, pub];
  }, [viewsData, engagementData]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi, i) => (
        <div
          key={kpi.label}
          className={`${SURFACE_GLASS} flex h-[88px] px-5 py-4 transition-transform duration-300 ease-out motion-reduce:transition-none hover:-translate-y-0.5 motion-reduce:hover:translate-y-0`}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-app-accent/35 to-transparent"
            aria-hidden
          />
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-app-faint">
              {kpi.label}
            </div>
            <div className="text-[28px] font-semibold leading-none tracking-tight text-app-text">
              {kpi.value}
            </div>
          </div>
          <div className="flex shrink-0 items-end pb-0.5">
            <Sparkline values={sparkByIndex[i] ?? []} />
          </div>
        </div>
      ))}
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: 'rgba(8, 10, 15, 0.92)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  fontSize: 12,
  color: '#eceef4',
  padding: '10px 14px',
  boxShadow: '0 12px 40px -12px rgba(0,0,0,0.55)',
};

function ViewsOverTimeCard({ data }: { data: TimeSeriesPoint[] }) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        short: formatShortDate(d.date),
      })),
    [data],
  );

  const { total, avg, peak, tickDates } = useMemo(() => {
    const totalN = data.reduce((s, d) => s + d.value, 0);
    const avgN = data.length ? Math.round(totalN / data.length) : 0;
    const peakN = data.length ? Math.max(...data.map((d) => d.value)) : 0;
    const n = data.length;
    const rawIdxs = n
      ? [0, Math.round(n * 0.25), Math.round(n * 0.5), Math.round(n * 0.75), n - 1]
      : [];
    const idxs = [...new Set(rawIdxs.map((i) => Math.min(Math.max(0, i), n - 1)))].sort(
      (a, b) => a - b,
    );
    const ticks = idxs.map((i) => data[i]?.date).filter(Boolean) as string[];
    return { total: totalN, avg: avgN, peak: peakN, tickDates: ticks };
  }, [data]);

  const tickFormatter = (v: string) => formatShortDate(v);

  if (!chartData.length) {
    return (
      <div className={`${SURFACE_GLASS} flex min-h-[240px] flex-col p-5`}>
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-app-accent/35 to-transparent"
          aria-hidden
        />
        <h2 className="text-[15px] font-semibold tracking-tight text-app-text">Views over time</h2>
        <p className="mt-4 text-[12px] leading-relaxed text-app-muted">
          No view data for this range.
        </p>
      </div>
    );
  }

  return (
    <div className={`${SURFACE_GLASS} flex min-h-0 min-w-0 flex-col p-5`}>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-app-accent/35 to-transparent"
        aria-hidden
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold tracking-tight text-app-text">Views over time</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-app-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium tabular-nums text-app-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            {total.toLocaleString()} total
          </span>
          <span className="rounded-app-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium tabular-nums text-app-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            {avg.toLocaleString()} avg/day
          </span>
          <span className="rounded-app-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium tabular-nums text-app-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            {peak.toLocaleString()} peak
          </span>
        </div>
      </div>
      <div className="min-h-[240px] w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={BORDER_SUBTLE} vertical={false} strokeWidth={1} />
            <XAxis
              dataKey="date"
              ticks={tickDates}
              tickFormatter={tickFormatter}
              tick={{ fill: MUTED, fontSize: 11, fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              dy={8}
            />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip
              cursor={{ stroke: 'rgba(147,124,248,0.25)', strokeWidth: 1 }}
              contentStyle={tooltipStyle}
              formatter={(value) => [
                typeof value === 'number' ? value.toLocaleString() : String(value ?? ''),
                'Views',
              ]}
              labelFormatter={(label) => formatShortDate(String(label))}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={PURPLE}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: PURPLE, stroke: '#eceef4', strokeWidth: 1 }}
              animationDuration={800}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function EngagementCard({ data }: { data: EngagementData[] }) {
  const totals = useMemo(() => {
    return data.reduce(
      (acc, d) => {
        acc.views += d.views;
        acc.likes += d.likes;
        acc.shares += d.shares;
        acc.comments += d.comments;
        return acc;
      },
      { views: 0, likes: 0, shares: 0, comments: 0 },
    );
  }, [data]);

  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        labelShort: d.label,
      })),
    [data],
  );

  if (!data.length) {
    return (
      <div className={`${SURFACE_GLASS} flex min-h-[200px] flex-col p-5`}>
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-app-accent-2/30 to-transparent"
          aria-hidden
        />
        <h2 className="text-[15px] font-semibold tracking-tight text-app-text">
          Engagement metrics
        </h2>
        <p className="mt-4 text-[12px] leading-relaxed text-app-muted">
          No engagement data for this range.
        </p>
      </div>
    );
  }

  const legend = [
    { key: 'views', label: 'Views', color: PURPLE },
    { key: 'likes', label: 'Likes', color: AMBER },
    { key: 'shares', label: 'Shares', color: TEAL },
    { key: 'comments', label: 'Comments', color: BLUE },
  ] as const;

  return (
    <div className={`${SURFACE_GLASS} flex min-h-0 min-w-0 flex-col p-5`}>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
        aria-hidden
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold tracking-tight text-app-text">
          Engagement metrics
        </h2>
        <div className="flex flex-wrap items-center gap-4">
          {legend.map((item) => (
            <span
              key={item.key}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-app-muted"
            >
              <span
                className="size-2 rounded-full shadow-[0_0_8px_currentColor]"
                style={{ backgroundColor: item.color }}
              />
              {item.label}
            </span>
          ))}
        </div>
      </div>
      <div className="analytics-chart-scroll min-h-[200px] w-full overflow-x-auto pb-1">
        <div style={{ minWidth: Math.max(320, data.length * 48) }}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={chartData}
              barCategoryGap={12}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke={BORDER_SUBTLE} vertical={false} strokeWidth={1} />
              <XAxis
                dataKey="labelShort"
                tick={{ fill: MUTED, fontSize: 11, fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                dy={8}
              />
              <YAxis hide />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar
                dataKey="views"
                fill={PURPLE}
                barSize={7}
                radius={[5, 5, 0, 0]}
                animationDuration={700}
                animationEasing="ease-out"
              />
              <Bar
                dataKey="likes"
                fill={AMBER}
                barSize={7}
                radius={[5, 5, 0, 0]}
                animationDuration={700}
                animationEasing="ease-out"
              />
              <Bar
                dataKey="shares"
                fill={TEAL}
                barSize={7}
                radius={[5, 5, 0, 0]}
                animationDuration={700}
                animationEasing="ease-out"
              />
              <Bar
                dataKey="comments"
                fill={BLUE}
                barSize={7}
                radius={[5, 5, 0, 0]}
                animationDuration={700}
                animationEasing="ease-out"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.08] pt-4 sm:grid-cols-4">
        {[
          { label: 'VIEWS', value: totals.views, color: PURPLE },
          { label: 'LIKES', value: totals.likes, color: AMBER },
          { label: 'SHARES', value: totals.shares, color: TEAL },
          { label: 'COMMENTS', value: totals.comments, color: BLUE },
        ].map((t) => (
          <div key={t.label} className="text-center sm:text-left">
            <div
              className="text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: t.color }}
            >
              {t.label}
            </div>
            <div className="text-[16px] font-semibold tabular-nums text-app-text">
              {t.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReadingTimeCard({ data }: { data: ReadingTimeBucket[] }) {
  const totalReads = useMemo(() => data.reduce((s, b) => s + b.count, 0), [data]);
  const chartData = useMemo(
    () =>
      data.map((b) => ({
        ...b,
        pct: totalReads ? Math.round((b.count / totalReads) * 1000) / 10 : 0,
      })),
    [data, totalReads],
  );

  if (!data.length) {
    return (
      <div className={`${SURFACE_GLASS} flex min-h-[200px] flex-col p-5`}>
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-app-accent/35 to-transparent"
          aria-hidden
        />
        <h2 className="text-[15px] font-semibold tracking-tight text-app-text">
          Reading time distribution
        </h2>
        <p className="mt-4 text-[12px] leading-relaxed text-app-muted">No reading time data.</p>
      </div>
    );
  }

  return (
    <div className={`${SURFACE_GLASS} flex min-h-0 min-w-0 flex-col p-5`}>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-app-accent/35 to-transparent"
        aria-hidden
      />
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold tracking-tight text-app-text">
          Reading time distribution
        </h2>
        <span className="rounded-app-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[12px] font-medium tabular-nums text-app-muted">
          {totalReads.toLocaleString()} reads
        </span>
      </div>
      <div className="min-h-[200px] w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
            <CartesianGrid stroke={BORDER_SUBTLE} vertical={false} strokeWidth={1} />
            <XAxis dataKey="range" hide />
            <YAxis hide />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar
              dataKey="count"
              fill={PURPLE}
              barSize={22}
              radius={[8, 8, 0, 0]}
              animationDuration={700}
              animationEasing="ease-out"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {chartData.map((b) => (
          <div
            key={b.range}
            className="rounded-app-md border border-white/[0.06] bg-white/[0.03] px-2 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          >
            <div className="text-[11px] font-medium text-app-muted">{b.range}</div>
            <div className="text-[13px] font-semibold tabular-nums text-app-text">
              {b.count.toLocaleString()}
            </div>
            <div className="text-[11px] font-medium tabular-nums text-app-faint">{b.pct}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContentTypeCard({ data }: { data: ContentTypeBreakdown[] }) {
  const pieData = useMemo(
    () =>
      data.map((d) => ({
        name: d.type,
        value: d.value,
        fill: typeFill(d.type),
      })),
    [data],
  );

  const top = useMemo(() => {
    if (!pieData.length) return { name: '—', pct: 0 };
    const m = pieData.reduce((a, b) => (b.value > a.value ? b : a));
    return { name: m.name, pct: m.value };
  }, [pieData]);

  const totalPieces = Math.round(pieData.reduce((s, d) => s + d.value, 0));

  if (!data.length) {
    return (
      <div className={`${SURFACE_GLASS} flex min-h-[200px] flex-col p-5`}>
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-app-accent-2/35 to-transparent"
          aria-hidden
        />
        <h2 className="text-[15px] font-semibold tracking-tight text-app-text">
          Content type breakdown
        </h2>
        <p className="mt-4 text-[12px] leading-relaxed text-app-muted">No content type data.</p>
      </div>
    );
  }

  return (
    <div className={`${SURFACE_GLASS} flex min-h-0 min-w-0 flex-col p-5`}>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-app-accent-2/35 to-transparent"
        aria-hidden
      />
      <h2 className="mb-4 text-[15px] font-semibold tracking-tight text-app-text">
        Content type breakdown
      </h2>
      <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[240px_1fr]">
        <div className="flex items-center justify-center">
          <div className="relative flex h-[220px] w-[220px] shrink-0 items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={68}
                outerRadius={88}
                paddingAngle={3}
                stroke="none"
                cornerRadius={5}
                animationDuration={900}
                animationEasing="ease-out"
              >
                {pieData.map((entry, i) => (
                  <Cell key={`c-${i}`} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <div className="text-[22px] font-semibold tabular-nums text-app-text">
              {totalPieces}
            </div>
            <div className="text-[11px] font-medium text-app-muted">pieces</div>
            <div className="mt-1 text-[12px] font-semibold text-app-accent">
              {top.name} {top.pct}%
            </div>
          </div>
          </div>
        </div>
        <ul className="min-w-0 space-y-2">
          {pieData.map((row) => (
            <li
              key={row.name}
              className="flex items-center gap-2 rounded-app-md border border-white/[0.06] bg-white/[0.03] px-2.5 py-2 text-[12px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            >
              <span
                className="size-2 shrink-0 rounded-full shadow-[0_0_10px_currentColor]"
                style={{ backgroundColor: row.fill }}
              />
              <span className="flex-1 text-app-text">{row.name}</span>
              <span className="tabular-nums text-app-muted">{row.value}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const insightIcons = [TrendingUp, Video, Moon, FileText] as const;

function severityLabel(impact: AIInsight['impact']): { text: string; color: string } {
  if (impact === 'high') return { text: 'HIGH', color: RED };
  if (impact === 'medium') return { text: 'MEDIUM', color: AMBER };
  return { text: 'LOW', color: MUTED };
}

function AIInsightsCard({ insights }: { insights: AIInsight[] }) {
  const list = insights.slice(0, 4);
  return (
    <div className={`${SURFACE_GLASS} flex min-h-0 min-w-0 flex-col p-5`}>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-app-accent/40 to-app-accent-2/25"
        aria-hidden
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Sparkles className="size-4 text-app-accent" strokeWidth={2} aria-hidden />
        <h2 className="text-[15px] font-semibold tracking-tight text-app-text">AI insights</h2>
        <span className="ml-1 rounded-full border border-app-accent/30 bg-app-accent/20 px-2.5 py-0.5 text-[11px] font-semibold text-app-accent">
          {list.length} insights
        </span>
      </div>
      <ul className="divide-y divide-white/[0.07]">
        {list.map((row, i) => {
          const Icon = insightIcons[i] ?? FileText;
          const sev = severityLabel(row.impact);
          const iconColor = row.impact === 'high' ? RED : row.impact === 'medium' ? AMBER : BLUE;
          return (
            <li
              key={`${row.title}-${i}`}
              className="flex gap-3 py-3.5 transition-colors duration-200 first:pt-0 hover:bg-white/[0.02]"
            >
              <Icon
                className="mt-0.5 size-4 shrink-0"
                style={{ color: iconColor }}
                strokeWidth={2}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-app-text">{row.title}</div>
                <p className="mt-1 text-[12px] leading-relaxed text-app-muted">{row.description}</p>
              </div>
              <div
                className="shrink-0 self-start text-[11px] font-semibold tracking-wide"
                style={{ color: sev.color }}
              >
                {sev.text}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TopPerformingContentTable({ rows }: { rows: TopContentItem[] }) {
  const data = rows.slice(0, 6);
  return (
    <div className={`${SURFACE_GLASS} p-5`}>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/25 to-app-accent/35"
        aria-hidden
      />
      <div className="relative mb-4 flex flex-wrap items-center gap-2">
        <Trophy className="size-4 text-app-accent" strokeWidth={2} aria-hidden />
        <h2 className="text-[15px] font-semibold tracking-tight text-app-text">
          Top performing content
        </h2>
        <span className="ml-auto rounded-app-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[12px] font-medium tabular-nums text-app-muted">
          {data.length} items
        </span>
      </div>
      <div className="overflow-x-auto rounded-app-lg border border-white/[0.06] bg-white/[0.02]">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead>
            <tr className="border-b border-white/[0.08]">
              {['RANK', 'TITLE', 'VIEWS', 'ENGAGEMENT'].map((h) => (
                <th
                  key={h}
                  className={`px-3 pb-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-app-faint ${h === 'VIEWS' || h === 'ENGAGEMENT' ? 'text-right' : ''}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => {
              const rank = index + 1;
              return (
                <tr
                  key={row.id}
                  className="border-t border-white/[0.05] transition-colors duration-200 hover:bg-white/[0.04]"
                >
                  <td className="px-3 py-3 align-middle">
                    {rank === 1 ? (
                      <span className="inline-flex size-7 items-center justify-center rounded-full border border-app-accent/35 bg-app-accent/20 text-[13px] font-semibold text-app-accent shadow-[0_0_16px_-6px_rgba(147,124,248,0.5)]">
                        #1
                      </span>
                    ) : rank <= 3 ? (
                      <span className="inline-flex size-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-[13px] font-medium text-app-muted">
                        #{rank}
                      </span>
                    ) : (
                      <span className="pl-1 text-[13px] font-medium text-app-muted">#{rank}</span>
                    )}
                  </td>
                  <td className="max-w-[1px] px-3 py-3 align-middle">
                    <div
                      className="truncate text-[13px] font-medium text-app-text"
                      title={row.title}
                    >
                      {row.title}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right align-middle text-[13px] font-semibold tabular-nums text-app-text">
                    {row.views.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 min-w-[72px] flex-1 overflow-hidden rounded-full bg-white/[0.08] ring-1 ring-inset ring-white/[0.04]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-app-accent to-app-accent-2 transition-[width] duration-500 ease-out"
                          style={{ width: `${Math.min(100, row.engagement)}%` }}
                        />
                      </div>
                      <span className="w-9 shrink-0 text-right text-[12px] font-medium tabular-nums text-app-muted">
                        {row.engagement}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export interface AnalyticsDashboardProps {
  dateRange: string | DateRange;
  onDateRangeChange: (v: string | DateRange) => void;
  kpis: KPI[];
  viewsData: TimeSeriesPoint[];
  engagementData: EngagementData[];
  readingTimeData: ReadingTimeBucket[];
  contentTypeData: ContentTypeBreakdown[];
  topContent: TopContentItem[];
  aiInsights: AIInsight[];
  exporting: boolean;
  exportError: string | null;
  onExportCsv: () => void;
}

export function AnalyticsDashboard({
  dateRange,
  onDateRangeChange,
  kpis,
  viewsData,
  engagementData,
  readingTimeData,
  contentTypeData,
  topContent,
  aiInsights,
  exporting,
  exportError,
  onExportCsv,
}: AnalyticsDashboardProps) {
  const presetValue = typeof dateRange === 'string' ? dateRange : 'custom';
  const rangeLabel = rangeDisplayLabel(dateRange);

  const pill = (key: string, label: string) => {
    const active = presetValue === key;
    return (
      <button
        type="button"
        key={key}
        onClick={() => onDateRangeChange(key)}
        className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all duration-200 ${
          active
            ? 'bg-gradient-to-r from-app-accent to-app-accent-2 text-app-bg shadow-[0_0_20px_-8px_rgba(147,124,248,0.55)]'
            : 'text-app-muted hover:bg-white/[0.08] hover:text-app-text'
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="analytics-dashboard app-main-canvas min-h-screen font-sans text-app-text antialiased">
      <header className="sticky top-0 z-30 flex min-h-12 w-full items-center justify-between gap-4 border-b border-white/[0.08] bg-app-bg/70 px-5 py-3 shadow-[0_8px_32px_-16px_rgba(0,0,0,0.45)] backdrop-blur-xl supports-backdrop-filter:bg-app-bg/55 sm:px-6 md:px-8">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-app-accent/40 to-app-accent-2/25"
          aria-hidden
        />
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
          <span className="shrink-0 text-lg font-semibold tracking-tight text-app-text">
            Analytics
          </span>
          <span className="h-4 w-px shrink-0 bg-white/10" aria-hidden />
          <span className="min-w-0 truncate text-[12px] text-app-muted">
            Track content performance and engagement
          </span>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
          <EnhancedDateRangePicker
            value={presetValue}
            onChange={onDateRangeChange}
            triggerClassName="flex h-9 items-center gap-2 rounded-app-lg border border-white/10 bg-white/[0.05] px-3 text-[12px] font-medium text-app-text shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all duration-200 hover:border-app-accent/35 hover:bg-white/[0.08]"
            displayLabelOverride={rangeLabel}
            chevronDown
          />
          <button
            type="button"
            onClick={onExportCsv}
            disabled={exporting}
            className="flex h-9 items-center gap-2 rounded-app-lg border border-white/10 bg-white/[0.04] px-3 text-[12px] font-semibold text-app-text shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-200 hover:border-app-accent/30 hover:bg-white/[0.08] disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="size-3.5 animate-spin text-app-accent" strokeWidth={2} />
            ) : (
              <Download className="size-3.5 text-app-muted" strokeWidth={2} aria-hidden />
            )}
            Export CSV
          </button>
          <div className="flex items-center rounded-full border border-white/10 bg-white/[0.05] p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            {pill('30d', '30 days')}
            {pill('7d', '7 days')}
            {pill('90d', '90 days')}
          </div>
        </div>
      </header>

      <div className="px-5 py-6 sm:px-6 md:px-8 md:py-8">
        {exportError ? (
          <div
            className="mb-4 rounded-app-lg border border-red-400/25 bg-red-500/10 px-3 py-2 text-[12px] font-medium text-red-200"
            role="alert"
          >
            {exportError}
          </div>
        ) : null}

        <div className="space-y-8">
          <MetricCardsRow kpis={kpis} viewsData={viewsData} engagementData={engagementData} />

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[55fr_45fr]">
            <ViewsOverTimeCard data={viewsData} />
            <EngagementCard data={engagementData} />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <ReadingTimeCard data={readingTimeData} />
            <ContentTypeCard data={contentTypeData} />
            <AIInsightsCard insights={aiInsights} />
          </div>

          <TopPerformingContentTable rows={topContent} />
        </div>
      </div>
    </div>
  );
}
