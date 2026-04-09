import { useState } from 'react';
import { useAnalytics } from '../hooks/useAnalytics';
import { ViewsLineChart } from '../components/analytics/ViewsLineChart';
import { EngagementBarChart } from '../components/analytics/EngagementBarChart';
import { ReadingTimeHistogram } from '../components/analytics/ReadingTimeHistogram';
import { ContentTypeBreakdownPie } from '../components/analytics/ContentTypeBreakdownPie';
import { AIAnalysisSummaryCard } from '../components/analytics/AIAnalysisSummaryCard';
import { TopContentTable } from '../components/analytics/TopContentTable';

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
        </div>
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
