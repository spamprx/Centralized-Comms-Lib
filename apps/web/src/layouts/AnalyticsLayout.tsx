import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAnalytics } from '../hooks/useAnalytics';
import { AnalyticsDashboard } from '../components/analytics/AnalyticsDashboard';
import { buildAnalyticsCsv, downloadCsv } from '../lib/analyticsCsv';
import type { DateRange } from '../lib/dateUtils';
import { formatDateRange } from '../lib/dateUtils';
import { Surface } from '../components/ui/Surface';

export default function AnalyticsLayout() {
  const [dateRange, setDateRange] = useState<string | DateRange>('30d');
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
    const rangeDisplay =
      typeof dateRange === 'string'
        ? dateRange
        : formatDateRange(dateRange).replace(/\s-\s/g, '-to-');
    return `analytics-dashboard-${rangeDisplay}-${stamp}.csv`;
  }, [dateRange]);

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      setExportError(null);

      const csv = buildAnalyticsCsv({
        dateRange: typeof dateRange === 'string' ? dateRange : formatDateRange(dateRange),
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
      setExportError(err instanceof Error ? err.message : 'Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  if (error) {
    return (
      <div className="app-main-canvas flex min-h-screen items-center justify-center px-6 py-10 font-sans">
        <Surface
          variant="glass"
          padding="lg"
          className="max-w-md border border-red-400/25 bg-red-500/[0.08] text-center shadow-app-lift backdrop-blur-xl"
        >
          <p className="m-0 text-[14px] font-semibold tracking-tight text-red-200">
            Something went wrong
          </p>
          <p className="mt-3 m-0 text-[13px] leading-relaxed text-app-muted">{error}</p>
        </Surface>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="app-main-canvas flex min-h-screen flex-col items-center justify-center gap-4 px-6 py-10 font-sans">
        <Surface
          variant="glass"
          padding="lg"
          className="flex items-center gap-3 border border-white/10 shadow-app-lift backdrop-blur-xl"
        >
          <Loader2 className="size-6 animate-spin text-app-accent" strokeWidth={2} aria-hidden />
          <span className="text-[13px] font-medium text-app-muted">Loading analytics…</span>
        </Surface>
      </div>
    );
  }

  return (
    <AnalyticsDashboard
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      kpis={kpis}
      viewsData={viewsData}
      engagementData={engagementData}
      readingTimeData={readingTimeData}
      contentTypeData={contentTypeData}
      topContent={topContent}
      aiInsights={aiInsights}
      exporting={exporting}
      exportError={exportError}
      onExportCsv={handleExportCsv}
    />
  );
}
