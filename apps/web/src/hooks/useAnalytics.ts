import { useState, useEffect } from "react";
import { analyticsService } from "../services/analyticsService";
import type {
  KPI,
  TimeSeriesPoint,
  EngagementData,
  ReadingTimeBucket,
  ContentTypeBreakdown,
  TopContentItem,
  AIInsight,
} from "../types/analytics";
import type { DateRange } from "../lib/dateUtils";

function dateRangeToApiParam(dateRange: string | DateRange): string | DateRange {
  return dateRange;
}

export function useAnalytics(dateRange: string | DateRange = "30d") {
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
        const param = dateRangeToApiParam(dateRange);
        const [
          kpisData,
          viewsDataResult,
          engagementDataResult,
          readingTimeDataResult,
          contentTypeDataResult,
          topContentResult,
          aiInsightsResult,
        ] = await Promise.all([
          analyticsService.getKPIs(param),
          analyticsService.getViewsData(param),
          analyticsService.getEngagementData(param),
          analyticsService.getReadingTimeData(),
          analyticsService.getContentTypeData(param),
          analyticsService.getTopContent(10),
          analyticsService.getAIInsights(),
        ]);

        if (!mounted) return;

        setKpis(kpisData);
        setViewsData(viewsDataResult);
        setEngagementData(engagementDataResult);
        setReadingTimeData(readingTimeDataResult);
        setContentTypeData(contentTypeDataResult);
        setTopContent(topContentResult);
        setAiInsights(aiInsightsResult);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : "Failed to load analytics data");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchData();

    return () => {
      mounted = false;
    };
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
