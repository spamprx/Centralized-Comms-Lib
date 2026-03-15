// ─── Analytics Mock Data ──────────────────────────────────────────────────────

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export interface KPI {
  label: string;
  value: string | number;
  change: number;
  trend: 'up' | 'down' | 'stable';
}

export interface EngagementData {
  label: string;
  views: number;
  likes: number;
  shares: number;
  comments: number;
}

export interface ReadingTimeBucket {
  range: string;
  count: number;
}

export interface ContentTypeBreakdown {
  type: string;
  value: number;
  color: string;
}

export interface TopContentItem {
  id: string;
  title: string;
  author: string;
  views: number;
  engagement: number;
  avgReadTime: string;
  publishedAt: string;
}

export interface AIInsight {
  title: string;
  description: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  impact: 'high' | 'medium' | 'low';
}

// Generate last N days dates
function generateDates(days: number): string[] {
  const dates: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

// ─── Mock KPI Data ────────────────────────────────────────────────────────────

export const mockKPIs: KPI[] = [
  { label: 'Total Views', value: '128,450', change: 12.5, trend: 'up' },
  { label: 'Avg. Engagement', value: '68.3%', change: 5.2, trend: 'up' },
  { label: 'Active Users', value: '8,234', change: -2.1, trend: 'down' },
  { label: 'Content Published', value: '1,247', change: 8.7, trend: 'up' },
];

// ─── Mock Views Time Series (Last 30 Days) ───────────────────────────────────

const viewsDates = generateDates(30);
export const mockViewsData: TimeSeriesPoint[] = viewsDates.map((date) => ({
  date,
  value: Math.floor(3000 + Math.random() * 2000 + Math.sin(Math.random() * 10) * 500),
}));

// ─── Mock Engagement Data (Last 7 Days) ──────────────────────────────────────

const engagementDates = generateDates(7);
export const mockEngagementData: EngagementData[] = engagementDates.map((date) => ({
  label: date.slice(5), // MM-DD format
  views: Math.floor(4000 + Math.random() * 1500),
  likes: Math.floor(800 + Math.random() * 300),
  shares: Math.floor(200 + Math.random() * 100),
  comments: Math.floor(150 + Math.random() * 80),
}));

// ─── Mock Reading Time Histogram ─────────────────────────────────────────────

export const mockReadingTimeData: ReadingTimeBucket[] = [
  { range: '0-1 min', count: 1250 },
  { range: '1-3 min', count: 3420 },
  { range: '3-5 min', count: 2890 },
  { range: '5-10 min', count: 1560 },
  { range: '10-15 min', count: 780 },
  { range: '15+ min', count: 340 },
];

// ─── Mock Content Type Breakdown ─────────────────────────────────────────────

export const mockContentTypeData: ContentTypeBreakdown[] = [
  { type: 'Articles', value: 45, color: '#8b5cf6' },
  { type: 'Videos', value: 25, color: '#06b6d4' },
  { type: 'Podcasts', value: 15, color: '#f59e0b' },
  { type: 'Infographics', value: 10, color: '#10b981' },
  { type: 'Documents', value: 5, color: '#6b7280' },
];

// ─── Mock Top Content Table ──────────────────────────────────────────────────

export const mockTopContent: TopContentItem[] = [
  {
    id: '1',
    title: 'Getting Started with Our Platform',
    author: 'Alice Johnson',
    views: 12450,
    engagement: 89,
    avgReadTime: '4:32',
    publishedAt: '2025-02-15',
  },
  {
    id: '2',
    title: 'Advanced Features Deep Dive',
    author: 'Bob Smith',
    views: 9823,
    engagement: 76,
    avgReadTime: '8:15',
    publishedAt: '2025-02-20',
  },
  {
    id: '3',
    title: 'Best Practices for Content Creation',
    author: 'Carol Williams',
    views: 8567,
    engagement: 82,
    avgReadTime: '5:45',
    publishedAt: '2025-02-18',
  },
  {
    id: '4',
    title: 'Q1 2025 Product Updates',
    author: 'David Brown',
    views: 7234,
    engagement: 71,
    avgReadTime: '3:20',
    publishedAt: '2025-03-01',
  },
  {
    id: '5',
    title: 'Community Spotlight: March Edition',
    author: 'Eve Davis',
    views: 6891,
    engagement: 94,
    avgReadTime: '6:10',
    publishedAt: '2025-03-05',
  },
  {
    id: '6',
    title: 'Tutorial: Building Your First Project',
    author: 'Frank Miller',
    views: 6234,
    engagement: 88,
    avgReadTime: '12:30',
    publishedAt: '2025-02-25',
  },
  {
    id: '7',
    title: 'Interview with Industry Expert',
    author: 'Grace Wilson',
    views: 5678,
    engagement: 79,
    avgReadTime: '7:45',
    publishedAt: '2025-02-28',
  },
  {
    id: '8',
    title: 'Monthly Analytics Report',
    author: 'Henry Taylor',
    views: 4892,
    engagement: 65,
    avgReadTime: '4:00',
    publishedAt: '2025-03-08',
  },
];

// ─── Mock AI Insights ────────────────────────────────────────────────────────

export const mockAIInsights: AIInsight[] = [
  {
    title: 'Engagement Peak Identified',
    description: 'Content published between 9-11 AM receives 34% more engagement. Consider scheduling posts during this window.',
    sentiment: 'positive',
    impact: 'high',
  },
  {
    title: 'Video Content Trending',
    description: 'Video content shows 2.5x higher engagement rate compared to articles this month.',
    sentiment: 'positive',
    impact: 'high',
  },
  {
    title: 'Drop in Weekend Activity',
    description: 'User activity drops 45% on weekends. Consider automated posting or weekend-specific content.',
    sentiment: 'neutral',
    impact: 'medium',
  },
  {
    title: 'Long-form Content Decline',
    description: 'Articles over 1500 words show 20% lower completion rates. Consider breaking into series.',
    sentiment: 'negative',
    impact: 'medium',
  },
];

// ─── Mock Date Range Options ─────────────────────────────────────────────────

export const dateRangeOptions = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 14 days', value: '14d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'This month', value: 'month' },
  { label: 'Last month', value: 'last-month' },
  { label: 'This year', value: 'year' },
  { label: 'Custom', value: 'custom' },
];
