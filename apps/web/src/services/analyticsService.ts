import type {
  KPI,
  TimeSeriesPoint,
  EngagementData,
  ReadingTimeBucket,
  ContentTypeBreakdown,
  TopContentItem,
  AIInsight,
} from '../data/mockAnalyticsData';

const API_BASE = import.meta.env.VITE_API_URL ;

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.error || err.message || `HTTP ${res.status}`);
  }

  return res.json();
}

// ─── Analytics Service ────────────────────────────────────────────────────────

export const analyticsService = {
  getKPIs: async (dateRange?: string): Promise<KPI[]> => {
    const params = dateRange ? `?range=${dateRange}` : '';
    return request<KPI[]>(`/analytics/kpis${params}`);
  },

  getViewsData: async (dateRange?: string): Promise<TimeSeriesPoint[]> => {
    const params = dateRange ? `?range=${dateRange}` : '';
    return request<TimeSeriesPoint[]>(`/analytics/views${params}`);
  },

  getEngagementData: async (dateRange?: string): Promise<EngagementData[]> => {
    const params = dateRange ? `?range=${dateRange}` : '';
    return request<EngagementData[]>(`/analytics/engagement${params}`);
  },

  getReadingTimeData: async (): Promise<ReadingTimeBucket[]> => {
    return request<ReadingTimeBucket[]>('/analytics/reading-time');
  },

  getContentTypeData: async (): Promise<ContentTypeBreakdown[]> => {
    return request<ContentTypeBreakdown[]>('/analytics/content-types');
  },

  getTopContent: async (limit?: number): Promise<TopContentItem[]> => {
    const params = limit ? `?limit=${limit}` : '';
    return request<TopContentItem[]>(`/analytics/top-content${params}`);
  },

  getAIInsights: async (): Promise<AIInsight[]> => {
    return request<AIInsight[]>('/analytics/ai-insights');
  },
};

// Re-export types for convenience
export type {
  KPI,
  TimeSeriesPoint,
  EngagementData,
  ReadingTimeBucket,
  ContentTypeBreakdown,
  TopContentItem,
  AIInsight,
};
