import { useMemo, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useAnalytics } from '../hooks/useAnalytics';
import { ViewsLineChart } from '../components/analytics/ViewsLineChart';
import { EngagementBarChart } from '../components/analytics/EngagementBarChart';
import { ReadingTimeHistogram } from '../components/analytics/ReadingTimeHistogram';
import { ContentTypeBreakdownPie } from '../components/analytics/ContentTypeBreakdownPie';
import { AIAnalysisSummaryCard } from '../components/analytics/AIAnalysisSummaryCard';
import { TopContentTable } from '../components/analytics/TopContentTable';
import { buildAnalyticsCsv, downloadCsv } from '../lib/analyticsCsv';

// Simple KPI Card component
function KPICardsRow({ kpis }: { kpis: any[] }) {
  return (
    <div className="flex gap-4 flex-wrap mb-6">
      {kpis?.map((kpi, i) => (
        <div key={i} className="p-4 bg-white/[0.03] rounded-[10px] min-w-[200px] flex-1">
          <div className="text-[11px] text-[#555870] uppercase mb-2">{kpi.label}</div>
          <div className="text-2xl font-bold text-[#e2e4f0] mb-1">{kpi.value}</div>
          <div className={`text-xs ${kpi.trend === 'up' ? 'text-emerald-400' : kpi.trend === 'down' ? 'text-red-400' : 'text-gray-500'}`}>
            {kpi.change > 0 ? '+' : ''}{kpi.change.toFixed(1)}%
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsLayout() {
  const [dateRange, setDateRange] = useState('30d');
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
      setExportError(err instanceof Error ? err.message : 'Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  if (error) {
    return <div className="p-6 text-red-400">Error: {error}</div>;
  }

  if (loading) {
    return <div className="p-6 text-[#8b8fa8]">Loading analytics...</div>;
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#e2e4f0] m-0">Analytics Dashboard</h1>
          <p className="text-[13px] text-[#555870] mt-1 mb-0">Track your content performance and engagement metrics</p>
          {exportError && (
            <p className="text-[12px] text-red-400 mt-2 mb-0">{exportError}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[#e2e4f0] text-[13px] cursor-pointer"
          >
            <option value="7d">Last 7 days</option>
            <option value="14d">Last 14 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={loading || exporting}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-colors ${
              loading || exporting
                ? 'bg-white/5 text-[#555870] cursor-not-allowed border border-white/10'
                : 'bg-violet-500/15 text-violet-300 border border-violet-500/25 hover:bg-violet-500/20'
            }`}
            title="Download current dashboard data as CSV"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <KPICardsRow kpis={kpis} />

      {/* Charts Row 1 */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(500px,1fr))] gap-4 mb-4">
        <ViewsLineChart data={viewsData} loading={loading} />
        <EngagementBarChart data={engagementData} loading={loading} />
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(350px,1fr))] gap-4 mb-4">
        <ReadingTimeHistogram data={readingTimeData} loading={loading} />
        <ContentTypeBreakdownPie data={contentTypeData} loading={loading} />
        <AIAnalysisSummaryCard data={aiInsights} loading={loading} />
      </div>

      {/* Top Content Table */}
      <TopContentTable data={topContent} loading={loading} />
    </div>
  );
}
