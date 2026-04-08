import { Router, Response } from "express";

import type { AuthRequest } from "../../middlewares/auth.middleware";
import type { CitationStyle, CitationWork } from "./citation.types";
import { renderCitation } from "./citation.render";

const router = Router();

const STYLES = new Set<CitationStyle>(["APA", "IEEE", "MLA"]);

/**
 * @openapi
 * /api/v1/citations/render:
 *   post:
 *     summary: Render a bibliographic citation string (APA, IEEE, or MLA)
 *     tags:
 *       - Citations
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - style
 *               - work
 *             properties:
 *               style:
 *                 type: string
 *                 enum: [APA, IEEE, MLA]
 *               work:
 *                 type: object
 *                 required:
 *                   - title
 *                 properties:
 *                   title:
 *                     type: string
 *                   authors:
 *                     type: array
 *                     items:
 *                       type: string
 *                   container:
 *                     type: string
 *                   year:
 *                     oneOf:
 *                       - type: string
 *                       - type: integer
 *                   doi:
 *                     type: string
 *                   url:
 *                     type: string
 *     responses:
 *       200:
 *         description: Rendered citation text
 *       400:
 *         description: Invalid style or work
 */
router.post("/render", async (req: AuthRequest, res: Response) => {
  try {
    const { style, work } = req.body as { style?: string; work?: CitationWork };
    if (!style || !STYLES.has(style as CitationStyle)) {
      res.status(400).json({ error: "style must be APA, IEEE, or MLA" });
      return;
    }
    if (!work || typeof work !== "object" || typeof work.title !== "string" || !work.title.trim()) {
      res.status(400).json({ error: "work.title is required" });
      return;
    }
    const text = renderCitation(style as CitationStyle, work);
    res.status(200).json({ style, text, work });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
