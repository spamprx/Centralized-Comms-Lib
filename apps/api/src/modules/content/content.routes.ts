import { Router, Response } from "express";
import type { LifecycleState, Visibility } from "../../repository";
import type { AuthRequest } from "../../middlewares/auth.middleware";
import { aiDraftQuotaGate } from "../../middlewares/aiDraftQuotaGate.middleware";
import { contentService } from "../../service";
import type { AuditContext } from "../../shared/context";

const router = Router();

function auditContext(req: AuthRequest): AuditContext {
  return {
    actorId: req.user!.id,
    isAdmin: req.user!.role === "ADMIN",
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  };
}

function isValidTipTapDocument(obj: unknown): obj is Record<string, unknown> {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const doc = obj as Record<string, unknown>;
  return doc.type === "doc" && Array.isArray(doc.content);
}

/**
 * @openapi
 * /api/v1/content/{id}/co-authors:
 *   post:
 *     summary: Request to add a co-author to a content item
 *     description: Only the main author of the content can send co-author requests.
 *     tags:
 *       - Content
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
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Co-author request created
 *       400:
 *         description: Invalid payload
 *       403:
 *         description: Forbidden – only the main author can request co-authors
 *       404:
 *         description: Content not found
 *       409:
 *         description: Co-author already pending or already added
 *       500:
 *         description: Server error
 */
router.post("/:id/co-authors", async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.body as { userId?: string };
    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }

    const result = await contentService.requestCoAuthor(
      auditContext(req),
      req.params.id,
      userId,
    );

    if ("notFound" in result && result.notFound) {
      res.status(404).json({ error: "Content not found" });
      return;
    }
    if ("forbidden" in result && result.forbidden) {
      res.status(403).json({ error: "Only the main author can add co-authors" });
      return;
    }
    if ("alreadyCoAuthor" in result && result.alreadyCoAuthor) {
      res.status(409).json({ error: "User is already a co-author" });
      return;
    }
    if ("alreadyPending" in result && result.alreadyPending) {
      res.status(409).json({ error: "A co-author request is already pending" });
      return;
    }

    res.status(201).json({ message: "Co-author request created" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/content/{id}/co-authors/respond:
 *   post:
 *     summary: Respond to a co-author request
 *     description: Invited user approves or rejects a co-author request for a content item.
 *     tags:
 *       - Content
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
 *               - decision
 *             properties:
 *               decision:
 *                 type: string
 *                 enum: [APPROVE, REJECT]
 *     responses:
 *       200:
 *         description: Co-author request updated
 *       404:
 *         description: Co-author request not found
 *       500:
 *         description: Server error
 */
router.post("/:id/co-authors/respond", async (req: AuthRequest, res: Response) => {
  try {
    const { decision } = req.body as { decision?: "APPROVE" | "REJECT" };
    if (!decision || (decision !== "APPROVE" && decision !== "REJECT")) {
      res.status(400).json({ error: "decision must be APPROVE or REJECT" });
      return;
    }

    const result = await contentService.respondToCoAuthorRequest(
      auditContext(req),
      req.params.id,
      decision,
    );

    if ("notFound" in result && result.notFound) {
      res.status(404).json({ error: "Co-author request not found" });
      return;
    }

    if ("updated" in result && result.updated) {
      const accepted = "accepted" in result && result.accepted;
      res.status(200).json({
        message: accepted ? "Co-author request accepted" : "Co-author request rejected",
      });
      return;
    }

    res.status(500).json({ error: "Unexpected response from co-author service" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/content:
 *   post:
 *     summary: Create a new content draft
 *     tags:
 *       - Content
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *               body:
 *                 description: TipTap JSON document
 *                 type: object
 *               aiGenerated:
 *                 type: boolean
 *               templateId:
 *                 type: string
 *                 description: Optional template for formatting rules
 *     responses:
 *       201:
 *         description: Content draft created
 *       400:
 *         description: Invalid payload
 *       422:
 *         description: Template formatting rule violations
 *       429:
 *         description: AI user or organization quota exceeded (response includes machine-readable `code`)
 *       503:
 *         description: Quota storage unavailable (response includes `code` AI_QUOTA_UNAVAILABLE)
 *       500:
 *         description: Server error
 */
router.post("/", aiDraftQuotaGate, async (req: AuthRequest, res: Response) => {
  try {
    const { title, body, aiGenerated, templateId } = req.body;
    if (!title) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    if (body !== undefined && body !== null && !isValidTipTapDocument(body)) {
      res.status(400).json({
        error: "body must be a valid TipTap document (type: 'doc', content: array)",
      });
      return;
    }
    const result = await contentService.createDraft(auditContext(req), {
      title,
      body: body ?? undefined,
      aiGenerated,
      templateId: templateId ?? undefined,
    });
    if ("invalidFormatting" in result && result.invalidFormatting) {
      res.status(422).json({ error: "Formatting rule violations", violations: result.violations });
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
 * /api/v1/content:
 *   get:
 *     summary: List content items with optional filters
 *     tags:
 *       - Content
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: authorId
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
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of content items
 *       500:
 *         description: Server error
 */
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const filters = {
      authorId: req.query.authorId as string | undefined,
      lifecycleState: req.query.lifecycleState as LifecycleState | undefined,
      visibility: req.query.visibility as Visibility | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    };
    const contents = await contentService.list(filters, {
      id: req.user!.id,
      isAdmin: req.user!.role === "ADMIN",
    });
    res.status(200).json(contents);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/content/{id}:
 *   get:
 *     summary: Get a single content item by ID
 *     tags:
 *       - Content
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
 *         description: Content item with tags and versions
 *       404:
 *         description: Content not found
 *       500:
 *         description: Server error
 */
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const result = await contentService.getById(req.params.id, {
      id: req.user!.id,
      isAdmin: req.user!.role === "ADMIN",
    });
    if (!result) {
      res.status(404).json({ error: "Content not found" });
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
 * /api/v1/content/{id}:
 *   post:
 *     summary: Update content title and/or body
 *     description: Uses POST for updates instead of PATCH.
 *     tags:
 *       - Content
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
 *             properties:
 *               title:
 *                 type: string
 *               body:
 *                 description: TipTap JSON document
 *                 type: object
 *     responses:
 *       200:
 *         description: Updated content version
 *       400:
 *         description: Invalid payload
 *       403:
 *         description: Forbidden – user is not the author
 *       404:
 *         description: Content not found
 *       422:
 *         description: Invalid state for editing or template formatting violations
 *       500:
 *         description: Server error
 */
router.post("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { body, title } = req.body;
    if (body !== undefined && body !== null && !isValidTipTapDocument(body)) {
      res.status(400).json({
        error: "body must be a valid TipTap document (type: 'doc', content: array)",
      });
      return;
    }
    const result = await contentService.saveBody(auditContext(req), req.params.id, {
      body: body ?? undefined,
      title,
    });
    if ("notFound" in result && result.notFound) {
      res.status(404).json({ error: "Content not found" });
      return;
    }
    if ("forbidden" in result && result.forbidden) {
      res.status(403).json({ error: "You can only edit your own content" });
      return;
    }
    if ("invalidState" in result && result.invalidState) {
      res.status(422).json({
        error: `Cannot save body when content is ${result.state}. Only DRAFT or IN_REVIEW can be edited.`,
      });
      return;
    }
    if ("invalidFormatting" in result && result.invalidFormatting) {
      res.status(422).json({ error: "Formatting rule violations", violations: result.violations });
      return;
    }
    if ("version" in result) res.status(200).json(result.version);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/content/{id}/STATE_TRANSITION:
 *   post:
 *     summary: Transition content lifecycle state
 *     description: Change the lifecycle state of a content item.
 *     tags:
 *       - Content
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
 *               - lifecycleState
 *             properties:
 *               lifecycleState:
 *                 type: string
 *                 enum: [DRAFT, IN_REVIEW, PUBLISHED, ARCHIVED]
 *     responses:
 *       200:
 *         description: Updated content item
 *       400:
 *         description: Missing or invalid parameters
 *       404:
 *         description: Content not found
 *       422:
 *         description: Invalid state transition
 *       500:
 *         description: Server error
 */
router.post("/:id/STATE_TRANSITION", async (req: AuthRequest, res: Response) => {
  try {
    const { lifecycleState } = req.body;
    if (!lifecycleState) {
      res.status(400).json({ error: "lifecycleState is required" });
      return;
    }
    const result = await contentService.transitionState(
      auditContext(req),
      req.params.id,
      lifecycleState,
    );
    if ("notFound" in result && result.notFound) {
      res.status(404).json({ error: "Content not found" });
      return;
    }
    if ("forbidden" in result && result.forbidden) {
      res.status(403).json({ error: "Only the content author or an admin can transition state" });
      return;
    }
    if ("invalidTransition" in result && result.invalidTransition) {
      res.status(422).json({
        error: `Invalid state transition from ${result.current} to ${lifecycleState}`,
      });
      return;
    }
    if ("content" in result) res.status(200).json(result.content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});


/**
 * @openapi
 * /api/v1/content/{id}/delete:
 *   post:
 *     summary: Soft-delete a content item by archiving it
 *     description: Uses POST and marks the content as ARCHIVED instead of hard-deleting.
 *     tags:
 *       - Content
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
 *         description: Content archived (soft-deleted)
 *       404:
 *         description: Content not found
 *       422:
 *         description: Invalid state transition
 *       500:
 *         description: Server error
 */
router.post("/:id/delete", async (req: AuthRequest, res: Response) => {
  try {
    const result = await contentService.transitionState(
      auditContext(req),
      req.params.id,
      "ARCHIVED" as LifecycleState,
    );
    if ("notFound" in result && result.notFound) {
      res.status(404).json({ error: "Content not found" });
      return;
    }
    if ("forbidden" in result && result.forbidden) {
      res.status(403).json({ error: "Only the content author or an admin can delete content" });
      return;
    }
    if ("invalidTransition" in result && result.invalidTransition) {
      res.status(422).json({
        error: `Invalid state transition from ${result.current} to ARCHIVED`,
      });
      return;
    }
    if ("content" in result) res.status(200).json(result.content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/content/{id}/visibility:
 *   patch:
 *     summary: Update content visibility
 *     description: Change the visibility of a content item and optionally bind it to a visibility group.
 *     tags:
 *       - Content
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
 *               - visibility
 *             properties:
 *               visibility:
 *                 type: string
 *                 enum: [PUBLIC, PRIVATE, HIDDEN, ARCHIVED, PRIVATE_TO_GROUP]
 *               visibilityGroupId:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Updated content item
 *       400:
 *         description: Missing or invalid parameters
 *       404:
 *         description: Content not found
 *       500:
 *         description: Server error
 */
router.patch("/:id/visibility", async (req: AuthRequest, res: Response) => {
  try {
    const { visibility, visibilityGroupId } = req.body;
    if (!visibility) {
      res.status(400).json({ error: "visibility is required" });
      return;
    }
    const result = await contentService.updateVisibility(
      auditContext(req),
      req.params.id,
      visibility,
      visibilityGroupId,
    );
    if ("notFound" in result && result.notFound) {
      res.status(404).json({ error: "Content not found" });
      return;
    }
    if ("forbidden" in result && result.forbidden) {
      res.status(403).json({ error: "Only the content author or an admin can change visibility" });
      return;
    }
    if ("content" in result) res.status(200).json(result.content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/content/{id}/tags:
 *   post:
 *     summary: Assign a tag to a content item
 *     tags:
 *       - Content
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
 *               - tagId
 *             properties:
 *               tagId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tag assigned
 *       400:
 *         description: Missing tagId
 *       500:
 *         description: Server error
 */
router.post("/:id/tags", async (req: AuthRequest, res: Response) => {
  try {
    const { tagId } = req.body;
    if (!tagId) {
      res.status(400).json({ error: "tagId is required" });
      return;
    }
    const result = await contentService.assignTag(auditContext(req), req.params.id, tagId);
    if ("notFound" in result && result.notFound) {
      res.status(404).json({ error: "Content not found" });
      return;
    }
    if ("forbidden" in result && result.forbidden) {
      res.status(403).json({ error: "Only the content author or an admin can assign tags" });
      return;
    }
    res.status(200).json({ message: "Tag assigned" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/content/{id}/tags/{tagId}:
 *   delete:
 *     summary: Remove a tag from a content item
 *     tags:
 *       - Content
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: tagId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tag removed
 *       500:
 *         description: Server error
 */
router.delete("/:id/tags/:tagId", async (req: AuthRequest, res: Response) => {
  try {
    const result = await contentService.removeTag(
      auditContext(req),
      req.params.id,
      req.params.tagId,
    );
    if ("notFound" in result && result.notFound) {
      res.status(404).json({ error: "Content not found" });
      return;
    }
    if ("forbidden" in result && result.forbidden) {
      res.status(403).json({ error: "Only the content author or an admin can remove tags" });
      return;
    }
    res.status(200).json({ message: "Tag removed" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/content/{id}/versions:
 *   get:
 *     summary: List all versions of a content item
 *     tags:
 *       - Content
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
 *         description: List of content versions
 *       500:
 *         description: Server error
 */
router.get("/:id/versions", async (req: AuthRequest, res: Response) => {
  try {
    const result = await contentService.getById(req.params.id, {
      id: req.user!.id,
      isAdmin: req.user!.role === "ADMIN",
    });
    if (!result) {
      res.status(404).json({ error: "Content not found" });
      return;
    }
    res.status(200).json(result.versions);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
