/** Analytics API / dashboard shapes (shared by service, CSV export, UI). */

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export interface KPI {
  label: string;
  value: string | number;
  change: number;
  trend: "up" | "down" | "stable";
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
  sentiment: "positive" | "neutral" | "negative";
  impact: "high" | "medium" | "low";
}
