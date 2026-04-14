import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";
import { workspaceService } from "../modules/workspace/workspace.service";
import { tryConsumeAiDraftQuota } from "../shared/aiDraftQuota";
import { aiQuotaRejections } from "../observability/prometheusRegistry";

/**
 * Per-user (and optional org/workspace) AI quota for dedicated `/ai/*` endpoints.
 * Prefer `aiDraftQuotaGate` for content draft creation when only that path should charge quota.
 *
 * Uses Redis when `REDIS_URL` is set; otherwise in-memory (dev).
 */
export const aiQuotaEnforcer = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
    return;
  }

  if (req.user.role === "ADMIN") {
    next();
    return;
  }

  workspaceService
    .resolveDefaultWorkspaceId()
    .then((orgId) => tryConsumeAiDraftQuota(req.user!.id, orgId))
    .then((result) => {
      if (!result.ok) {
        aiQuotaRejections.inc({ scope: result.body.scope });
        res.status(result.status).json(result.body);
        return;
      }
      res.setHeader("X-AI-Quota-Limit", String(result.userLimit));
      res.setHeader("X-AI-Quota-Remaining", String(result.userRemaining));
      res.setHeader("X-AI-Quota-Reset", String(result.retryAfter));
      next();
    })
    .catch((e) => next(e));
};
