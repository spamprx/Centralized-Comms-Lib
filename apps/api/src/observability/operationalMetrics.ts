import { getPrismaClient } from "../repository";
import { getElasticsearchClient } from "@comms-lib/db-elasticsearch";
import { getRedisHealth } from "../shared/cache/redisClient";

export type AdminSystemMetric = {
  label: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "stable";
  changePercent?: number;
  details?: Record<string, unknown>;
};

export async function getAdminOperationalMetrics(): Promise<
  AdminSystemMetric[]
> {
  const prisma = getPrismaClient();
  const mem = process.memoryUsage();
  const now = Date.now();
  const activeNowWindowMs = 5 * 60 * 1000;
  const recentActiveWindowMs = 30 * 60 * 1000;

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

  let activeNowUsers = -1;
  let recentlyActiveUsers = -1;
  try {
    const activeNowSince = new Date(now - activeNowWindowMs);
    const recentlySince = new Date(now - recentActiveWindowMs);
    const [activeNow, recentlyActive] = await Promise.all([
      prisma.user.count({
        where: {
          isActive: true,
          OR: [
            { presencePingAt: { gte: activeNowSince } },
            { lastActiveAt: { gte: activeNowSince } },
          ],
        },
      }),
      prisma.user.count({
        where: {
          isActive: true,
          OR: [
            { presencePingAt: { gte: recentlySince } },
            { lastActiveAt: { gte: recentlySince } },
          ],
        },
      }),
    ]);
    activeNowUsers = activeNow;
    recentlyActiveUsers = recentlyActive;
  } catch {
    activeNowUsers = -1;
    recentlyActiveUsers = -1;
  }

  let lifecycleHistogram: Record<string, number> = {
    DRAFT: 0,
    IN_REVIEW: 0,
    PUBLISHED: 0,
    ARCHIVED: 0,
  };
  try {
    const grouped = await prisma.content.groupBy({
      by: ["lifecycleState"],
      _count: { _all: true },
    });
    lifecycleHistogram = grouped.reduce<Record<string, number>>((acc, row) => {
      acc[row.lifecycleState] = row._count._all;
      return acc;
    }, lifecycleHistogram);
  } catch {
    lifecycleHistogram = {
      DRAFT: 0,
      IN_REVIEW: 0,
      PUBLISHED: 0,
      ARCHIVED: 0,
    };
  }

  let throughput24h = -1;
  let reviewQueue = -1;
  try {
    const since = new Date(now - 24 * 60 * 60 * 1000);
    const [published24h, openReviewRequests] = await Promise.all([
      prisma.content.count({
        where: {
          lifecycleState: "PUBLISHED",
          updatedAt: { gte: since },
        },
      }),
      prisma.reviewRequest.count({
        where: { status: "OPEN" },
      }),
    ]);
    throughput24h = published24h;
    reviewQueue = openReviewRequests;
  } catch {
    throughput24h = -1;
    reviewQueue = -1;
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
      label: "Active users (last 5m)",
      value: activeNowUsers,
      unit: "users",
      details: { windowMinutes: 5 },
    },
    {
      label: "Recently active users (last 30m)",
      value: recentlyActiveUsers,
      unit: "users",
      details: { windowMinutes: 30 },
    },
    {
      label: "Pipeline throughput (published 24h)",
      value: throughput24h,
      unit: "items",
      details: { windowHours: 24 },
    },
    {
      label: "Review bottleneck (open requests)",
      value: reviewQueue,
      unit: "items",
    },
    {
      label: "Content lifecycle histogram",
      value: Object.values(lifecycleHistogram).reduce(
        (sum, count) => sum + count,
        0,
      ),
      unit: "items",
      details: {
        chartType: "bar",
        histogram: lifecycleHistogram,
      },
    },
    {
      label: "Prometheus scrape",
      value: process.env.METRICS_ENABLED === "false" ? "disabled" : "/metrics",
      unit: "path",
      details: {
        enabled: process.env.METRICS_ENABLED !== "false",
      },
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
