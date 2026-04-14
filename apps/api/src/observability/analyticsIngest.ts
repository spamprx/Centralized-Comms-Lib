import {
  analyticsIngestFailures,
  analyticsIngestSuccess,
} from "./prometheusRegistry";

export type AnalyticsTrackForwardPayload = {
  contentId: string;
  eventType: string;
  metadata?: unknown;
  recordedAt: string;
  actorUserId?: string;
};

/**
 * When `ANALYTICS_INGEST_URL` is set, each persisted `/analytics/track` event
 * is POSTed here for Grafana/Loki/Segment-style pipelines. Uses fire-and-forget.
 */
export function forwardAnalyticsTrackEvent(
  payload: AnalyticsTrackForwardPayload,
): void {
  const url = process.env.ANALYTICS_INGEST_URL?.trim();
  if (!url) return;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const apiKey = process.env.ANALYTICS_INGEST_API_KEY?.trim();
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const body = JSON.stringify({
    source: "comms-lib-api",
    ...payload,
  });

  void fetch(url, { method: "POST", headers, body })
    .then((res) => {
      if (!res.ok) {
        analyticsIngestFailures.inc();
        return;
      }
      analyticsIngestSuccess.inc();
    })
    .catch(() => {
      analyticsIngestFailures.inc();
    });
}
