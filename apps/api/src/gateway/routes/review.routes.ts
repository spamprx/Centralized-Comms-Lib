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

/**
 * @openapi
 * /api/v1/reviews/requests:
 *   post:
 *     summary: Create a review request for a content version
 *     tags:
 *       - Reviews
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
 *               - contentVersionId
 *             properties:
 *               contentId:
 *                 type: string
 *               contentVersionId:
 *                 type: string
 *               quorumRequired:
 *                 type: integer
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Review request created
 *       400:
 *         description: Invalid payload
 *       404:
 *         description: Content not found
 *       422:
 *         description: Content not in a reviewable state
 *       500:
 *         description: Server error
 */
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

/**
 * @openapi
 * /api/v1/reviews/requests/{id}:
 *   get:
 *     summary: Get a review request by ID
 *     tags:
 *       - Reviews
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review request details
 *       404:
 *         description: Review request not found
 *       500:
 *         description: Server error
 */
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

/**
 * @openapi
 * /api/v1/reviews/content/{contentId}:
 *   get:
 *     summary: List review requests for a content item
 *     tags:
 *       - Reviews
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of review requests
 *       500:
 *         description: Server error
 */
router.get("/content/:contentId", async (req: AuthRequest, res: Response) => {
  try {
    const requests = await reviewService.listRequestsForContent(req.params.contentId);
    res.status(200).json(requests);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/reviews/requests/{id}/assign:
 *   post:
 *     summary: Assign a reviewer to a review request
 *     tags:
 *       - Reviews
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reviewerId
 *             properties:
 *               reviewerId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Reviewer assigned
 *       400:
 *         description: Invalid payload
 *       404:
 *         description: Review request not found
 *       500:
 *         description: Server error
 */
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

/**
 * @openapi
 * /api/v1/reviews/assignments/{id}/decide:
 *   post:
 *     summary: Record a review decision for an assignment
 *     tags:
 *       - Reviews
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - verdict
 *               - comment
 *             properties:
 *               verdict:
 *                 type: string
 *                 enum: [APPROVED, DENIED, ROLLBACK]
 *               comment:
 *                 type: string
 *     responses:
 *       200:
 *         description: Decision recorded
 *       400:
 *         description: Invalid payload
 *       404:
 *         description: Assignment not found
 *       422:
 *         description: Assignment already completed
 *       500:
 *         description: Server error
 */
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

/**
 * @openapi
 * /api/v1/reviews/assignments/{id}/rollback:
 *   post:
 *     summary: Roll back a completed review decision to pending
 *     description: Allows the assigned reviewer to revert their own decision, setting the assignment back to PENDING.
 *     tags:
 *       - Reviews
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Assignment rolled back to pending (or already pending)
 *       403:
 *         description: Forbidden – only the assigned reviewer can roll back
 *       404:
 *         description: Assignment not found
 *       500:
 *         description: Server error
 */
router.post("/assignments/:id/rollback", async (req: AuthRequest, res: Response) => {
  try {
    const result = await reviewService.rollbackToPending(
      auditContext(req),
      req.params.id,
    );

    if ("notFound" in result && result.notFound) {
      res.status(404).json({ error: "Review assignment not found" });
      return;
    }
    if ("forbidden" in result && result.forbidden) {
      res.status(403).json({ error: "Only the assigned reviewer can roll back this decision" });
      return;
    }

    res.status(200).json({ message: "Assignment rolled back to pending" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/reviews/my-assignments:
 *   get:
 *     summary: List review assignments for the current user
 *     tags:
 *       - Reviews
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of assignments
 *       500:
 *         description: Server error
 */
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
