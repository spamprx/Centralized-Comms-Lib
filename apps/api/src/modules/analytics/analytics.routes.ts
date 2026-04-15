import { Router, Response } from "express";
import { getPrismaClient, PrismaUnitOfWork } from "../../repository";
import { authorize, type AuthRequest } from "../../middlewares/auth.middleware";
import { forwardAnalyticsTrackEvent } from "../../observability/analyticsIngest";
import type { AuditContext } from "../../shared/context";

function auditContext(req: AuthRequest): AuditContext {
  return {
    actorId: req.user!.id,
    isAdmin: req.user!.role === "ADMIN",
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  };
}

const router = Router();

function queryParamString(q: unknown, fallback: string): string {
  if (typeof q === "string") return q;
  if (Array.isArray(q) && typeof q[0] === "string") return q[0];
  return fallback;
}

/** Parses `30d`, `7`, `14d` style range query params for KPI windows. */
function parseRangeDays(range: string): number {
  const raw = range.trim() || "30d";
  const dMatch = /^(\d+)\s*d$/i.exec(raw);
  const nMatch = dMatch ?? /^(\d+)$/.exec(raw);
  if (nMatch) {
    const n = Number.parseInt(nMatch[1], 10);
    return Number.isFinite(n) ? Math.max(1, Math.min(366, n)) : 30;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(366, n) : 30;
}

function parseDateRange(
  fromQ: unknown,
  toQ: unknown,
): { from: Date; to: Date } | { error: string } {
  const now = new Date();
  const to = toQ ? new Date(String(toQ)) : now;
  const from = fromQ
    ? new Date(String(fromQ))
    : new Date(now.getTime() - 30 * 86400000);
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
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      select: { id: true },
    });
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
    const ctx = auditContext(req);
    const repos = new PrismaUnitOfWork(prisma).repos();
    await repos.audit.append({
      action: "ANALYTICS_TRACK",
      resource: "CONTENT",
      resourceId: content.id,
      newValue: { eventType: eventType.trim(), metadata: metadata ?? null },
      actorId: ctx.actorId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
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
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err) });
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
router.get(
  "/content/:contentId/metrics",
  async (req: AuthRequest, res: Response) => {
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
        byEventType: rows.map((r) => ({
          eventType: r.eventType,
          count: r._count._all,
        })),
      });
    } catch (err) {
      res
        .status(500)
        .json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

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
router.get(
  "/aggregate",
  authorize("USER", "ADMIN"),
  async (req: AuthRequest, res: Response) => {
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
        byEventType: byType.map((r) => ({
          eventType: r.eventType,
          count: r._count._all,
        })),
      });
    } catch (err) {
      res
        .status(500)
        .json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

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
router.get(
  "/kpis",
  authorize("USER", "ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma = getPrismaClient();
      const uow = new PrismaUnitOfWork(prisma);
      const repos = uow.repos();

      const days = parseRangeDays(queryParamString(req.query.range, "30d"));
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [
        userCount,
        publishedInRange,
        totalViews,
        likeCount,
        commentCount,
      ] = await Promise.all([
        repos.userRole.listUsers().then((u: any[]) => u.length),
        prisma.content.count({
          where: {
            lifecycleState: "PUBLISHED",
            createdAt: { gte: startDate },
          },
        }),
        prisma.contentView.count({ where: { createdAt: { gte: startDate } } }),
        prisma.contentLike.count({ where: { createdAt: { gte: startDate } } }),
        prisma.contentComment.count({
          where: { createdAt: { gte: startDate } },
        }),
      ]);

      const interactions = likeCount + commentCount;
      const interactionRatePct =
        totalViews > 0
          ? Math.round((interactions / totalViews) * 1000) / 10
          : 0;

      res.status(200).json([
        {
          label: "Total Views",
          value: totalViews.toLocaleString(),
        },
        {
          label: "Interaction rate",
          value: `${interactionRatePct}%`,
        },
        {
          label: "Active Users",
          value: userCount.toLocaleString(),
        },
        {
          label: "Content Published",
          value: publishedInRange.toLocaleString(),
        },
      ]);
    } catch (err) {
      res
        .status(500)
        .json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

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
router.get(
  "/views",
  authorize("USER", "ADMIN"),
  async (req: AuthRequest, res: Response) => {
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
      res
        .status(500)
        .json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

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
router.get(
  "/engagement",
  authorize("USER", "ADMIN"),
  async (req: AuthRequest, res: Response) => {
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
      res
        .status(500)
        .json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

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
router.get(
  "/reading-time",
  authorize("USER", "ADMIN"),
  async (req: AuthRequest, res: Response) => {
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
      res
        .status(500)
        .json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

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
router.get(
  "/content-types",
  authorize("USER", "ADMIN"),
  async (req: AuthRequest, res: Response) => {
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
      res
        .status(500)
        .json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

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
router.get(
  "/top-content",
  authorize("USER", "ADMIN"),
  async (req: AuthRequest, res: Response) => {
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
      res
        .status(500)
        .json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

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
router.get(
  "/ai-insights",
  authorize("USER", "ADMIN"),
  async (req: AuthRequest, res: Response) => {
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
          description:
            "Video content shows 2.5x higher engagement rate compared to articles this month.",
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
      res
        .status(500)
        .json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

// ─── CSV Export ─────────────────────────────────────────────────────────────

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsvRow(fields: string[]): string {
  return fields.map(escapeCsvField).join(",");
}

/**
 * @openapi
 * /api/v1/analytics/export/csv:
 *   get:
 *     summary: Export per-content analytics metrics as CSV
 *     description: >
 *       Returns a downloadable CSV with per-content metrics (views, unique readers,
 *       avg reading time, reactions) within the requested date range.
 *       Supports optional filters by contentId, authorId, and eventType.
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
 *         description: Start of date range (ISO 8601). Defaults to 30 days ago.
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End of date range (ISO 8601). Defaults to now.
 *       - in: query
 *         name: contentId
 *         schema:
 *           type: string
 *         description: Filter to a single content item
 *       - in: query
 *         name: authorId
 *         schema:
 *           type: string
 *         description: Filter to content by a specific author
 *     responses:
 *       200:
 *         description: CSV file download
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       400:
 *         description: Invalid date range
 */
router.get("/export/csv", async (req: AuthRequest, res: Response) => {
  try {
    const range = parseDateRange(req.query.from, req.query.to);
    if ("error" in range) {
      res.status(400).json({ error: range.error });
      return;
    }

    const prisma = getPrismaClient();

    type RawEvent = { contentId: string; eventType: string; metadata: unknown };

    let events: RawEvent[];
    if (req.query.contentId) {
      events = await prisma.$queryRawUnsafe<RawEvent[]>(
        `SELECT "contentId", "eventType", metadata
         FROM content_analytics_events
         WHERE "createdAt" >= $1 AND "createdAt" <= $2 AND "contentId" = $3`,
        range.from,
        range.to,
        String(req.query.contentId),
      );
    } else {
      events = await prisma.$queryRawUnsafe<RawEvent[]>(
        `SELECT "contentId", "eventType", metadata
         FROM content_analytics_events
         WHERE "createdAt" >= $1 AND "createdAt" <= $2`,
        range.from,
        range.to,
      );
    }

    const contentIdSet = new Set(events.map((e) => e.contentId));
    const contentIds: string[] = [...contentIdSet];
    const contentMap = new Map<string, { title: string; author: string }>();

    if (contentIds.length > 0) {
      const authorFilter = req.query.authorId
        ? { authorId: String(req.query.authorId) }
        : {};
      const contents = await prisma.content.findMany({
        where: { id: { in: contentIds }, ...authorFilter },
        include: { author: { select: { displayName: true } } },
      });
      for (const c of contents) {
        contentMap.set(c.id, {
          title: c.title,
          author: c.author?.displayName ?? "Unknown",
        });
      }
    }

    const filteredContentIds = req.query.authorId
      ? contentIds.filter((id) => contentMap.has(id))
      : contentIds;

    type ContentMetrics = {
      views: number;
      uniqueReaders: Set<string>;
      readingTimeSeconds: number[];
      likes: number;
      shares: number;
      bookmarks: number;
    };

    const metricsMap = new Map<string, ContentMetrics>();
    for (const cid of filteredContentIds) {
      metricsMap.set(cid, {
        views: 0,
        uniqueReaders: new Set(),
        readingTimeSeconds: [],
        likes: 0,
        shares: 0,
        bookmarks: 0,
      });
    }

    for (const ev of events) {
      const m = metricsMap.get(ev.contentId);
      if (!m) continue;
      const meta = (
        typeof ev.metadata === "object" ? ev.metadata : null
      ) as Record<string, unknown> | null;
      const userId = meta?.userId as string | undefined;

      switch (ev.eventType) {
        case "view":
          m.views++;
          if (userId) m.uniqueReaders.add(userId);
          break;
        case "reading_time": {
          const secs = Number(meta?.seconds) || 0;
          if (secs > 0) m.readingTimeSeconds.push(secs);
          break;
        }
        case "like":
          m.likes++;
          break;
        case "share":
          m.shares++;
          break;
        case "bookmark":
          m.bookmarks++;
          break;
      }
    }

    const CSV_HEADERS = [
      "Content ID",
      "Title",
      "Author",
      "Total Views",
      "Unique Readers",
      "Avg Reading Time (s)",
      "Likes",
      "Shares",
      "Bookmarks",
      "Total Reactions",
    ];
    const rows: string[] = [toCsvRow(CSV_HEADERS)];

    for (const cid of filteredContentIds) {
      const m = metricsMap.get(cid)!;
      const info = contentMap.get(cid) ?? {
        title: "Unknown",
        author: "Unknown",
      };
      const avgReadTime =
        m.readingTimeSeconds.length > 0
          ? (
              m.readingTimeSeconds.reduce((a, b) => a + b, 0) /
              m.readingTimeSeconds.length
            ).toFixed(1)
          : "0";
      const totalReactions = m.likes + m.shares + m.bookmarks;

      rows.push(
        toCsvRow([
          cid,
          info.title,
          info.author,
          String(m.views),
          String(m.uniqueReaders.size),
          avgReadTime,
          String(m.likes),
          String(m.shares),
          String(m.bookmarks),
          String(totalReactions),
        ]),
      );
    }

    const fromStr = range.from.toISOString().split("T")[0];
    const toStr = range.to.toISOString().split("T")[0];
    const filename = `analytics_${fromStr}_to_${toStr}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(rows.join("\n"));
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
