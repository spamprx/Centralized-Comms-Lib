import { Router, Response } from "express";
import type { LifecycleState, Visibility } from "../../repository";
import type { AuthRequest } from "../../middlewares/auth.middleware";
import { aiDraftQuotaGate } from "../../middlewares/aiDraftQuotaGate.middleware";
import { contentService } from "../../service";
import { getPrismaClient } from "../../repository";
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
      res
        .status(403)
        .json({ error: "Only the main author can add co-authors" });
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
router.post(
  "/:id/co-authors/respond",
  async (req: AuthRequest, res: Response) => {
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
          message: accepted
            ? "Co-author request accepted"
            : "Co-author request rejected",
        });
        return;
      }

      res
        .status(500)
        .json({ error: "Unexpected response from co-author service" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

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
    const { title, body, aiGenerated, templateId, contentType } = req.body;
    if (!title) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    if (body !== undefined && body !== null && !isValidTipTapDocument(body)) {
      res.status(400).json({
        error:
          "body must be a valid TipTap document (type: 'doc', content: array)",
      });
      return;
    }
    const result = await contentService.createDraft(auditContext(req), {
      title,
      body: body ?? undefined,
      aiGenerated,
      templateId: templateId ?? undefined,
      contentType: contentType ?? undefined,
    });
    if ("invalidFormatting" in result && result.invalidFormatting) {
      res
        .status(422)
        .json({
          error: "Formatting rule violations",
          violations: result.violations,
        });
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
    const isAdmin = req.user!.role === "ADMIN";
    const requesterId = req.user!.id;
    const requestedAuthorId = req.query.authorId as string | undefined;
    const isOwnListRequest =
      !!requestedAuthorId && requestedAuthorId === requesterId;
    const filters = {
      authorId: requestedAuthorId,
      // Security: non-admins can only list non-published content for themselves.
      lifecycleState:
        isAdmin || isOwnListRequest
          ? (req.query.lifecycleState as LifecycleState | undefined)
          : ("PUBLISHED" as LifecycleState),
      visibility: req.query.visibility as Visibility | undefined,
      contentType: req.query.contentType as any,
      limit: req.query.limit
        ? Number.parseInt(req.query.limit as string)
        : undefined,
      offset: req.query.offset
        ? Number.parseInt(req.query.offset as string)
        : undefined,
    };
    const contents = await contentService.list(filters, {
      id: requesterId,
      isAdmin,
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
 *   delete:
 *     summary: Delete a content item (author or admin)
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
 *       204:
 *         description: Deleted
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const result = await contentService.delete(
      auditContext(req),
      req.params.id,
    );
    if ("notFound" in result && result.notFound) {
      res.status(404).json({ error: "Content not found" });
      return;
    }
    if ("forbidden" in result && result.forbidden) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    res.status(204).send();
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
    const { body, title, contentType } = req.body;
    if (body !== undefined && body !== null && !isValidTipTapDocument(body)) {
      res.status(400).json({
        error:
          "body must be a valid TipTap document (type: 'doc', content: array)",
      });
      return;
    }
    const result = await contentService.saveBody(
      auditContext(req),
      req.params.id,
      {
        body: body ?? undefined,
        title,
        contentType: contentType ?? undefined,
      },
    );
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
      res
        .status(422)
        .json({
          error: "Formatting rule violations",
          violations: result.violations,
        });
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
router.post(
  "/:id/STATE_TRANSITION",
  async (req: AuthRequest, res: Response) => {
    try {
      const raw = (req.body as { lifecycleState?: unknown })?.lifecycleState;
      const lifecycleState =
        typeof raw === "string"
          ? (raw.toUpperCase() as LifecycleState)
          : (raw as LifecycleState);
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
        res
          .status(403)
          .json({
            error: "Only the content author or an admin can transition state",
          });
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
  },
);

/**
 * @openapi
 * /api/v1/content/{id}/annotations:
 *   get:
 *     summary: List annotations for a content item
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
 *         description: List of annotations
 *       404:
 *         description: Content not found
 *       500:
 *         description: Server error
 *   post:
 *     summary: Add an annotation to a content item
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
 *               - body
 *             properties:
 *               body:
 *                 type: string
 *               selectionFrom:
 *                 type: integer
 *               selectionTo:
 *                 type: integer
 *               selectionText:
 *                 type: string
 *     responses:
 *       201:
 *         description: Annotation created
 *       400:
 *         description: Missing body
 *       404:
 *         description: Content not found
 *       500:
 *         description: Server error
 */
router.get("/:id/annotations", async (req: AuthRequest, res: Response) => {
  try {
    const detail = await contentService.getById(req.params.id, {
      id: req.user!.id,
      isAdmin: req.user!.role === "ADMIN",
    });
    if (!detail) {
      res.status(404).json({ error: "Content not found" });
      return;
    }

    const prisma = getPrismaClient();
    const rows = await prisma.contentAnnotation.findMany({
      where: { contentId: req.params.id },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, displayName: true, email: true } },
      },
      take: 200,
    });
    res.status(200).json(
      rows.map((r: (typeof rows)[number]) => ({
        id: r.id,
        body: r.body,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        contentId: r.contentId,
        author: r.author,
        selectionFrom: r.selectionFrom,
        selectionTo: r.selectionTo,
        selectionText: r.selectionText,
      })),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post("/:id/annotations", async (req: AuthRequest, res: Response) => {
  try {
    const { body, selectionFrom, selectionTo, selectionText } = req.body as {
      body?: unknown;
      selectionFrom?: unknown;
      selectionTo?: unknown;
      selectionText?: unknown;
    };
    if (typeof body !== "string" || body.trim() === "") {
      res.status(400).json({ error: "body is required" });
      return;
    }

    const detail = await contentService.getById(req.params.id, {
      id: req.user!.id,
      isAdmin: req.user!.role === "ADMIN",
    });
    if (!detail) {
      res.status(404).json({ error: "Content not found" });
      return;
    }

    const prisma = getPrismaClient();
    const created = await prisma.contentAnnotation.create({
      data: {
        contentId: req.params.id,
        authorId: req.user!.id,
        body: body.trim(),
        selectionFrom: typeof selectionFrom === "number" ? selectionFrom : null,
        selectionTo: typeof selectionTo === "number" ? selectionTo : null,
        selectionText: typeof selectionText === "string" ? selectionText : null,
      },
      include: {
        author: { select: { id: true, displayName: true, email: true } },
      },
    });

    res.status(201).json({
      id: created.id,
      body: created.body,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      contentId: created.contentId,
      author: created.author,
      selectionFrom: created.selectionFrom,
      selectionTo: created.selectionTo,
      selectionText: created.selectionText,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/content/{id}/bookmark:
 *   get:
 *     summary: Check if current user bookmarked a content item
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
 *         description: Bookmark state
 *       404:
 *         description: Content not found
 *       500:
 *         description: Server error
 *   post:
 *     summary: Bookmark (save) a content item for current user
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
 *       201:
 *         description: Bookmarked
 *       404:
 *         description: Content not found
 *       500:
 *         description: Server error
 *   delete:
 *     summary: Remove bookmark for current user
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
 *       204:
 *         description: Unbookmarked
 *       404:
 *         description: Content not found
 *       500:
 *         description: Server error
 */
router.get("/:id/bookmark", async (req: AuthRequest, res: Response) => {
  try {
    const detail = await contentService.getById(req.params.id, {
      id: req.user!.id,
      isAdmin: req.user!.role === "ADMIN",
    });
    if (!detail) {
      res.status(404).json({ error: "Content not found" });
      return;
    }
    const prisma = getPrismaClient();
    const existing = await prisma.contentBookmark.findUnique({
      where: {
        contentId_userId: { contentId: req.params.id, userId: req.user!.id },
      },
      select: { id: true },
    });
    res.status(200).json({ bookmarked: !!existing });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post("/:id/bookmark", async (req: AuthRequest, res: Response) => {
  try {
    const detail = await contentService.getById(req.params.id, {
      id: req.user!.id,
      isAdmin: req.user!.role === "ADMIN",
    });
    if (!detail) {
      res.status(404).json({ error: "Content not found" });
      return;
    }
    const prisma = getPrismaClient();
    await prisma.contentBookmark.upsert({
      where: {
        contentId_userId: { contentId: req.params.id, userId: req.user!.id },
      },
      create: { contentId: req.params.id, userId: req.user!.id },
      update: {},
    });
    res.status(201).json({ bookmarked: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.delete("/:id/bookmark", async (req: AuthRequest, res: Response) => {
  try {
    const detail = await contentService.getById(req.params.id, {
      id: req.user!.id,
      isAdmin: req.user!.role === "ADMIN",
    });
    if (!detail) {
      res.status(404).json({ error: "Content not found" });
      return;
    }
    const prisma = getPrismaClient();
    await prisma.contentBookmark.deleteMany({
      where: { contentId: req.params.id, userId: req.user!.id },
    });
    res.status(204).send();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/content/{id}/engagement:
 *   get:
 *     summary: Get engagement counts and current-user state
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
 *         description: Engagement summary
 *       404:
 *         description: Content not found
 *       500:
 *         description: Server error
 */
router.get("/:id/engagement", async (req: AuthRequest, res: Response) => {
  try {
    const detail = await contentService.getById(req.params.id, {
      id: req.user!.id,
      isAdmin: req.user!.role === "ADMIN",
    });
    if (!detail) {
      res.status(404).json({ error: "Content not found" });
      return;
    }

    const prisma = getPrismaClient();
    const [views, likes, comments, likedByMe] = await Promise.all([
      prisma.contentView.count({ where: { contentId: req.params.id } }),
      prisma.contentLike.count({ where: { contentId: req.params.id } }),
      prisma.contentComment.count({ where: { contentId: req.params.id } }),
      prisma.contentLike.findUnique({
        where: {
          contentId_userId: { contentId: req.params.id, userId: req.user!.id },
        },
        select: { id: true },
      }),
    ]);

    res.status(200).json({
      views,
      likes,
      comments,
      likedByMe: !!likedByMe,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/content/{id}/view:
 *   post:
 *     summary: Record a view once per tab session
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
 *               - sessionId
 *             properties:
 *               sessionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated view count
 *       400:
 *         description: Missing sessionId
 *       404:
 *         description: Content not found
 *       500:
 *         description: Server error
 */
router.post("/:id/view", async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.body as { sessionId?: unknown };
    if (typeof sessionId !== "string" || sessionId.trim() === "") {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    const detail = await contentService.getById(req.params.id, {
      id: req.user!.id,
      isAdmin: req.user!.role === "ADMIN",
    });
    if (!detail) {
      res.status(404).json({ error: "Content not found" });
      return;
    }

    const prisma = getPrismaClient();
    await prisma.contentView.upsert({
      where: {
        contentId_sessionId: {
          contentId: req.params.id,
          sessionId: sessionId.trim(),
        },
      },
      create: {
        contentId: req.params.id,
        userId: req.user!.id,
        sessionId: sessionId.trim(),
      },
      update: {},
    });

    const views = await prisma.contentView.count({
      where: { contentId: req.params.id },
    });
    res.status(200).json({ views });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/content/{id}/like:
 *   post:
 *     summary: Like ("Helpful") a content item
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
 *         description: Liked state + updated count
 *       404:
 *         description: Content not found
 *       500:
 *         description: Server error
 *   delete:
 *     summary: Remove like ("Helpful") for a content item
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
 *         description: Unliked state + updated count
 *       404:
 *         description: Content not found
 *       500:
 *         description: Server error
 */
router.post("/:id/like", async (req: AuthRequest, res: Response) => {
  try {
    const detail = await contentService.getById(req.params.id, {
      id: req.user!.id,
      isAdmin: req.user!.role === "ADMIN",
    });
    if (!detail) {
      res.status(404).json({ error: "Content not found" });
      return;
    }

    const prisma = getPrismaClient();
    await prisma.contentLike.upsert({
      where: {
        contentId_userId: { contentId: req.params.id, userId: req.user!.id },
      },
      create: { contentId: req.params.id, userId: req.user!.id },
      update: {},
    });
    const likes = await prisma.contentLike.count({
      where: { contentId: req.params.id },
    });
    res.status(200).json({ liked: true, likes });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.delete("/:id/like", async (req: AuthRequest, res: Response) => {
  try {
    const detail = await contentService.getById(req.params.id, {
      id: req.user!.id,
      isAdmin: req.user!.role === "ADMIN",
    });
    if (!detail) {
      res.status(404).json({ error: "Content not found" });
      return;
    }

    const prisma = getPrismaClient();
    await prisma.contentLike.deleteMany({
      where: { contentId: req.params.id, userId: req.user!.id },
    });
    const likes = await prisma.contentLike.count({
      where: { contentId: req.params.id },
    });
    res.status(200).json({ liked: false, likes });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/content/{id}/comments:
 *   get:
 *     summary: List comments for a content item
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
 *         description: Comment list
 *       404:
 *         description: Content not found
 *       500:
 *         description: Server error
 *   post:
 *     summary: Add a comment to a content item
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
 *               - body
 *             properties:
 *               body:
 *                 type: string
 *     responses:
 *       201:
 *         description: Created comment
 *       400:
 *         description: Missing body
 *       404:
 *         description: Content not found
 *       500:
 *         description: Server error
 */
router.get("/:id/comments", async (req: AuthRequest, res: Response) => {
  try {
    const detail = await contentService.getById(req.params.id, {
      id: req.user!.id,
      isAdmin: req.user!.role === "ADMIN",
    });
    if (!detail) {
      res.status(404).json({ error: "Content not found" });
      return;
    }

    const prisma = getPrismaClient();
    type CommentRow = {
      id: string;
      body: string;
      createdAt: Date;
      updatedAt: Date;
      contentId: string;
      author: { id: string; displayName: string; email: string };
    };
    const rows = (await prisma.contentComment.findMany({
      where: { contentId: req.params.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        author: { select: { id: true, displayName: true, email: true } },
      },
    })) as CommentRow[];

    res.status(200).json(
      rows.map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        contentId: c.contentId,
        author: c.author,
      })),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post("/:id/comments", async (req: AuthRequest, res: Response) => {
  try {
    const { body } = req.body as { body?: unknown };
    if (typeof body !== "string" || body.trim() === "") {
      res.status(400).json({ error: "body is required" });
      return;
    }

    const detail = await contentService.getById(req.params.id, {
      id: req.user!.id,
      isAdmin: req.user!.role === "ADMIN",
    });
    if (!detail) {
      res.status(404).json({ error: "Content not found" });
      return;
    }

    const prisma = getPrismaClient();
    const created = await prisma.contentComment.create({
      data: {
        contentId: req.params.id,
        authorId: req.user!.id,
        body: body.trim(),
      },
      include: {
        author: { select: { id: true, displayName: true, email: true } },
      },
    });

    res.status(201).json({
      id: created.id,
      body: created.body,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      contentId: created.contentId,
      author: created.author,
    });
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
      res
        .status(403)
        .json({
          error: "Only the content author or an admin can delete content",
        });
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
      res
        .status(403)
        .json({
          error: "Only the content author or an admin can change visibility",
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
    const result = await contentService.assignTag(
      auditContext(req),
      req.params.id,
      tagId,
    );
    if ("notFound" in result && result.notFound) {
      res.status(404).json({ error: "Content not found" });
      return;
    }
    if ("forbidden" in result && result.forbidden) {
      res
        .status(403)
        .json({ error: "Only the content author or an admin can assign tags" });
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
      res
        .status(403)
        .json({ error: "Only the content author or an admin can remove tags" });
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

/**
 * @openapi
 * /api/v1/content/{id}/snapshots/diff:
 *   post:
 *     summary: Word-level diff between two content snapshots
 *     description: |
 *       Compares plain text derived from each snapshot's document at `toVersionNumber`
 *       (resolving through versions that omit `body`, e.g. state transitions).
 *       `left` / `right` match request body `snapshotAId` / `snapshotBId` order.
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
 *               - snapshotAId
 *               - snapshotBId
 *             properties:
 *               snapshotAId:
 *                 type: string
 *               snapshotBId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Structured word-level diff (segments with op equal|insert|delete)
 *       400:
 *         description: Invalid payload or snapshots not scoped to this content
 *       404:
 *         description: Content or snapshot not found
 *       500:
 *         description: Server error
 */
router.post("/:id/snapshots/diff", async (req: AuthRequest, res: Response) => {
  try {
    const { snapshotAId, snapshotBId } = req.body as {
      snapshotAId?: string;
      snapshotBId?: string;
    };
    if (!snapshotAId || !snapshotBId) {
      res
        .status(400)
        .json({ error: "snapshotAId and snapshotBId are required" });
      return;
    }

    const result = await contentService.compareSnapshotsWordDiff(
      req.params.id,
      snapshotAId,
      snapshotBId,
      {
        id: req.user!.id,
        isAdmin: req.user!.role === "ADMIN",
      },
    );

    if ("notFound" in result && result.notFound) {
      res.status(404).json({ error: "Content or snapshot not found" });
      return;
    }
    if ("badRequest" in result && result.badRequest) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
