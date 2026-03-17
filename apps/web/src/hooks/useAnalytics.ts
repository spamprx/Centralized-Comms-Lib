import { useState, useEffect } from 'react';
import {
  mockKPIs,
  mockViewsData,
  mockEngagementData,
  mockReadingTimeData,
  mockContentTypeData,
  mockTopContent,
  mockAIInsights,
} from '../data/mockAnalyticsData';
import type {
  KPI,
  TimeSeriesPoint,
  EngagementData,
  ReadingTimeBucket,
  ContentTypeBreakdown,
  TopContentItem,
  AIInsight,
} from '../data/mockAnalyticsData';

// Enable mock data mode (set to false when backend is ready)
const USE_MOCK_DATA = true;

// ─── Analytics Hook ───────────────────────────────────────────────────────────

export function useAnalytics(dateRange: string = '30d') {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [viewsData, setViewsData] = useState<TimeSeriesPoint[]>([]);
  const [engagementData, setEngagementData] = useState<EngagementData[]>([]);
  const [readingTimeData, setReadingTimeData] = useState<ReadingTimeBucket[]>([]);
  const [contentTypeData, setContentTypeData] = useState<ContentTypeBreakdown[]>([]);
  const [topContent, setTopContent] = useState<TopContentItem[]>([]);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        if (USE_MOCK_DATA) {
          // Simulate API delay
          await new Promise(resolve => setTimeout(resolve, 300));
          
          if (!mounted) return;
          
          // Set mock data
          setKpis(mockKPIs.map(k => ({
            ...k,
            change: k.change + (Math.random() * 2 - 1),
          })));
          setViewsData(mockViewsData);
          setEngagementData(mockEngagementData);
          setReadingTimeData(mockReadingTimeData);
          setContentTypeData(mockContentTypeData);
          setTopContent(mockTopContent);
          setAiInsights(mockAIInsights);
        }
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Failed to load analytics data');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    
    fetchData();
    
    return () => { mounted = false; };
  }, [dateRange]);

  return {
    kpis,
    viewsData,
    engagementData,
    readingTimeData,
    contentTypeData,
    topContent,
    aiInsights,
    loading,
    error,
    refetch: () => {},
  };
}
