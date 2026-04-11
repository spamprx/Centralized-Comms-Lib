import { useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useAnalytics } from "../hooks/useAnalytics";
import { ViewsLineChart } from "../components/analytics/ViewsLineChart";
import { EngagementBarChart } from "../components/analytics/EngagementBarChart";
import { ReadingTimeHistogram } from "../components/analytics/ReadingTimeHistogram";
import { ContentTypeBreakdownPie } from "../components/analytics/ContentTypeBreakdownPie";
import { AIAnalysisSummaryCard } from "../components/analytics/AIAnalysisSummaryCard";
import { TopContentTable } from "../components/analytics/TopContentTable";
import { buildAnalyticsCsv, downloadCsv } from "../lib/analyticsCsv";
import type { KPI } from "../data/mockAnalyticsData";
import { Button, PageHeader, PageShell, Surface, formInputClass } from "../components/ui";

function KPICardsRow({ kpis }: { kpis: KPI[] }) {
  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis?.map((kpi, i) => (
        <Surface key={i} padding="sm" className="min-w-0">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-app-faint">
            {kpi.label}
          </div>
          <div className="mb-1 text-2xl font-bold tracking-tight text-app-text">
            {kpi.value}
          </div>
          <div
            className={`text-xs ${
              kpi.trend === "up"
                ? "text-emerald-400"
                : kpi.trend === "down"
                  ? "text-red-400"
                  : "text-app-faint"
            }`}
          >
            {kpi.change > 0 ? "+" : ""}
            {kpi.change.toFixed(1)}%
          </div>
        </Surface>
      ))}
    </div>
  );
}

export default function AnalyticsLayout() {
  const [dateRange, setDateRange] = useState("30d");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const {
    kpis,
    viewsData,
    engagementData,
    readingTimeData,
    contentTypeData,
    topContent,
    aiInsights,
    loading,
    error,
  } = useAnalytics(dateRange);

  const exportFileName = useMemo(() => {
    const stamp = new Date().toISOString().slice(0, 10);
    return `analytics-dashboard-${dateRange}-${stamp}.csv`;
  }, [dateRange]);

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      setExportError(null);

      const csv = buildAnalyticsCsv({
        dateRange,
        exportedAt: new Date(),
        kpis,
        viewsData,
        engagementData,
        readingTimeData,
        contentTypeData,
        topContent,
        aiInsights,
      });

      downloadCsv(exportFileName, csv);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Failed to export CSV");
    } finally {
      setExporting(false);
    }
  };

  if (error) {
    return (
      <PageShell wide>
        <Surface padding="md" className="border-red-500/30 bg-red-500/10 text-red-200">
          <p className="m-0 text-sm font-medium">Something went wrong</p>
          <p className="mt-1 text-sm text-red-100/90">{error}</p>
        </Surface>
      </PageShell>
    );
  }

  if (loading) {
    return (
      <PageShell wide className="flex min-h-[40vh] items-center justify-center text-app-muted">
        <div className="flex items-center gap-3 text-sm">
          <Loader2 className="h-5 w-5 animate-spin text-app-accent" aria-hidden />
          Loading analytics…
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell wide>
      <PageHeader
        title="Analytics"
        description="Track content performance and engagement."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className={`${formInputClass} w-auto min-w-[10rem] py-2 text-[13px]`}
              aria-label="Date range"
            >
              <option value="7d">Last 7 days</option>
              <option value="14d">Last 14 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
            <Button
              type="button"
              variant="secondary"
              disabled={loading || exporting}
              onClick={handleExportCsv}
              title="Download current dashboard data as CSV"
              leftIcon={
                exporting ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                ) : (
                  <Download size={14} aria-hidden />
                )
              }
            >
              {exporting ? "Exporting…" : "Export CSV"}
            </Button>
          </div>
        }
      />
      {exportError ? (
        <p className="mb-4 text-sm text-red-300" role="alert">
          {exportError}
        </p>
      ) : null}

      <div className="animate-fade-in space-y-6">
        <KPICardsRow kpis={kpis} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ViewsLineChart data={viewsData} loading={loading} />
          <EngagementBarChart data={engagementData} loading={loading} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ReadingTimeHistogram data={readingTimeData} loading={loading} />
          <ContentTypeBreakdownPie data={contentTypeData} loading={loading} />
          <AIAnalysisSummaryCard data={aiInsights} loading={loading} />
        </div>

        <TopContentTable data={topContent} loading={loading} />
      </div>
    </PageShell>
  );
}
