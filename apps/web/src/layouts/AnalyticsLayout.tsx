import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAnalytics } from '../hooks/useAnalytics';
import { AnalyticsDashboard } from '../components/analytics/AnalyticsDashboard';
import { buildAnalyticsCsv, downloadCsv } from '../lib/analyticsCsv';
import type { DateRange } from '../lib/dateUtils';
import { formatDateRange } from '../lib/dateUtils';

const BG = '#0d0f18';
const MUTED = 'rgba(255,255,255,0.45)';
const RED = '#E24B4A';
const PURPLE = '#7C6FF7';

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
      <div
        className="flex min-h-screen items-center justify-center px-6 py-10 font-sans text-white"
        style={{ backgroundColor: BG, fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}
      >
        <div
          className="max-w-md rounded-xl border p-6 text-center transition-colors duration-150"
          style={{ borderColor: 'rgba(226,75,74,0.35)', backgroundColor: 'rgba(226,75,74,0.08)' }}
        >
          <p className="m-0 text-[14px] font-medium" style={{ color: RED }}>
            Something went wrong
          </p>
          <p className="mt-2 text-[13px] font-normal leading-relaxed" style={{ color: MUTED }}>
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center gap-3 font-sans text-[13px] font-medium transition-colors duration-150"
        style={{
          backgroundColor: BG,
          color: MUTED,
          fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <Loader2 className="size-5 animate-spin" style={{ color: PURPLE }} aria-hidden />
        Loading analytics…
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
