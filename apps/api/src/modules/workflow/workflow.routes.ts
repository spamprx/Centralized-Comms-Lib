/**
 * Application Layer — Workflow & Pipeline Router (SRS §3.4.5, F-ADM-007)
 *
 * Provides the "Workflow & Pipeline" component described in the SRS
 * Application Layer.  Pipelines are stored as ReviewPolicy records
 * (the existing schema entity for configurable review rules) and extended
 * with pipeline-run tracking via AuditLog entries.
 *
 * Used by:
 *   F-ADM-007 Setup Pipelines
 *   F-AUT-010 AI – Content Pipeline
 *   F-REV-005 AI – Automate Approval of Specific Format
 *   F-REV-006 Assignment of Rules
 */

import { Router, Response } from "express";
import type { AuthRequest } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/auth.middleware";
import { getPrismaClient } from "../../repository";
import { evaluateBusinessRule } from "../../shared/businessRules";
import { enqueueAsyncAiJob } from "../../intelligence/asyncAiWorker";

const router = Router();

// ---------------------------------------------------------------------------
// Review Policy / Pipeline listing (F-ADM-007)
// ---------------------------------------------------------------------------

/**
 * @openapi
 * /api/v1/workflows/policies:
 *   get:
 *     summary: List all configured review policies (pipeline definitions)
 *     tags: [Workflow]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of review policy definitions
 *       403:
 *         description: Admin only
 */
router.get(
  "/policies",
  authorize("ADMIN"),
  async (_req: AuthRequest, res: Response) => {
    try {
      const policies = await getPrismaClient().reviewPolicy.findMany({
        orderBy: { createdAt: "desc" },
        include: { channel: { select: { id: true, name: true } } },
      });
      res.status(200).json({ policies });
    } catch (err) {
      res
        .status(500)
        .json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

/**
 * @openapi
 * /api/v1/workflows/policies:
 *   post:
 *     summary: Create a review policy (pipeline definition)
 *     tags: [Workflow]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contentType]
 *             properties:
 *               contentType:
 *                 type: string
 *                 enum: [ARTICLE, VIDEO, PODCAST, DOCUMENT]
 *               channelId:
 *                 type: string
 *               userGroupId:
 *                 type: string
 *               quorumRequired:
 *                 type: integer
 *                 default: 1
 *     responses:
 *       201:
 *         description: Created policy
 *       400:
 *         description: Validation error
 */
router.post(
  "/policies",
  authorize("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { contentType, channelId, userGroupId, quorumRequired } =
        req.body as {
          contentType?: string;
          channelId?: string;
          userGroupId?: string;
          quorumRequired?: number;
        };

      if (!contentType || typeof contentType !== "string") {
        res.status(400).json({ error: "contentType is required" });
        return;
      }

      const validContentTypes = ["ARTICLE", "VIDEO", "PODCAST", "DOCUMENT"];
      if (!validContentTypes.includes(contentType)) {
        res.status(400).json({
          error: `contentType must be one of: ${validContentTypes.join(", ")}`,
        });
        return;
      }

      const policy = await getPrismaClient().reviewPolicy.create({
        data: {
          contentType: contentType as any,
          channelId: channelId ?? null,
          userGroupId: userGroupId ?? null,
          quorumRequired: quorumRequired ?? 1,
          createdById: req.user?.id ?? null,
        },
      });

      await getPrismaClient().auditLog.create({
        data: {
          action: "CREATE",
          resource: "review_policy",
          resourceId: policy.id,
          actorId: req.user?.id ?? null,
          newValue: { contentType, quorumRequired } as any,
        },
      });

      res.status(201).json({ policy });
    } catch (err) {
      res
        .status(500)
        .json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

/**
 * @openapi
 * /api/v1/workflows/policies/{id}:
 *   get:
 *     summary: Get a review policy by ID
 *     tags: [Workflow]
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
 *         description: Policy definition
 *       404:
 *         description: Not found
 */
router.get(
  "/policies/:id",
  authorize("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const policy = await getPrismaClient().reviewPolicy.findUnique({
        where: { id: req.params.id },
        include: { channel: { select: { id: true, name: true } } },
      });
      if (!policy) {
        res.status(404).json({ error: "Policy not found" });
        return;
      }
      res.status(200).json({ policy });
    } catch (err) {
      res
        .status(500)
        .json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

/**
 * @openapi
 * /api/v1/workflows/policies/{id}:
 *   patch:
 *     summary: Update a review policy
 *     tags: [Workflow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Updated policy
 */
router.patch(
  "/policies/:id",
  authorize("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const existing = await getPrismaClient().reviewPolicy.findUnique({
        where: { id: req.params.id },
      });
      if (!existing) {
        res.status(404).json({ error: "Policy not found" });
        return;
      }

      const { quorumRequired, isActive, channelId, userGroupId } =
        req.body as Record<string, unknown>;

      const updated = await getPrismaClient().reviewPolicy.update({
        where: { id: req.params.id },
        data: {
          ...(typeof quorumRequired === "number" ? { quorumRequired } : {}),
          ...(typeof isActive === "boolean" ? { isActive } : {}),
          ...(typeof channelId === "string" ? { channelId } : {}),
          ...(typeof userGroupId === "string" ? { userGroupId } : {}),
        },
      });

      res.status(200).json({ policy: updated });
    } catch (err) {
      res
        .status(500)
        .json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

/**
 * @openapi
 * /api/v1/workflows/policies/{id}:
 *   delete:
 *     summary: Delete a review policy
 *     tags: [Workflow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Deleted
 */
router.delete(
  "/policies/:id",
  authorize("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const existing = await getPrismaClient().reviewPolicy.findUnique({
        where: { id: req.params.id },
      });
      if (!existing) {
        res.status(404).json({ error: "Policy not found" });
        return;
      }

      await getPrismaClient().reviewPolicy.delete({
        where: { id: req.params.id },
      });

      res.status(204).send();
    } catch (err) {
      res
        .status(500)
        .json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

// ---------------------------------------------------------------------------
// Pipeline execution (F-AUT-010 AI Content Pipeline, F-REV-005)
// ---------------------------------------------------------------------------

/**
 * @openapi
 * /api/v1/workflows/pipeline-run:
 *   post:
 *     summary: Trigger an AI content pipeline run on a content item
 *     description: >
 *       Validates business rules (S3), then enqueues an async AI job per
 *       configured pipeline stage (Intelligence Layer I2).
 *       Each stage produces a pass/fail result with actionable feedback
 *       (F-AUT-010 REQ-2).
 *     tags: [Workflow]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contentId, stages]
 *             properties:
 *               contentId:
 *                 type: string
 *               stages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [grammar, tone, compliance, plagiarism, format]
 *                     config:
 *                       type: object
 *     responses:
 *       202:
 *         description: Pipeline run enqueued
 *       400:
 *         description: Business rule violation or missing fields
 *       404:
 *         description: Content not found
 */
router.post(
  "/pipeline-run",
  async (req: AuthRequest, res: Response) => {
    try {
      const { contentId, stages } = req.body as {
        contentId?: string;
        stages?: unknown[];
      };

      if (!contentId) {
        res.status(400).json({ error: "contentId is required" });
        return;
      }
      if (!Array.isArray(stages) || stages.length === 0) {
        res.status(400).json({ error: "stages must be a non-empty array" });
        return;
      }

      const content = await getPrismaClient().content.findUnique({
        where: { id: contentId },
        select: { id: true, lifecycleState: true, authorId: true },
      });
      if (!content) {
        res.status(404).json({ error: "Content not found" });
        return;
      }

      // Only DRAFT or IN_REVIEW content can run pipelines
      const allowedStates = ["DRAFT", "IN_REVIEW"];
      if (!allowedStates.includes(content.lifecycleState)) {
        const ruleResult = evaluateBusinessRule(
          "content.lifecycle.transition",
          { from: content.lifecycleState, to: content.lifecycleState },
        );
        if (!ruleResult.passed) {
          res.status(400).json({
            error: `Pipeline cannot run on content in state: ${content.lifecycleState}`,
          });
          return;
        }
      }

      // Enqueue AI pipeline job via Intelligence Layer (F-AUT-010)
      await enqueueAsyncAiJob(contentId, "AI_JOB.CONTENT_PIPELINE", {
        contentId,
        stages,
        actorId: req.user?.id,
      });

      await getPrismaClient().auditLog.create({
        data: {
          action: "PIPELINE_RUN",
          resource: "content",
          resourceId: contentId,
          actorId: req.user?.id ?? null,
          newValue: { stages } as any,
        },
      });

      res.status(202).json({
        message: "Pipeline run enqueued",
        contentId,
        stageCount: stages.length,
      });
    } catch (err) {
      res
        .status(500)
        .json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

export default router;
