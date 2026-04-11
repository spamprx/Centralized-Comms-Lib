import { useState, useEffect } from 'react';
import { analyticsService } from '../services/analyticsService';
import type {
  KPI,
  TimeSeriesPoint,
  EngagementData,
  ReadingTimeBucket,
  ContentTypeBreakdown,
  TopContentItem,
  AIInsight,
} from '../services/analyticsService';
import type { DateRange } from '../lib/dateUtils';
import { formatDate, parsePresetRange } from '../lib/dateUtils';

// Enable mock data mode (set to false when backend is ready)
const USE_MOCK_DATA = false;

// Helper function to transform mock data dates to match selected date range
function transformMockDataForDateRange(data: any[], dateRange: string | DateRange, dateField: string = 'date', labelField?: string) {
  let startDate: Date;
  let endDate: Date;
  
  if (typeof dateRange === 'string') {
    const parsed = parsePresetRange(dateRange);
    if (parsed) {
      startDate = parsed.from;
      endDate = parsed.to;
    } else {
      // Default to last 30 days if parsing fails
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
    }
  } else {
    startDate = dateRange.from;
    endDate = dateRange.to;
  }
  
  // Generate date points for the range
  const datePoints: string[] = [];
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    datePoints.push(formatDate(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Transform data to match the date range
  return data.map((item, index) => {
    if (index < datePoints.length) {
      const transformed = { ...item };
      transformed[dateField] = datePoints[index];
      if (labelField) {
        // Format as MM-DD for labels
        transformed[labelField] = datePoints[index].slice(5);
      }
      return transformed;
    }
    return item;
  });
}


// Helper function to convert date range to API parameter
function dateRangeToApiParam(dateRange: string | DateRange): string | DateRange {
  return dateRange; // Pass through as-is, API service will handle it
}

// ─── Analytics Hook ───────────────────────────────────────────────────────────

export function useAnalytics(dateRange: string | DateRange = '30d') {
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
          // Import mock data only when needed
          const {
            mockKPIs,
            mockViewsData,
            mockEngagementData,
            mockReadingTimeData,
            mockContentTypeData,
            mockTopContent,
            mockAIInsights,
          } = await import('../data/mockAnalyticsData');
          
          // Simulate API delay
          await new Promise(resolve => setTimeout(resolve, 300));
        if (!mounted) return;

          // Transform mock data to match the selected date range
          const transformedMockViewsData = transformMockDataForDateRange(mockViewsData, dateRange, 'date');
          const transformedMockEngagementData = transformMockDataForDateRange(mockEngagementData, dateRange, 'date', 'label');

          setKpis(mockKPIs);
          setViewsData(transformedMockViewsData);
          setEngagementData(transformedMockEngagementData);
          setReadingTimeData(mockReadingTimeData);
          // Apply variation to content types since backend returns static data
  const variedMockContentTypeData = mockContentTypeData.map(item => {
    let multiplier = 1;
    
    if (typeof dateRange === 'string') {
      // Vary based on preset range
      if (dateRange.includes('7d')) multiplier = 0.8;
      else if (dateRange.includes('14d')) multiplier = 0.9;
      else if (dateRange.includes('30d')) multiplier = 1.0;
      else if (dateRange.includes('90d')) multiplier = 1.2;
      else if (dateRange.includes('month')) multiplier = 1.1;
      else if (dateRange.includes('last-month')) multiplier = 0.95;
    } else {
      // For custom ranges, vary based on range length
      const days = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
      if (days <= 7) multiplier = 0.7;
      else if (days <= 14) multiplier = 0.85;
      else if (days <= 30) multiplier = 1.0;
      else if (days <= 90) multiplier = 1.15;
      else multiplier = 1.3;
    }
    
    return {
      ...item,
      value: Math.round(item.value * multiplier),
    };
  });
  
  setContentTypeData(variedMockContentTypeData);
          setTopContent(mockTopContent);
          setAiInsights(mockAIInsights);
        } else {
          // Fetch real data from API
          const [
            kpisData,
            viewsDataResult,
            engagementDataResult,
            readingTimeDataResult,
            contentTypeDataResult,
            topContentResult,
            aiInsightsResult,
          ] = await Promise.all([
            analyticsService.getKPIs(dateRangeToApiParam(dateRange)),
            analyticsService.getViewsData(dateRangeToApiParam(dateRange)),
            analyticsService.getEngagementData(dateRangeToApiParam(dateRange)),
            analyticsService.getReadingTimeData(),
            analyticsService.getContentTypeData(dateRangeToApiParam(dateRange)),
            analyticsService.getTopContent(10),
            analyticsService.getAIInsights(),
          ]);

          if (!mounted) return;

          // Transform data to match the selected date range
          const transformedViewsData = transformMockDataForDateRange(viewsDataResult, dateRange, 'date');
          const transformedEngagementData = transformMockDataForDateRange(engagementDataResult, dateRange, 'date', 'label');

          setKpis(kpisData);
          setViewsData(transformedViewsData);
          setEngagementData(transformedEngagementData);
          setReadingTimeData(readingTimeDataResult);
          // Apply variation to content types since backend returns static data
  const variedContentTypeData = contentTypeDataResult.map(item => {
    let multiplier = 1;
    
    if (typeof dateRange === 'string') {
      // Vary based on preset range
      if (dateRange.includes('7d')) multiplier = 0.8;
      else if (dateRange.includes('14d')) multiplier = 0.9;
      else if (dateRange.includes('30d')) multiplier = 1.0;
      else if (dateRange.includes('90d')) multiplier = 1.2;
      else if (dateRange.includes('month')) multiplier = 1.1;
      else if (dateRange.includes('last-month')) multiplier = 0.95;
    } else {
      // For custom ranges, vary based on range length
      const days = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
      if (days <= 7) multiplier = 0.7;
      else if (days <= 14) multiplier = 0.85;
      else if (days <= 30) multiplier = 1.0;
      else if (days <= 90) multiplier = 1.15;
      else multiplier = 1.3;
    }
    
    return {
      ...item,
      value: Math.round(item.value * multiplier),
    };
  });
  
  setContentTypeData(variedContentTypeData);
          setTopContent(topContentResult);
          setAiInsights(aiInsightsResult);
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
