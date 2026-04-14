import type {
  KPI,
  TimeSeriesPoint,
  EngagementData,
  ReadingTimeBucket,
  ContentTypeBreakdown,
  TopContentItem,
  AIInsight,
} from '../types/analytics';
import type { DateRange } from '../lib/dateUtils';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const { getAuthToken } = await import('./tokenStore');
  const token = getAuthToken();
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

// Helper function to build date parameters for API requests
function buildDateParams(dateRange?: string | DateRange): string {
  if (!dateRange) return '';
  
  if (typeof dateRange === 'string') {
    return `?range=${dateRange}`;
  }
  
  // For custom DateRange, calculate the number of days and use as range
  const days = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
  return `?range=${days}d`;
}

// ─── Analytics Service ────────────────────────────────────────────────────────

export const analyticsService = {
  getKPIs: async (dateRange?: string | DateRange): Promise<KPI[]> => {
    const params = buildDateParams(dateRange);
    return request<KPI[]>(`/analytics/kpis${params}`);
  },

  getViewsData: async (dateRange?: string | DateRange): Promise<TimeSeriesPoint[]> => {
    const params = buildDateParams(dateRange);
    return request<TimeSeriesPoint[]>(`/analytics/views${params}`);
  },

  getEngagementData: async (dateRange?: string | DateRange): Promise<EngagementData[]> => {
    const params = buildDateParams(dateRange);
    return request<EngagementData[]>(`/analytics/engagement${params}`);
  },

  getReadingTimeData: async (): Promise<ReadingTimeBucket[]> => {
    return request<ReadingTimeBucket[]>('/analytics/reading-time');
  },

  getContentTypeData: async (dateRange?: string | DateRange): Promise<ContentTypeBreakdown[]> => {
    const params = buildDateParams(dateRange);
    return request<ContentTypeBreakdown[]>(`/analytics/content-types${params}`);
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
