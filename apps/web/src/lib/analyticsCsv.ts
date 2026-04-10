import type {
  AIInsight,
  ContentTypeBreakdown,
  EngagementData,
  KPI,
  ReadingTimeBucket,
  TimeSeriesPoint,
  TopContentItem,
} from '../data/mockAnalyticsData';

type AnalyticsCsvInput = {
  dateRange: string;
  exportedAt?: Date;
  kpis: KPI[];
  viewsData: TimeSeriesPoint[];
  engagementData: EngagementData[];
  readingTimeData: ReadingTimeBucket[];
  contentTypeData: ContentTypeBreakdown[];
  topContent: TopContentItem[];
  aiInsights: AIInsight[];
};

function escapeCsv(value: string | number | boolean | null | undefined): string {
  const raw = value == null ? '' : String(value);
  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function section(title: string, headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>): string[] {
  return [
    title,
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
    '',
  ];
}

export function buildAnalyticsCsv(input: AnalyticsCsvInput): string {
  const lines: string[] = [
    'Analytics Dashboard Export',
    `Date Range,${escapeCsv(input.dateRange)}`,
    `Exported At,${escapeCsv((input.exportedAt ?? new Date()).toISOString())}`,
    '',
    ...section(
      'KPIs',
      ['Label', 'Value', 'Change', 'Trend'],
      input.kpis.map((kpi) => [kpi.label, kpi.value, kpi.change, kpi.trend]),
    ),
    ...section(
      'Views',
      ['Date', 'Views'],
      input.viewsData.map((row) => [row.date, row.value]),
    ),
    ...section(
      'Engagement',
      ['Label', 'Views', 'Likes', 'Shares', 'Comments'],
      input.engagementData.map((row) => [row.label, row.views, row.likes, row.shares, row.comments]),
    ),
    ...section(
      'Reading Time',
      ['Range', 'Count'],
      input.readingTimeData.map((row) => [row.range, row.count]),
    ),
    ...section(
      'Content Type Breakdown',
      ['Type', 'Value', 'Color'],
      input.contentTypeData.map((row) => [row.type, row.value, row.color]),
    ),
    ...section(
      'Top Content',
      ['ID', 'Title', 'Author', 'Views', 'Engagement', 'Average Read Time', 'Published At'],
      input.topContent.map((row) => [
        row.id,
        row.title,
        row.author,
        row.views,
        row.engagement,
        row.avgReadTime,
        row.publishedAt,
      ]),
    ),
    ...section(
      'AI Insights',
      ['Title', 'Description', 'Sentiment', 'Impact'],
      input.aiInsights.map((row) => [row.title, row.description, row.sentiment, row.impact]),
    ),
  ];

  return lines.join('\n');
}

export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
