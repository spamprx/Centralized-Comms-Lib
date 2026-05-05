import { Router, Request, Response, NextFunction } from "express";

/**
 * Application Layer — AI sub-router (SRS §3.4.5 Intelligence Layer entry point).
 *
 * All endpoints mounted here have already passed through:
 *   authenticate → recordUserActivity → aiQuotaEnforcer
 *
 * This router acts as the dispatch point from the Gateway into the
 * Intelligence Layer (syncAi / asyncAiWorker).  Individual AI feature
 * endpoints are registered as sub-paths so they benefit from the single
 * gateway-level quota gate rather than duplicating middleware per module.
 */

const aiRouter = Router();

/**
 * @openapi
 * /api/v1/ai/health:
 *   get:
 *     summary: AI service health probe
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: AI layer reachable
 */
aiRouter.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ ok: true, layer: "intelligence" });
});

export function registerAiRoutes(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  aiRouter(req, res, next);
}
