import { useMemo } from "react";
import { ArrowDown, ArrowUp, Download, FileText, Loader2, Moon, TrendingUp, Trophy, Video, Sparkles } from "lucide-react";
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
} from "recharts";
import type {
  KPI,
  TimeSeriesPoint,
  EngagementData,
  ReadingTimeBucket,
  ContentTypeBreakdown,
  TopContentItem,
  AIInsight,
} from "../../types/analytics";
import { EnhancedDateRangePicker } from "./EnhancedDateRangePicker";
import type { DateRange } from "../../lib/dateUtils";
import { formatDate, parsePresetRange } from "../../lib/dateUtils";

const BG = "#0d0f18";
const SURFACE = "#12141e";
const INNER = "#15172a";
const BORDER = "rgba(255,255,255,0.07)";
const BORDER_SUBTLE = "rgba(255,255,255,0.05)";
const MUTED = "rgba(255,255,255,0.45)";
const MUTED2 = "rgba(255,255,255,0.35)";
const PURPLE = "#7C6FF7";
const AMBER = "#EF9F27";
const TEAL = "#1D9E75";
const BLUE = "#378ADD";
const RED = "#E24B4A";
const GRAY = "#888780";

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
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${mm}-${dd}`;
}

function rangeDisplayLabel(dateRange: string | DateRange): string {
  if (typeof dateRange === "string") {
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
    .join(" ");
  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden>
      <polyline fill="none" stroke={PURPLE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={pts} />
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
    const eng = engagementData.slice(-7).map((d) => (d.views ? Math.round(((d.likes + d.shares + d.comments) / d.views) * 1000) / 10 : 0));
    const act = engagementData.slice(-7).map((d) => Math.round(d.views / 12));
    const pub = engagementData.slice(-7).map((d) => d.shares * 3 + d.comments * 2);
    return [v, eng, act, pub];
  }, [viewsData, engagementData]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi, i) => (
        <div
          key={kpi.label}
          className="flex h-[88px] rounded-xl border px-5 py-4"
          style={{ backgroundColor: SURFACE, borderColor: BORDER }}
        >
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div className="text-[11px] font-medium uppercase tracking-[0.06em]" style={{ color: MUTED }}>
              {kpi.label}
            </div>
            <div className="text-[28px] font-medium leading-none text-white">{kpi.value}</div>
            <div className="flex items-center gap-1 text-[12px] font-medium">
              {kpi.change > 0 ? (
                <span className="inline-flex items-center gap-0.5" style={{ color: TEAL }}>
                  <ArrowUp className="size-3.5" strokeWidth={2} aria-hidden />+{kpi.change.toFixed(1)}%
                </span>
              ) : kpi.change < 0 ? (
                <span className="inline-flex items-center gap-0.5" style={{ color: RED }}>
                  <ArrowDown className="size-3.5" strokeWidth={2} aria-hidden />
                  {kpi.change.toFixed(1)}%
                </span>
              ) : (
                <span className="font-medium" style={{ color: MUTED }}>
                  {kpi.change.toFixed(1)}%
                </span>
              )}
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
  backgroundColor: INNER,
  border: "none",
  borderRadius: 8,
  fontSize: 12,
  color: "#fff",
  padding: "8px 12px",
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
    const rawIdxs = n ? [0, Math.round(n * 0.25), Math.round(n * 0.5), Math.round(n * 0.75), n - 1] : [];
    const idxs = [...new Set(rawIdxs.map((i) => Math.min(Math.max(0, i), n - 1)))].sort((a, b) => a - b);
    const ticks = idxs.map((i) => data[i]?.date).filter(Boolean) as string[];
    return { total: totalN, avg: avgN, peak: peakN, tickDates: ticks };
  }, [data]);

  const tickFormatter = (v: string) => formatShortDate(v);

  if (!chartData.length) {
    return (
      <div className="flex min-h-[240px] flex-col rounded-xl border p-5" style={{ backgroundColor: SURFACE, borderColor: BORDER }}>
        <h2 className="text-[15px] font-medium text-white">Views over time</h2>
        <p className="mt-4 text-[12px] font-normal" style={{ color: MUTED }}>
          No view data for this range.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-col rounded-xl border p-5" style={{ backgroundColor: SURFACE, borderColor: BORDER }}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-medium text-white">Views over time</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border px-2.5 py-1 text-[11px] font-medium" style={{ borderColor: BORDER, color: MUTED }}>
            {total.toLocaleString()} total
          </span>
          <span className="rounded-md border px-2.5 py-1 text-[11px] font-medium" style={{ borderColor: BORDER, color: MUTED }}>
            {avg.toLocaleString()} avg/day
          </span>
          <span className="rounded-md border px-2.5 py-1 text-[11px] font-medium" style={{ borderColor: BORDER, color: MUTED }}>
            {peak.toLocaleString()} peak
          </span>
        </div>
      </div>
      <div className="min-h-[240px] flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={BORDER_SUBTLE} vertical={false} strokeWidth={1} />
            <XAxis
              dataKey="date"
              ticks={tickDates}
              tickFormatter={tickFormatter}
              tick={{ fill: MUTED, fontSize: 11, fontWeight: 400 }}
              axisLine={false}
              tickLine={false}
              dy={8}
            />
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.08)" }}
              contentStyle={tooltipStyle}
              formatter={(value) => [
                typeof value === "number" ? value.toLocaleString() : String(value ?? ""),
                "Views",
              ]}
              labelFormatter={(label) => formatShortDate(String(label))}
            />
            <Line type="monotone" dataKey="value" stroke={PURPLE} strokeWidth={2} dot={false} activeDot={{ r: 3, fill: PURPLE }} />
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
      <div className="flex min-h-[200px] flex-col rounded-xl border p-5" style={{ backgroundColor: SURFACE, borderColor: BORDER }}>
        <h2 className="text-[15px] font-medium text-white">Engagement metrics</h2>
        <p className="mt-4 text-[12px] font-normal" style={{ color: MUTED }}>
          No engagement data for this range.
        </p>
      </div>
    );
  }

  const legend = [
    { key: "views", label: "Views", color: PURPLE },
    { key: "likes", label: "Likes", color: AMBER },
    { key: "shares", label: "Shares", color: TEAL },
    { key: "comments", label: "Comments", color: BLUE },
  ] as const;

  return (
    <div className="flex min-h-0 min-w-0 flex-col rounded-xl border p-5" style={{ backgroundColor: SURFACE, borderColor: BORDER }}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-medium text-white">Engagement metrics</h2>
        <div className="flex flex-wrap items-center gap-4">
          {legend.map((item) => (
            <span key={item.key} className="inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color: MUTED }}>
              <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>
      <div className="analytics-chart-scroll min-h-[200px] w-full overflow-x-auto pb-1">
        <div style={{ minWidth: Math.max(320, data.length * 48) }}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barCategoryGap={12} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={BORDER_SUBTLE} vertical={false} strokeWidth={1} />
              <XAxis dataKey="labelShort" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} dy={8} />
              <YAxis hide />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="views" fill={PURPLE} barSize={6} radius={0} />
              <Bar dataKey="likes" fill={AMBER} barSize={6} radius={0} />
              <Bar dataKey="shares" fill={TEAL} barSize={6} radius={0} />
              <Bar dataKey="comments" fill={BLUE} barSize={6} radius={0} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-4" style={{ borderColor: BORDER }}>
        {[
          { label: "VIEWS", value: totals.views, color: PURPLE },
          { label: "LIKES", value: totals.likes, color: AMBER },
          { label: "SHARES", value: totals.shares, color: TEAL },
          { label: "COMMENTS", value: totals.comments, color: BLUE },
        ].map((t) => (
          <div key={t.label} className="text-center sm:text-left">
            <div className="text-[10px] font-medium uppercase tracking-wide" style={{ color: t.color }}>
              {t.label}
            </div>
            <div className="text-[16px] font-medium text-white">{t.value.toLocaleString()}</div>
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
      <div className="flex min-h-[200px] flex-col rounded-xl border p-5" style={{ backgroundColor: SURFACE, borderColor: BORDER }}>
        <h2 className="text-[15px] font-medium text-white">Reading time distribution</h2>
        <p className="mt-4 text-[12px] font-normal" style={{ color: MUTED }}>
          No reading time data.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-col rounded-xl border p-5" style={{ backgroundColor: SURFACE, borderColor: BORDER }}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-medium text-white">Reading time distribution</h2>
        <span className="text-[12px] font-medium" style={{ color: MUTED }}>
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
            <Bar dataKey="count" fill={PURPLE} barSize={20} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {chartData.map((b) => (
          <div key={b.range} className="text-center">
            <div className="text-[11px] font-medium" style={{ color: MUTED }}>
              {b.range}
            </div>
            <div className="text-[13px] font-medium text-white">{b.count.toLocaleString()}</div>
            <div className="text-[11px] font-medium" style={{ color: MUTED2 }}>
              {b.pct}%
            </div>
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
    if (!pieData.length) return { name: "—", pct: 0 };
    const m = pieData.reduce((a, b) => (b.value > a.value ? b : a));
    return { name: m.name, pct: m.value };
  }, [pieData]);

  const totalPieces = Math.round(pieData.reduce((s, d) => s + d.value, 0));

  if (!data.length) {
    return (
      <div className="flex min-h-[200px] flex-col rounded-xl p-5" style={{ backgroundColor: SURFACE }}>
        <h2 className="text-[15px] font-medium text-white">Content type breakdown</h2>
        <p className="mt-4 text-[12px] font-normal" style={{ color: MUTED }}>
          No content type data.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-col rounded-xl p-5" style={{ backgroundColor: SURFACE }}>
      <h2 className="mb-4 text-[15px] font-medium text-white">Content type breakdown</h2>
      <div className="flex flex-wrap items-center justify-center gap-6 lg:flex-nowrap lg:justify-between">
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
                paddingAngle={4}
                stroke="none"
                cornerRadius={0}
              >
                {pieData.map((entry, i) => (
                  <Cell key={`c-${i}`} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <div className="text-[22px] font-medium text-white">{totalPieces}</div>
            <div className="text-[11px] font-medium" style={{ color: MUTED }}>
              pieces
            </div>
            <div className="mt-1 text-[12px] font-medium" style={{ color: PURPLE }}>
              {top.name} {top.pct}%
            </div>
          </div>
        </div>
        <ul className="min-w-[200px] flex-1 space-y-2.5">
          {pieData.map((row) => (
            <li key={row.name} className="flex items-center gap-2 text-[12px] font-medium">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: row.fill }} />
              <span className="flex-1 text-white">{row.name}</span>
              <span style={{ color: MUTED }}>{row.value}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const insightIcons = [TrendingUp, Video, Moon, FileText] as const;

function severityLabel(impact: AIInsight["impact"]): { text: string; color: string } {
  if (impact === "high") return { text: "HIGH", color: RED };
  if (impact === "medium") return { text: "MEDIUM", color: AMBER };
  return { text: "LOW", color: MUTED };
}

function AIInsightsCard({ insights }: { insights: AIInsight[] }) {
  const list = insights.slice(0, 4);
  return (
    <div className="flex min-h-0 min-w-0 flex-col rounded-xl border p-5" style={{ backgroundColor: SURFACE, borderColor: BORDER }}>
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="size-4" style={{ color: PURPLE }} aria-hidden />
        <h2 className="text-[15px] font-medium text-white">AI insights</h2>
        <span
          className="ml-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium text-white"
          style={{ backgroundColor: PURPLE }}
        >
          {list.length} insights
        </span>
      </div>
      <ul className="divide-y" style={{ borderColor: BORDER }}>
        {list.map((row, i) => {
          const Icon = insightIcons[i] ?? FileText;
          const sev = severityLabel(row.impact);
          const iconColor = row.impact === "high" ? RED : row.impact === "medium" ? AMBER : BLUE;
          return (
            <li key={`${row.title}-${i}`} className="flex gap-3 py-3 first:pt-0">
              <Icon className="mt-0.5 size-4 shrink-0" style={{ color: iconColor }} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-white">{row.title}</div>
                <p className="mt-1 text-[12px] font-normal leading-[1.5]" style={{ color: MUTED }}>
                  {row.description}
                </p>
              </div>
              <div className="shrink-0 self-start text-[11px] font-medium" style={{ color: sev.color }}>
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
    <div className="rounded-xl border p-5" style={{ backgroundColor: SURFACE, borderColor: BORDER }}>
      <div className="mb-4 flex items-center gap-2">
        <Trophy className="size-4" style={{ color: PURPLE }} aria-hidden />
        <h2 className="text-[15px] font-medium text-white">Top performing content</h2>
        <span className="ml-auto text-[12px] font-medium" style={{ color: MUTED }}>
          {data.length} items
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead>
            <tr>
              {["RANK", "TITLE", "VIEWS", "ENGAGEMENT"].map((h) => (
                <th
                  key={h}
                  className={`pb-3 text-[10px] font-medium uppercase tracking-[0.06em] ${h === "VIEWS" || h === "ENGAGEMENT" ? "text-right" : ""}`}
                  style={{ color: MUTED }}
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
                  className="border-t transition-colors duration-150 hover:bg-white/[0.03]"
                  style={{ borderColor: BORDER_SUBTLE }}
                >
                  <td className="py-3 pr-3 align-middle">
                    {rank === 1 ? (
                      <span
                        className="inline-flex size-7 items-center justify-center rounded-full text-[13px] font-medium"
                        style={{ backgroundColor: "rgba(124,111,247,0.2)", color: PURPLE }}
                      >
                        #1
                      </span>
                    ) : rank <= 3 ? (
                      <span
                        className="inline-flex size-7 items-center justify-center rounded-full text-[13px] font-medium"
                        style={{ backgroundColor: "rgba(255,255,255,0.06)", color: MUTED }}
                      >
                        #{rank}
                      </span>
                    ) : (
                      <span className="pl-1 text-[13px] font-medium" style={{ color: MUTED }}>
                        #{rank}
                      </span>
                    )}
                  </td>
                  <td className="max-w-[1px] py-3 pr-3 align-middle">
                    <div className="truncate text-[13px] font-medium text-white" title={row.title}>
                      {row.title}
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-right align-middle text-[13px] font-medium text-white">{row.views.toLocaleString()}</td>
                  <td className="py-3 align-middle">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1 min-w-[72px] flex-1 overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, row.engagement)}%`, backgroundColor: PURPLE }} />
                      </div>
                      <span className="w-9 shrink-0 text-right text-[12px] font-medium tabular-nums" style={{ color: MUTED }}>
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
  const presetValue = typeof dateRange === "string" ? dateRange : "custom";
  const rangeLabel = rangeDisplayLabel(dateRange);

  const pill = (key: string, label: string) => {
    const active = presetValue === key;
    return (
      <button
        type="button"
        key={key}
        onClick={() => onDateRangeChange(key)}
        className="rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors duration-150"
        style={{
          backgroundColor: active ? PURPLE : "transparent",
          color: active ? "#fff" : MUTED,
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      className="analytics-dashboard min-h-screen font-sans text-white antialiased"
      style={{
        backgroundColor: BG,
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        padding: 0,
      }}
    >
      <style>{`
        .analytics-dashboard .analytics-chart-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent; }
        .analytics-dashboard .analytics-chart-scroll::-webkit-scrollbar { height: 3px; }
        .analytics-dashboard .analytics-chart-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 999px; }
        .analytics-dashboard { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent; }
        .analytics-dashboard::-webkit-scrollbar { width: 2px; }
        .analytics-dashboard::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
      `}</style>

      <header
        className="sticky top-0 z-30 flex h-12 w-full items-center justify-between gap-4 border-b transition-colors duration-150"
        style={{ backgroundColor: BG, borderColor: BORDER, paddingLeft: 24, paddingRight: 24 }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
          <span className="shrink-0 text-[18px] font-medium text-white">Analytics</span>
          <span className="h-4 w-px shrink-0" style={{ backgroundColor: BORDER }} aria-hidden />
          <span className="min-w-0 truncate text-[12px] font-normal" style={{ color: MUTED }}>
            Track content performance and engagement
          </span>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
          <EnhancedDateRangePicker
            value={presetValue}
            onChange={onDateRangeChange}
            triggerClassName="flex h-[34px] items-center gap-2 rounded-lg border px-3 text-[12px] font-medium transition-colors duration-150"
            triggerStyle={{
              backgroundColor: "transparent",
              borderColor: BORDER,
              color: "rgba(255,255,255,0.85)",
            }}
            displayLabelOverride={rangeLabel}
            chevronDown
          />
          <button
            type="button"
            onClick={onExportCsv}
            disabled={exporting}
            className="flex h-[34px] items-center gap-2 rounded-lg border px-3 text-[12px] font-medium transition-colors duration-150 hover:bg-white/[0.03] disabled:opacity-50"
            style={{ borderColor: BORDER, color: "rgba(255,255,255,0.85)", backgroundColor: "transparent" }}
          >
            {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" aria-hidden />}
            Export CSV
          </button>
          <div className="flex items-center rounded-full border p-0.5" style={{ borderColor: BORDER, backgroundColor: INNER }}>
            {pill("30d", "30 days")}
            {pill("7d", "7 days")}
            {pill("90d", "90 days")}
          </div>
        </div>
      </header>

      <div style={{ padding: "20px 24px" }}>
      {exportError ? (
        <p className="text-[12px] font-medium" style={{ color: RED }} role="alert">
          {exportError}
        </p>
      ) : null}

      <div className="mt-6 space-y-6">
        <MetricCardsRow kpis={kpis} viewsData={viewsData} engagementData={engagementData} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[55fr_45fr]">
          <ViewsOverTimeCard data={viewsData} />
          <EngagementCard data={engagementData} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
