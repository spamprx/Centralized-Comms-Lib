import { Router, Response } from "express";
import { getPrismaClient, PrismaUnitOfWork } from "../../repository";
import { authorize, type AuthRequest } from "../../middlewares/auth.middleware";
import { forwardAnalyticsTrackEvent } from "../../observability/analyticsIngest";

const router = Router();

function parseDateRange(
  fromQ: unknown,
  toQ: unknown,
): { from: Date; to: Date } | { error: string } {
  const now = new Date();
  const to = toQ ? new Date(String(toQ)) : now;
  const from = fromQ ? new Date(String(fromQ)) : new Date(now.getTime() - 30 * 86400000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { error: "Invalid from or to date" };
  }
  if (from > to) return { error: "`from` must be before `to`" };
  return { from, to };
}

/**
 * @openapi
 * /api/v1/analytics/track:
 *   post:
 *     summary: Record an analytics event for a content item
 *     tags:
 *       - Analytics
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contentId
 *               - eventType
 *             properties:
 *               contentId:
 *                 type: string
 *               eventType:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       204:
 *         description: Event stored
 *       400:
 *         description: Missing fields
 *       404:
 *         description: Content not found
 */
router.post("/track", async (req: AuthRequest, res: Response) => {
  try {
    const { contentId, eventType, metadata } = req.body as {
      contentId?: string;
      eventType?: string;
      metadata?: unknown;
    };
    if (!contentId?.trim() || !eventType?.trim()) {
      res.status(400).json({ error: "contentId and eventType are required" });
      return;
    }
    const prisma = getPrismaClient();
    const content = await prisma.content.findUnique({ where: { id: contentId }, select: { id: true } });
    if (!content) {
      res.status(404).json({ error: "Content not found" });
      return;
    }
    await prisma.contentAnalyticsEvent.create({
      data: {
        contentId: content.id,
        eventType: eventType.trim(),
        metadata: metadata === undefined ? undefined : (metadata as object),
      },
    });
    forwardAnalyticsTrackEvent({
      contentId: content.id,
      eventType: eventType.trim(),
      metadata,
      recordedAt: new Date().toISOString(),
      actorUserId: req.user?.id,
    });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * @openapi
 * /api/v1/analytics/content/{contentId}/metrics:
 *   get:
 *     summary: Aggregated analytics events for one content in a date range
 *     tags:
 *       - Analytics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contentId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Counts by event type
 *       400:
 *         description: Invalid date range
 */
router.get("/content/:contentId/metrics", async (req: AuthRequest, res: Response) => {
  try {
    const range = parseDateRange(req.query.from, req.query.to);
    if ("error" in range) {
      res.status(400).json({ error: range.error });
      return;
    }
    const prisma = getPrismaClient();
    const rows = await prisma.contentAnalyticsEvent.groupBy({
      by: ["eventType"],
      where: {
        contentId: req.params.contentId,
        createdAt: { gte: range.from, lte: range.to },
      },
      _count: { _all: true },
    });
    const total = rows.reduce((acc, r) => acc + r._count._all, 0);
    res.status(200).json({
      contentId: req.params.contentId,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      totalEvents: total,
      byEventType: rows.map((r) => ({ eventType: r.eventType, count: r._count._all })),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * @openapi
 * /api/v1/analytics/aggregate:
 *   get:
 *     summary: Workspace-wide analytics aggregates (admin)
 *     tags:
 *       - Analytics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Totals and breakdown
 *       400:
 *         description: Invalid date range
 *       403:
 *         description: Not admin
 */
router.get("/aggregate", authorize("ADMIN"), async (req: AuthRequest, res: Response) => {
  try {
    const range = parseDateRange(req.query.from, req.query.to);
    if ("error" in range) {
      res.status(400).json({ error: range.error });
      return;
    }
    const prisma = getPrismaClient();
    const [byType, distinctContent] = await Promise.all([
      prisma.contentAnalyticsEvent.groupBy({
        by: ["eventType"],
        where: { createdAt: { gte: range.from, lte: range.to } },
        _count: { _all: true },
      }),
      prisma.contentAnalyticsEvent.findMany({
        where: { createdAt: { gte: range.from, lte: range.to } },
        distinct: ["contentId"],
        select: { contentId: true },
      }),
    ]);
    const totalEvents = byType.reduce((a, r) => a + r._count._all, 0);
    res.status(200).json({
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      totalEvents,
      distinctContentCount: distinctContent.length,
      byEventType: byType.map((r) => ({ eventType: r.eventType, count: r._count._all })),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── KPIs ──────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/analytics/kpis:
 *   get:
 *     summary: Dashboard KPI cards (admin)
 *     tags:
 *       - Analytics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           default: 30d
 *     responses:
 *       200:
 *         description: KPI array
 */
router.get("/kpis", authorize("ADMIN"), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const repos = uow.repos();

    const range = req.query.range as string || '30d';
    const days = parseInt(range) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get counts from database. Views are currently mocked since there is
    // no dedicated analytics table in the schema yet.
    const [userCount, contentCount] = await Promise.all([
      repos.userRole.listUsers().then((u: any[]) => u.length),
      prisma.content.count({ where: { createdAt: { gte: startDate } } }),
    ]);
    const totalViews = Math.floor(5000 + Math.random() * 5000);

    // Calculate engagement rate (mock calculation)
    const engagementRate = 68.3 + (Math.random() * 5 - 2.5);

    res.status(200).json([
      { label: "Total Views", value: totalViews.toLocaleString(), change: 12.5, trend: "up" as const },
      { label: "Avg. Engagement", value: `${engagementRate.toFixed(1)}%`, change: 5.2, trend: "up" as const },
      { label: "Active Users", value: userCount.toLocaleString(), change: -2.1, trend: "down" as const },
      { label: "Content Published", value: contentCount.toLocaleString(), change: 8.7, trend: "up" as const },
    ]);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── Views Time Series ──────────────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/analytics/views:
 *   get:
 *     summary: Views time series (admin)
 *     tags:
 *       - Analytics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Points over time
 */
router.get("/views", authorize("ADMIN"), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const range = (req.query.range as string) || "30d";
    const days = parseInt(range) || 30;

    // In production, query actual analytics data grouped by date
    // For now, return mock data structure
    const data: { date: string; value: number }[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      data.push({
        date: d.toISOString().split("T")[0],
        value: Math.floor(3000 + Math.random() * 2000),
      });
    }

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── Engagement Metrics ─────────────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/analytics/engagement:
 *   get:
 *     summary: Engagement metrics by day (admin)
 *     tags:
 *       - Analytics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Engagement rows
 */
router.get("/engagement", authorize("ADMIN"), async (req: AuthRequest, res: Response) => {
  try {
    const range = (req.query.range as string) || "7d";
    const days = parseInt(range) || 7;

    // In production, query actual engagement data
    const data = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      data.push({
        label: d.toISOString().slice(5, 10),
        views: Math.floor(4000 + Math.random() * 1500),
        likes: Math.floor(800 + Math.random() * 300),
        shares: Math.floor(200 + Math.random() * 100),
        comments: Math.floor(150 + Math.random() * 80),
      });
    }

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── Reading Time Distribution ──────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/analytics/reading-time:
 *   get:
 *     summary: Reading time histogram buckets (admin)
 *     tags:
 *       - Analytics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bucket counts
 */
router.get("/reading-time", authorize("ADMIN"), async (req: AuthRequest, res: Response) => {
  try {
    // In production, calculate from actual reading analytics
    res.status(200).json([
      { range: "0-1 min", count: 1250 },
      { range: "1-3 min", count: 3420 },
      { range: "3-5 min", count: 2890 },
      { range: "5-10 min", count: 1560 },
      { range: "10-15 min", count: 780 },
      { range: "15+ min", count: 340 },
    ]);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── Content Type Breakdown ─────────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/analytics/content-types:
 *   get:
 *     summary: Content type breakdown (admin)
 *     tags:
 *       - Analytics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Type segments
 */
router.get("/content-types", authorize("ADMIN"), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrismaClient();

    // In production, group content by type
    res.status(200).json([
      { type: "Articles", value: 45, color: "#8b5cf6" },
      { type: "Videos", value: 25, color: "#06b6d4" },
      { type: "Podcasts", value: 15, color: "#f59e0b" },
      { type: "Infographics", value: 10, color: "#10b981" },
      { type: "Documents", value: 5, color: "#6b7280" },
    ]);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── Top Content ────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/analytics/top-content:
 *   get:
 *     summary: Top content list (admin)
 *     tags:
 *       - Analytics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Ranked items
 */
router.get("/top-content", authorize("ADMIN"), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const limit = parseInt(req.query.limit as string) || 10;

    // In production, query content ordered by an analytics metric. For now,
    // use most recent content and mock the views/engagement numbers.
    const content = await prisma.content.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { author: { select: { displayName: true } } },
    });

    const data = content.map((c: any) => ({
      id: c.id,
      title: c.title,
      author: c.author?.displayName ?? "Unknown",
      views: Math.floor(500 + Math.random() * 4500),
      engagement: Math.floor(60 + Math.random() * 35),
      avgReadTime: `${Math.floor(3 + Math.random() * 10)}:${String(
        Math.floor(Math.random() * 60),
      ).padStart(2, "0")}`,
      publishedAt: c.createdAt.toISOString(),
    }));

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── AI Insights ────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/analytics/ai-insights:
 *   get:
 *     summary: AI-style insight cards (admin, mock data)
 *     tags:
 *       - Analytics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Insights list
 */
router.get("/ai-insights", authorize("ADMIN"), async (req: AuthRequest, res: Response) => {
  try {
    // In production, generate insights using AI/ML based on analytics data
    res.status(200).json([
      {
        title: "Engagement Peak Identified",
        description:
          "Content published between 9-11 AM receives 34% more engagement. Consider scheduling posts during this window.",
        sentiment: "positive" as const,
        impact: "high" as const,
      },
      {
        title: "Video Content Trending",
        description: "Video content shows 2.5x higher engagement rate compared to articles this month.",
        sentiment: "positive" as const,
        impact: "high" as const,
      },
      {
        title: "Drop in Weekend Activity",
        description:
          "User activity drops 45% on weekends. Consider automated posting or weekend-specific content.",
        sentiment: "neutral" as const,
        impact: "medium" as const,
      },
      {
        title: "Long-form Content Decline",
        description:
          "Articles over 1500 words show 20% lower completion rates. Consider breaking into series.",
        sentiment: "negative" as const,
        impact: "medium" as const,
      },
    ]);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
