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

function rangeWindowFromDays(days: number): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400000);
  return { from, to };
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function eachDay(from: Date, to: Date): string[] {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  const out: string[] = [];
  for (let cur = start; cur <= end; cur = new Date(cur.getTime() + 86400000)) {
    out.push(ymd(cur));
  }
  return out;
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
      const days = parseRangeDays(queryParamString(req.query.range, "30d"));
      const window = rangeWindowFromDays(days);

      const uow = new PrismaUnitOfWork(prisma);
      const repos = uow.repos();

      const [userCount, publishedInRange, viewEvents, interactionEvents, distinctUsers] =
        await Promise.all([
          repos.userRole.listUsers().then((u: unknown[]) => u.length),
          prisma.content.count({
            where: {
              lifecycleState: "PUBLISHED",
              createdAt: { gte: window.from, lte: window.to },
            },
          }),
          prisma.contentAnalyticsEvent.count({
            where: {
              createdAt: { gte: window.from, lte: window.to },
              eventType: "view",
            },
          }),
          prisma.contentAnalyticsEvent.count({
            where: {
              createdAt: { gte: window.from, lte: window.to },
              eventType: { in: ["like", "share", "bookmark", "comment"] },
            },
          }),
          prisma.contentAnalyticsEvent.findMany({
            where: { createdAt: { gte: window.from, lte: window.to } },
            select: { metadata: true },
          }),
        ]);

      const uniqueUserIds = new Set<string>();
      for (const row of distinctUsers) {
        const meta =
          row.metadata && typeof row.metadata === "object"
            ? (row.metadata as Record<string, unknown>)
            : null;
        const userId = meta?.userId;
        if (typeof userId === "string" && userId) uniqueUserIds.add(userId);
      }

      const interactionRatePct =
        viewEvents > 0
          ? Math.round((interactionEvents / viewEvents) * 1000) / 10
          : 0;

      res.status(200).json([
        {
          label: "Total Views",
          value: viewEvents.toLocaleString(),
        },
        {
          label: "Interaction rate",
          value: `${interactionRatePct}%`,
        },
        {
          label: "Active Users",
          value: uniqueUserIds.size.toLocaleString(),
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
      const days = parseRangeDays(queryParamString(req.query.range, "30d"));
      const window = rangeWindowFromDays(days);

      type Row = { day: string; count: bigint | number };
      const rows = await prisma.$queryRaw<Row[]>`
        SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') as day,
               COUNT(*)::bigint as count
        FROM content_analytics_events
        WHERE "createdAt" >= ${window.from}
          AND "createdAt" <= ${window.to}
          AND "eventType" = 'view'
        GROUP BY 1
        ORDER BY 1 ASC
      `;
      const byDay = new Map<string, number>();
      for (const r of rows) {
        const n =
          typeof r.count === "bigint"
            ? Number(r.count)
            : typeof r.count === "number"
              ? r.count
              : Number(r.count);
        byDay.set(String(r.day), Number.isFinite(n) ? n : 0);
      }
      const series = eachDay(window.from, window.to).map((day) => ({
        date: day,
        value: byDay.get(day) ?? 0,
      }));
      res.status(200).json(series);
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
      const prisma = getPrismaClient();
      const days = parseRangeDays(queryParamString(req.query.range, "7d"));
      const window = rangeWindowFromDays(days);

      type Row = { day: string; eventType: string; count: bigint | number };
      const rows = await prisma.$queryRaw<Row[]>`
        SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') as day,
               "eventType" as "eventType",
               COUNT(*)::bigint as count
        FROM content_analytics_events
        WHERE "createdAt" >= ${window.from}
          AND "createdAt" <= ${window.to}
          AND "eventType" IN ('view','like','share','comment')
        GROUP BY 1, 2
        ORDER BY 1 ASC
      `;

      const baseDays = eachDay(window.from, window.to);
      const byDay = new Map<
        string,
        { views: number; likes: number; shares: number; comments: number }
      >();
      for (const d of baseDays) byDay.set(d, { views: 0, likes: 0, shares: 0, comments: 0 });

      for (const r of rows) {
        const day = String(r.day);
        const target = byDay.get(day);
        if (!target) continue;
        const n =
          typeof r.count === "bigint"
            ? Number(r.count)
            : typeof r.count === "number"
              ? r.count
              : Number(r.count);
        const count = Number.isFinite(n) ? n : 0;
        switch (String(r.eventType)) {
          case "view":
            target.views += count;
            break;
          case "like":
            target.likes += count;
            break;
          case "share":
            target.shares += count;
            break;
          case "comment":
            target.comments += count;
            break;
        }
      }

      res.status(200).json(
        baseDays.map((day) => {
          const m = byDay.get(day)!;
          return {
            label: day.slice(5, 10),
            views: m.views,
            likes: m.likes,
            shares: m.shares,
            comments: m.comments,
          };
        }),
      );
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
      const prisma = getPrismaClient();
      const days = parseRangeDays(queryParamString(req.query.range, "30d"));
      const window = rangeWindowFromDays(days);

      const rows = await prisma.contentAnalyticsEvent.findMany({
        where: {
          createdAt: { gte: window.from, lte: window.to },
          eventType: "reading_time",
        },
        select: { metadata: true },
      });

      const buckets = [
        { range: "0-1 min", min: 0, max: 60, count: 0 },
        { range: "1-3 min", min: 60, max: 180, count: 0 },
        { range: "3-5 min", min: 180, max: 300, count: 0 },
        { range: "5-10 min", min: 300, max: 600, count: 0 },
        { range: "10-15 min", min: 600, max: 900, count: 0 },
        { range: "15+ min", min: 900, max: Number.POSITIVE_INFINITY, count: 0 },
      ];

      for (const r of rows) {
        const meta =
          r.metadata && typeof r.metadata === "object"
            ? (r.metadata as Record<string, unknown>)
            : null;
        const seconds = Number(meta?.seconds);
        if (!Number.isFinite(seconds) || seconds <= 0) continue;
        const b = buckets.find((b) => seconds >= b.min && seconds < b.max);
        if (b) b.count += 1;
      }

      res.status(200).json(buckets.map(({ range, count }) => ({ range, count })));
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
      const days = parseRangeDays(queryParamString(req.query.range, "30d"));
      const window = rangeWindowFromDays(days);

      // Determine "pieces" based on content that actually received views in the range.
      const viewed = await prisma.contentAnalyticsEvent.findMany({
        where: {
          createdAt: { gte: window.from, lte: window.to },
          eventType: "view",
        },
        distinct: ["contentId"],
        select: { contentId: true },
      });
      const contentIds = viewed.map((v) => v.contentId);
      if (contentIds.length === 0) {
        res.status(200).json([]);
        return;
      }

      const contents = await prisma.content.findMany({
        where: { id: { in: contentIds } },
        select: { contentType: true },
      });

      const counts = new Map<string, number>();
      for (const c of contents) {
        const key = String(c.contentType ?? "ARTICLE");
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const total = Array.from(counts.values()).reduce((a, b) => a + b, 0) || 1;

      // UI currently expects percentages.
      const toPct = (n: number) => Math.round((n / total) * 1000) / 10;

      const rows = Array.from(counts.entries())
        .map(([type, n]) => ({ type, n, pct: toPct(n) }))
        .sort((a, b) => b.n - a.n);

      res.status(200).json(
        rows.map((r) => ({
          type:
            r.type === "ARTICLE"
              ? "Articles"
              : r.type === "VIDEO"
                ? "Videos"
                : r.type === "PODCAST"
                  ? "Podcasts"
                  : r.type === "DOCUMENT"
                    ? "Documents"
                    : r.type,
          value: r.pct,
          color: "#937cf8",
        })),
      );
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

      const days = parseRangeDays(queryParamString(req.query.range, "30d"));
      const window = rangeWindowFromDays(days);

      type Row = { contentId: string; views: bigint | number };
      const viewRows = await prisma.$queryRaw<Row[]>`
        SELECT "contentId" as "contentId",
               COUNT(*)::bigint as views
        FROM content_analytics_events
        WHERE "createdAt" >= ${window.from}
          AND "createdAt" <= ${window.to}
          AND "eventType" = 'view'
        GROUP BY 1
        ORDER BY views DESC
        LIMIT ${limit}
      `;

      const ids = viewRows.map((r) => r.contentId);
      if (ids.length === 0) {
        res.status(200).json([]);
        return;
      }

      const contents = await prisma.content.findMany({
        where: { id: { in: ids } },
        include: { author: { select: { displayName: true } } },
      });
      const contentById = new Map(contents.map((c) => [c.id, c]));

      type ReadRow = { contentId: string; avgSeconds: number | null };
      const readRows = await prisma.$queryRaw<ReadRow[]>`
        SELECT "contentId" as "contentId",
               AVG( (metadata->>'seconds')::float ) as "avgSeconds"
        FROM content_analytics_events
        WHERE "createdAt" >= ${window.from}
          AND "createdAt" <= ${window.to}
          AND "eventType" = 'reading_time'
          AND (metadata->>'seconds') IS NOT NULL
        GROUP BY 1
      `;
      const avgReadById = new Map<string, number>();
      for (const r of readRows) {
        if (typeof r.avgSeconds === "number" && Number.isFinite(r.avgSeconds)) {
          avgReadById.set(r.contentId, r.avgSeconds);
        }
      }

      type InterRow = { contentId: string; interactions: bigint | number };
      const interRows = await prisma.$queryRaw<InterRow[]>`
        SELECT "contentId" as "contentId",
               COUNT(*)::bigint as interactions
        FROM content_analytics_events
        WHERE "createdAt" >= ${window.from}
          AND "createdAt" <= ${window.to}
          AND "eventType" IN ('like','share','bookmark','comment')
        GROUP BY 1
      `;
      const interById = new Map<string, number>();
      for (const r of interRows) {
        const n =
          typeof r.interactions === "bigint"
            ? Number(r.interactions)
            : typeof r.interactions === "number"
              ? r.interactions
              : Number(r.interactions);
        interById.set(r.contentId, Number.isFinite(n) ? n : 0);
      }

      const data = viewRows
        .map((r) => {
          const c = contentById.get(r.contentId);
          if (!c) return null;
          const views =
            typeof r.views === "bigint"
              ? Number(r.views)
              : typeof r.views === "number"
                ? r.views
                : Number(r.views);
          const interactions = interById.get(r.contentId) ?? 0;
          const engagement =
            views > 0 ? Math.round((interactions / views) * 1000) / 10 : 0;
          const avgSeconds = avgReadById.get(r.contentId) ?? 0;
          const mm = Math.floor(avgSeconds / 60);
          const ss = Math.floor(avgSeconds % 60);
          const avgReadTime = `${mm}:${String(ss).padStart(2, "0")}`;
          return {
            id: c.id,
            title: c.title,
            author: c.author?.displayName ?? "Unknown",
            views: Number.isFinite(views) ? views : 0,
            engagement,
            avgReadTime,
            publishedAt: c.createdAt.toISOString(),
          };
        })
        .filter(Boolean);

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
      const prisma = getPrismaClient();
      const days = parseRangeDays(queryParamString(req.query.range, "30d"));
      const window = rangeWindowFromDays(days);

      const totalViews = await prisma.contentAnalyticsEvent.count({
        where: {
          createdAt: { gte: window.from, lte: window.to },
          eventType: "view",
        },
      });

      // Peak hour (by views)
      type HourRow = { hour: number; count: bigint | number };
      const hourRows = await prisma.$queryRaw<HourRow[]>`
        SELECT EXTRACT(HOUR FROM "createdAt")::int as hour,
               COUNT(*)::bigint as count
        FROM content_analytics_events
        WHERE "createdAt" >= ${window.from}
          AND "createdAt" <= ${window.to}
          AND "eventType" = 'view'
        GROUP BY 1
        ORDER BY count DESC
        LIMIT 1
      `;
      const peakHour = hourRows[0]?.hour;
      const peakCountRaw = hourRows[0]?.count ?? 0;
      const peakCount =
        typeof peakCountRaw === "bigint"
          ? Number(peakCountRaw)
          : typeof peakCountRaw === "number"
            ? peakCountRaw
            : Number(peakCountRaw);

      // Weekend vs weekday views
      type DRow = { dow: number; count: bigint | number };
      const dowRows = await prisma.$queryRaw<DRow[]>`
        SELECT EXTRACT(DOW FROM "createdAt")::int as dow,
               COUNT(*)::bigint as count
        FROM content_analytics_events
        WHERE "createdAt" >= ${window.from}
          AND "createdAt" <= ${window.to}
          AND "eventType" = 'view'
        GROUP BY 1
      `;
      let weekend = 0;
      let weekday = 0;
      for (const r of dowRows) {
        const n =
          typeof r.count === "bigint"
            ? Number(r.count)
            : typeof r.count === "number"
              ? r.count
              : Number(r.count);
        const c = Number.isFinite(n) ? n : 0;
        if (r.dow === 0 || r.dow === 6) weekend += c;
        else weekday += c;
      }
      const weekendPct =
        weekend + weekday > 0
          ? Math.round((weekend / (weekend + weekday)) * 1000) / 10
          : 0;

      // Interaction rate overall
      const interactions = await prisma.contentAnalyticsEvent.count({
        where: {
          createdAt: { gte: window.from, lte: window.to },
          eventType: { in: ["like", "share", "bookmark", "comment"] },
        },
      });
      const interactionRate =
        totalViews > 0 ? Math.round((interactions / totalViews) * 1000) / 10 : 0;

      const insights = [];
      if (typeof peakHour === "number" && Number.isFinite(peakHour) && totalViews > 0) {
        const pct =
          totalViews > 0 ? Math.round((peakCount / totalViews) * 1000) / 10 : 0;
        insights.push({
          title: "Peak viewing hour",
          description: `Most views happen around ${String(peakHour).padStart(2, "0")}:00. That hour accounts for ~${pct}% of views in this range.`,
          sentiment: "positive" as const,
          impact: pct >= 20 ? ("high" as const) : ("medium" as const),
        });
      }
      insights.push({
        title: "Interaction rate",
        description: `You have an interaction rate of ~${interactionRate}% (likes/shares/bookmarks/comments per view) over the selected range.`,
        sentiment: interactionRate >= 5 ? ("positive" as const) : ("neutral" as const),
        impact: interactionRate >= 10 ? ("high" as const) : ("medium" as const),
      });
      if (totalViews > 0) {
        insights.push({
          title: "Weekend share of views",
          description: `Weekend traffic represents ~${weekendPct}% of views in this range.`,
          sentiment: "neutral" as const,
          impact: weekendPct <= 15 ? ("medium" as const) : ("low" as const),
        });
      }

      res.status(200).json(insights.slice(0, 4));
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
