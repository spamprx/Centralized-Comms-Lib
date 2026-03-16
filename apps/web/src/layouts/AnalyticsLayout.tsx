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
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
      {kpis?.map((kpi, i) => (
        <div key={i} style={{ padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 10, minWidth: 200, flex: 1 }}>
          <div style={{ fontSize: 11, color: '#555870', textTransform: 'uppercase', marginBottom: 8 }}>{kpi.label}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#e2e4f0', marginBottom: 4 }}>{kpi.value}</div>
          <div style={{ fontSize: 12, color: kpi.trend === 'up' ? '#34d399' : kpi.trend === 'down' ? '#f87171' : '#6b7280' }}>
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
    return <div style={{ padding: 24, color: '#f87171' }}>Error: {error}</div>;
  }

  if (loading) {
    return <div style={{ padding: 24, color: '#8b8fa8' }}>Loading analytics...</div>;
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e2e4f0', margin: 0 }}>Analytics Dashboard</h1>
          <p style={{ fontSize: 13, color: '#555870', margin: '4px 0 0' }}>Track your content performance and engagement metrics</p>
        </div>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          style={{
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            color: '#e2e4f0',
            fontSize: 13,
            cursor: 'pointer',
          }}
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: 16, marginBottom: 16 }}>
        <ViewsLineChart data={viewsData} loading={loading} />
        <EngagementBarChart data={engagementData} loading={loading} />
      </div>

      {/* Charts Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 16, marginBottom: 16 }}>
        <ReadingTimeHistogram data={readingTimeData} loading={loading} />
        <ContentTypeBreakdownPie data={contentTypeData} loading={loading} />
        <AIAnalysisSummaryCard data={aiInsights} loading={loading} />
      </div>

      {/* Top Content Table */}
      <TopContentTable data={topContent} loading={loading} />
    </div>
  );
}
