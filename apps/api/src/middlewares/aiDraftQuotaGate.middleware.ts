import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";
import { workspaceService } from "../modules/workspace/workspace.service";
import { tryConsumeAiDraftQuota } from "../shared/aiDraftQuota";
import { aiQuotaRejections } from "../observability/prometheusRegistry";

/**
 * Runs after `authenticate`. For `POST /content` when `aiGenerated` is true,
 * consumes per-user and optional per-workspace AI quotas before the handler runs.
 */
export function aiDraftQuotaGate(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.body?.aiGenerated) {
    next();
    return;
  }

  if (!req.user) {
    res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
    return;
  }

  if (req.user.role === "ADMIN") {
    next();
    return;
  }

  const templateId = req.body?.templateId as string | undefined;

  workspaceService
    .resolveWorkspaceIdForTemplate(templateId)
    .then((orgId) => tryConsumeAiDraftQuota(req.user!.id, orgId))
    .then((result) => {
      if (!result.ok) {
        aiQuotaRejections.inc({ scope: result.body.scope });
        res.status(result.status).json(result.body);
        return;
      }
      res.setHeader("X-AI-Quota-Limit-User", String(result.userLimit));
      res.setHeader("X-AI-Quota-Remaining-User", String(result.userRemaining));
      res.setHeader("X-AI-Quota-Reset", String(result.retryAfter));
      if (result.orgLimit != null) {
        res.setHeader("X-AI-Quota-Limit-Org", String(result.orgLimit));
        res.setHeader("X-AI-Quota-Remaining-Org", String(result.orgRemaining ?? 0));
      }
      next();
    })
    .catch((e) => next(e));
}
