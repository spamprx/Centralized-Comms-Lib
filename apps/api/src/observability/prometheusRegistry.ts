import { collectDefaultMetrics, Counter, Gauge, Registry } from "prom-client";

export const metricsRegister = new Registry();

collectDefaultMetrics({
  register: metricsRegister,
  prefix: "comms_",
});

export const searchCacheWritesSkipped = new Counter({
  name: "comms_search_cache_writes_skipped_total",
  help: "Search cache SET operations skipped (oversize, Redis error, etc.)",
  labelNames: ["reason"],
  registers: [metricsRegister],
});

export const aiQuotaRejections = new Counter({
  name: "comms_ai_quota_rejections_total",
  help: "AI draft quota rejections at the API gateway (scope: user|org|system)",
  labelNames: ["scope"],
  registers: [metricsRegister],
});

export const analyticsIngestFailures = new Counter({
  name: "comms_analytics_ingest_failures_total",
  help: "Failed forwards to external analytics/monitoring ingest",
  registers: [metricsRegister],
});

export const analyticsIngestSuccess = new Counter({
  name: "comms_analytics_ingest_success_total",
  help: "Successful forwards to external analytics/monitoring ingest",
  registers: [metricsRegister],
});

export const redisPingMs = new Gauge({
  name: "comms_redis_ping_milliseconds",
  help: "Last successful Redis PING latency (ms); -1 if unavailable",
  registers: [metricsRegister],
});

export async function renderPrometheusText(): Promise<string> {
  return metricsRegister.metrics();
}
