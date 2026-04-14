import { getPrismaClient } from "../repository";
import { getElasticsearchClient } from "@comms-lib/db-elasticsearch";
import { getRedisHealth } from "../shared/cache/redisClient";

export type AdminSystemMetric = {
  label: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "stable";
  changePercent?: number;
};

export async function getAdminOperationalMetrics(): Promise<
  AdminSystemMetric[]
> {
  const prisma = getPrismaClient();
  const mem = process.memoryUsage();

  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const redisHealth = await getRedisHealth();
  let esOk = false;
  const es = getElasticsearchClient();
  if (es) {
    try {
      await es.ping();
      esOk = true;
    } catch {
      esOk = false;
    }
  }

  let contentCount = 0;
  try {
    contentCount = await prisma.content.count();
  } catch {
    contentCount = -1;
  }

  return [
    {
      label: "API process heap (MB)",
      value: Math.round(mem.heapUsed / 1024 / 1024),
      unit: "MB",
    },
    { label: "Database", value: dbOk ? "connected" : "error", unit: "status" },
    {
      label: "Redis",
      value: redisHealth.ok ? "connected" : "unavailable",
      unit: "status",
    },
    {
      label: "Redis ping (ms)",
      value: redisHealth.latencyMs >= 0 ? redisHealth.latencyMs : "n/a",
      unit: "ms",
    },
    {
      label: "Elasticsearch",
      value: es ? (esOk ? "connected" : "error") : "not configured",
      unit: "status",
    },
    {
      label: "Content rows (indexed target)",
      value: contentCount,
      unit: "count",
    },
    {
      label: "Prometheus scrape",
      value: process.env.METRICS_ENABLED === "false" ? "disabled" : "/metrics",
      unit: "path",
    },
    {
      label: "Analytics ingest",
      value: process.env.ANALYTICS_INGEST_URL?.trim()
        ? "configured"
        : "local only",
      unit: "mode",
    },
  ];
}
