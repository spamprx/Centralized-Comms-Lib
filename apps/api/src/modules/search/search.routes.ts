import { Router, Response } from "express";

import type { AuthRequest } from "../../middlewares/auth.middleware";
import {
  searchContentCached,
  searchContentCheck,
} from "../../search/contentSearch.service";
import { parseContentSearchFilters } from "./search.filters";
import { assertValidQueryVector, type RankBlendWeights } from "../../search/rankBlend";

const router = Router();

function parseWeights(raw: string | undefined): Partial<RankBlendWeights> | undefined {
  if (!raw?.trim()) return undefined;
  try {
    const j = JSON.parse(raw) as Partial<RankBlendWeights>;
    if (typeof j !== "object" || j === null) return undefined;
    return j;
  } catch {
    return undefined;
  }
}

/**
 * @openapi
 * /api/v1/search/content:
 *   get:
 *     summary: Search indexed content with facet filters and optional highlights
 *     tags:
 *       - Search
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Keyword query
 *       - in: query
 *         name: from
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: includeFacets
 *         schema:
 *           type: boolean
 *           default: true
 *       - in: query
 *         name: includeSnippets
 *         schema:
 *           type: boolean
 *           description: Safe HTML snippets from Elasticsearch highlights
 *       - in: query
 *         name: recencyHalfLifeDays
 *         schema:
 *           type: integer
 *       - in: query
 *         name: queryVector
 *         schema:
 *           type: string
 *         description: JSON array of embedding floats (title dimension)
 *       - in: query
 *         name: weights
 *         schema:
 *           type: string
 *         description: JSON object with keyword, vector, recency, engagement weights
 *       - in: query
 *         name: workspaceId
 *         schema:
 *           type: string
 *       - in: query
 *         name: lifecycleState
 *         schema:
 *           type: string
 *           enum: [DRAFT, IN_REVIEW, PUBLISHED, ARCHIVED]
 *       - in: query
 *         name: visibility
 *         schema:
 *           type: string
 *       - in: query
 *         name: authorId
 *         schema:
 *           type: string
 *       - in: query
 *         name: templateId
 *         schema:
 *           type: string
 *       - in: query
 *         name: channelIds
 *         schema:
 *           type: string
 *         description: Comma-separated channel IDs
 *       - in: query
 *         name: tagIds
 *         schema:
 *           type: string
 *       - in: query
 *         name: tagSlugs
 *         schema:
 *           type: string
 *       - in: query
 *         name: aiGenerated
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Hits, total, optional facets
 *       400:
 *         description: Invalid filter or vector
 *       503:
 *         description: Elasticsearch unavailable
 */
router.get("/content", async (req: AuthRequest, res: Response) => {
  try {
    const { filters, errors } = parseContentSearchFilters(req.query as Record<string, unknown>);
    if (errors.length) {
      res.status(400).json({ error: "Invalid filter parameters", details: errors });
      return;
    }

    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const from = req.query.from ? Math.max(0, parseInt(String(req.query.from), 10) || 0) : 0;
    const size = req.query.size ? Math.min(100, Math.max(1, parseInt(String(req.query.size), 10) || 20)) : 20;
    const includeFacets = req.query.includeFacets !== "false";
    const includeSnippets = req.query.includeSnippets === "true";
    const halfLife = req.query.recencyHalfLifeDays
      ? Math.max(1, parseInt(String(req.query.recencyHalfLifeDays), 10) || 30)
      : 30;
    const weights = parseWeights(typeof req.query.weights === "string" ? req.query.weights : undefined);

    let queryVector: unknown = undefined;
    if (typeof req.query.queryVector === "string" && req.query.queryVector.trim()) {
      try {
        queryVector = JSON.parse(req.query.queryVector);
      } catch {
        res.status(400).json({ error: "queryVector must be JSON array of numbers" });
        return;
      }
    }
    if (queryVector !== undefined && assertValidQueryVector(queryVector) === null) {
      res.status(400).json({ error: `queryVector must have valid embedding length` });
      return;
    }

    const raw = await searchContentCached({
      q,
      from,
      size,
      filters,
      queryVector,
      includeFacets,
      includeSnippets,
      recencyHalfLifeDays: halfLife,
      weights,
    });
    if (raw === null) {
      res.status(503).json({ error: "Search index unavailable (Elasticsearch not configured)" });
      return;
    }
    res.status(200).json(raw);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * @openapi
 * /api/v1/search/content-check:
 *   get:
 *     summary: Find similar content (duplicate-style check) for a given content id
 *     tags:
 *       - Search
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: contentId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *       - in: query
 *         name: minScore
 *         schema:
 *           type: number
 *       - in: query
 *         name: workspaceId
 *         schema:
 *           type: string
 *       - in: query
 *         name: lifecycleState
 *         schema:
 *           type: string
 *       - in: query
 *         name: visibility
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Similar hits excluding the source id
 *       400:
 *         description: Missing contentId or invalid filters
 *       503:
 *         description: Search unavailable
 */
router.get("/content-check", async (req: AuthRequest, res: Response) => {
  try {
    const contentId = typeof req.query.contentId === "string" ? req.query.contentId : "";
    if (!contentId) {
      res.status(400).json({ error: "contentId query parameter is required" });
      return;
    }
    const { filters, errors } = parseContentSearchFilters(req.query as Record<string, unknown>);
    if (errors.length) {
      res.status(400).json({ error: "Invalid filter parameters", details: errors });
      return;
    }
    const size = req.query.size ? Math.min(50, Math.max(1, parseInt(String(req.query.size), 10) || 12)) : 12;
    const minScore = req.query.minScore ? parseFloat(String(req.query.minScore)) : undefined;

    const raw = await searchContentCheck({
      contentId,
      filters,
      size,
      ...(minScore !== undefined && Number.isFinite(minScore) ? { minScore } : {}),
    });
    if (raw === null) {
      res.status(503).json({ error: "Search index unavailable" });
      return;
    }
    res.status(200).json(raw);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
