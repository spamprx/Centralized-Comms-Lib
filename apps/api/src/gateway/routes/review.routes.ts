import { Router, Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware";
import { reviewService } from "../../service";
import type { AuditContext } from "../../service/context";

const router = Router();

function auditContext(req: AuthRequest): AuditContext {
  return {
    actorId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  };
}

router.post("/requests", async (req: AuthRequest, res: Response) => {
  try {
    const { contentId, contentVersionId, quorumRequired } = req.body;
    if (!contentId || !contentVersionId) {
      res.status(400).json({ error: "contentId and contentVersionId are required" });
      return;
    }
    const result = await reviewService.createRequest(auditContext(req), {
      contentId,
      contentVersionId,
      quorumRequired,
    });
    if ("notFound" in result && result.notFound) {
      res.status(404).json({ error: "Content not found" });
      return;
    }
    if ("invalidState" in result && result.invalidState) {
      res.status(422).json({
        error: `Content must be in DRAFT or IN_REVIEW state, currently ${result.state}`,
      });
      return;
    }
    res.status(201).json(result.request);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get("/requests/:id", async (req: AuthRequest, res: Response) => {
  try {
    const result = await reviewService.getRequestById(req.params.id);
    if (!result) {
      res.status(404).json({ error: "Review request not found" });
      return;
    }
    res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get("/content/:contentId", async (req: AuthRequest, res: Response) => {
  try {
    const requests = await reviewService.listRequestsForContent(req.params.contentId);
    res.status(200).json(requests);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post("/requests/:id/assign", async (req: AuthRequest, res: Response) => {
  try {
    const { reviewerId } = req.body;
    if (!reviewerId) {
      res.status(400).json({ error: "reviewerId is required" });
      return;
    }
    const result = await reviewService.assignReviewer(
      auditContext(req),
      req.params.id,
      reviewerId,
    );
    if (!result) {
      res.status(404).json({ error: "Review request not found" });
      return;
    }
    res.status(201).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post("/assignments/:id/decide", async (req: AuthRequest, res: Response) => {
  try {
    const { verdict, comment } = req.body;
    if (!verdict || !comment) {
      res.status(400).json({ error: "verdict and comment are required" });
      return;
    }
    const validVerdicts = ["APPROVED", "DENIED", "ROLLBACK"];
    if (!validVerdicts.includes(verdict)) {
      res.status(400).json({
        error: `verdict must be one of: ${validVerdicts.join(", ")}`,
      });
      return;
    }
    const result = await reviewService.decide(
      auditContext(req),
      req.params.id,
      verdict,
      comment,
    );
    if ("notFound" in result && result.notFound) {
      res.status(404).json({ error: "Review assignment not found" });
      return;
    }
    if ("alreadyCompleted" in result && result.alreadyCompleted) {
      res.status(422).json({ error: "Assignment already completed" });
      return;
    }
    res.status(200).json({ message: `Decision recorded: ${verdict}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get("/my-assignments", async (req: AuthRequest, res: Response) => {
  try {
    const assignments = await reviewService.listAssignmentsForReviewer(req.user!.id);
    res.status(200).json(assignments);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
