import { Router, Response } from "express";
import type { LifecycleState, Visibility } from "../../repository";
import type { AuthRequest } from "../../middlewares/auth.middleware";
import { aiDraftQuotaGate } from "../../middlewares/aiDraftQuotaGate.middleware";
import { contentService } from "../../service";
import { getPrismaClient } from "../../repository";
import type { AuditContext } from "../../shared/context";
import {
  editorPresenceStore,
  userMayJoinEditorPresence,
} from "../../realtime/editorPresenceStore";
import { broadcastToContentRoom } from "../../realtime/wsServer";
import { getCopyAttributionPolicy } from "./contentCopyAttribution";
import { validatePayload } from "../../shared/validation";
import { AppError } from "../../shared/errors/appError";
import { createContentDraftBodySchema } from "./content.schema";

const router = Router();

function isForbiddenResult(result: unknown): result is { forbidden: true } {
  return !!result && typeof result === "object" && "forbidden" in result;
}

const REACTION_EMOJIS = [
  "LIKE",
  "LOVE",
  "CLAP",
  "INSIGHTFUL",
  "LAUGH",
  "CELEBRATE",
] as const;

type ReactionEmoji = (typeof REACTION_EMOJIS)[number];
const READING_PROGRESS_STATUSES = ["NOT_STARTED", "READING", "DONE"] as const;
type ReadingProgressStatus = (typeof READING_PROGRESS_STATUSES)[number];
const READING_PROGRESS_THROTTLE_MS = 5000;
const progressThrottleByUserContent = new Map<string, number>();

function clampPercent(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function isReadingProgressStatus(
  value: unknown,
): value is ReadingProgressStatus {
  return (
    typeof value === "string" &&
    READING_PROGRESS_STATUSES.includes(value as ReadingProgressStatus)
  );
}

function autoStatusFromPercent(percent: number): ReadingProgressStatus {
  if (percent >= 100) return "DONE";
  if (percent <= 0) return "NOT_STARTED";
  return "READING";
}

function mergeReadingProgress(params: {
  existing: { percent: number; status: ReadingProgressStatus } | null;
  incomingPercent: number | null;
  incomingStatus: ReadingProgressStatus | null;
}): { percent: number; status: ReadingProgressStatus } {
  const existingPercent = params.existing?.percent ?? 0;
  const existingStatus = params.existing?.status ?? "NOT_STARTED";

  // Manual status overrides are authoritative and can intentionally reset progress.
  if (params.incomingStatus) {
    if (params.incomingStatus === "DONE") {
      return { percent: 100, status: "DONE" };
    }
    if (params.incomingStatus === "NOT_STARTED") {
      return { percent: 0, status: "NOT_STARTED" };
    }
    const mergedPercent = Math.max(
      1,
      params.incomingPercent ?? existingPercent ?? 1,
    );
    return { percent: Math.min(99, mergedPercent), status: "READING" };
  }

  // Scroll updates never regress progress and never demote DONE.
  const nextPercent = Math.max(existingPercent, params.incomingPercent ?? 0);
  if (existingStatus === "DONE") {
    return { percent: 100, status: "DONE" };
  }
  return { percent: nextPercent, status: autoStatusFromPercent(nextPercent) };
}

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

async function notifyBookmarkedUsersOnContentUpdate(params: {
  actorId: string;
  contentId: string;
  title?: string | null;
  type: "BODY_UPDATED" | "PUBLISHED";
}): Promise<void> {
  const prisma = getPrismaClient();
  const bookmarks = await prisma.contentBookmark.findMany({
    where: { contentId: params.contentId, userId: { not: params.actorId } },
    select: { userId: true },
    take: 500,
  });
  if (!bookmarks.length) return;
  const title = params.title?.trim() || "Untitled";
  const message =
    params.type === "PUBLISHED"
      ? `\"${title}\" was published.`
      : `\"${title}\" has meaningful updates.`;
  await prisma.contentBookmarkNotification.createMany({
    data: bookmarks.map((b) => ({
      userId: b.userId,
      contentId: params.contentId,
      type: params.type,
      message,
    })),
  });
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
    if ("selfInvite" in result && result.selfInvite) {
      res.status(400).json({ error: "You cannot add yourself as a co-author" });
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
 * /api/v1/content/{id}/co-authors/by-email:
 *   post:
 *     summary: Request a co-author by email
 *     description: Only the main author. Resolves email to a user and creates a pending co-author request.
 *     tags:
 *       - Content
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/:id/co-authors/by-email",
  async (req: AuthRequest, res: Response) => {
    try {
      const { email } = req.body as { email?: string };
      if (!email || typeof email !== "string") {
        res.status(400).json({ error: "email is required" });
        return;
      }

      const result = await contentService.requestCoAuthorByEmail(
        auditContext(req),
        req.params.id,
        email,
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
      if ("inviteeNotFound" in result && result.inviteeNotFound) {
        res.status(404).json({ error: "No user found with that email" });
        return;
      }
      if ("selfInvite" in result && result.selfInvite) {
        res
          .status(400)
          .json({ error: "You cannot add yourself as a co-author" });
        return;
      }
      if ("alreadyCoAuthor" in result && result.alreadyCoAuthor) {
        res.status(409).json({ error: "User is already a co-author" });
        return;
      }
      if ("alreadyPending" in result && result.alreadyPending) {
        res
          .status(409)
          .json({ error: "A co-author request is already pending" });
        return;
      }

      res.status(201).json({ message: "Co-author request created" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

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
    const parsed = validatePayload(createContentDraftBodySchema, req.body);
    const result = await contentService.createDraft(auditContext(req), {
      title: parsed.title,
      body: parsed.body ?? undefined,
      aiGenerated: parsed.aiGenerated,
      templateId: parsed.templateId ?? undefined,
      channelId: parsed.channelId ?? undefined,
      contentType: parsed.contentType,
    });
    if ("invalidFormatting" in result && result.invalidFormatting) {
      res.status(422).json({
        error: "Formatting rule violations",
        violations: result.violations,
      });
      return;
    }
    if ("invalidChannelBinding" in result && result.invalidChannelBinding) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof AppError && err.statusCode < 500) {
      res.status(err.statusCode).json({
        error: err.message,
        ...(err.code ? { code: err.code } : {}),
        ...(err.details !== undefined ? { details: err.details } : {}),
      });
      return;
    }
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
 *       - in: query
 *         name: omitChannelBound
 *         description: When true, only content with no channelId. Non-admin global lists force this.
 *         schema:
 *           type: boolean
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
    const omitChannelBoundQuery =
      req.query.omitChannelBound === "true" || req.query.omitChannelBound === "1";
    // Public browse list (non-admin, not scoped to own authorId): only unchannelled published rows.
    const omitChannelBound =
      omitChannelBoundQuery || (!isAdmin && !isOwnListRequest);
    const filters = {
      authorId: requestedAuthorId,
      // Security: non-admins can only list non-published content for themselves.
      lifecycleState:
        isAdmin || isOwnListRequest
          ? (req.query.lifecycleState as LifecycleState | undefined)
          : ("PUBLISHED" as LifecycleState),
      visibility: req.query.visibility as Visibility | undefined,
      contentType: req.query.contentType as any,
      omitChannelBound,
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
 * Pending co-author invitations for the signed-in user (approve via POST …/co-authors/respond).
 */
router.get(
  "/co-author-invitations/pending",
  async (req: AuthRequest, res: Response) => {
    try {
      const items = await contentService.listPendingCoAuthorInvitations(
        req.user!.id,
      );
      res.status(200).json(items);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

/**
 * Primary-author and accepted co-author items for the current user (My Content workspace).
 */
router.get("/workspace", async (req: AuthRequest, res: Response) => {
  try {
    const items = await contentService.listWorkspace({
      id: req.user!.id,
      isAdmin: req.user!.role === "ADMIN",
    });
    res.status(200).json(items);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// Presence is now handled via WebSockets (Phase 1: in-memory TTL sessions).
// Keep these endpoints for backwards compatibility, but indicate the new mechanism.
router.post(
  "/:id/presence/heartbeat",
  async (_req: AuthRequest, res: Response) => {
    res
      .status(410)
      .json({ error: "Presence heartbeat moved to WebSockets (/ws)" });
  },
);
router.get("/:id/presence", async (_req: AuthRequest, res: Response) => {
  res.status(410).json({ error: "Presence listing moved to WebSockets (/ws)" });
});

/** True when another user has the editor open (recent heartbeat). Used for version-restore gating. */
router.get(
  "/:id/collaboration/active",
  async (req: AuthRequest, res: Response) => {
    try {
      const contentId = req.params.id;
      const exists = await getPrismaClient().content.findUnique({
        where: { id: contentId },
        select: { id: true },
      });
      if (!exists) {
        res.status(404).json({ error: "Content not found" });
        return;
      }
      const isAdmin = req.user!.role === "ADMIN";
      const allowed = await userMayJoinEditorPresence(
        contentId,
        req.user!.id,
        isAdmin,
      );
      if (!allowed) {
        res.status(403).json({
          error:
            "Only the primary author, an accepted co-author, or an admin can view collaboration status",
        });
        return;
      }
      res.status(200).json({
        active: editorPresenceStore.isCollaborationActive(
          contentId,
          req.user!.id,
        ),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

/**
 * Ask active editors to leave so the author can restore.
 * Best-effort: broadcasts a websocket notice to the content room.
 */
router.post("/:id/restore-request", async (req: AuthRequest, res: Response) => {
  try {
    const contentId = req.params.id;
    const prisma = getPrismaClient();
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      select: { id: true, authorId: true },
    });
    if (!content) {
      res.status(404).json({ error: "Content not found" });
      return;
    }
    const isAdmin = req.user!.role === "ADMIN";
    if (!isAdmin && content.authorId !== req.user!.id) {
      res.status(403).json({
        error: "Only the primary author or an admin can request a restore",
      });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, displayName: true },
    });
    if (!user) {
      res.status(401).json({ error: "User not found for token" });
      return;
    }
    broadcastToContentRoom(contentId, {
      type: "presence:restore_requested",
      contentId,
      requestedBy: {
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
      },
    });
    res.status(202).json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * Restore a previous version as the new head revision.
 * Blocked (409) while another editor is active in the presence session.
 */
router.post(
  "/:id/versions/:versionId/restore",
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma = getPrismaClient();
      const contentId = req.params.id;
      const versionId = req.params.versionId;
      const baseNRaw = (req.body as { baseVersionNumber?: unknown } | undefined)
        ?.baseVersionNumber;
      const baseN =
        baseNRaw === undefined || baseNRaw === null
          ? undefined
          : Number(baseNRaw);
      if (
        baseN !== undefined &&
        (typeof baseN !== "number" || !Number.isInteger(baseN) || baseN < 0)
      ) {
        res
          .status(400)
          .json({ error: "baseVersionNumber must be a non-negative integer" });
        return;
      }

      const content = await prisma.content.findUnique({
        where: { id: contentId },
        select: { id: true, authorId: true, title: true, lifecycleState: true },
      });
      if (!content) {
        res.status(404).json({ error: "Content not found" });
        return;
      }
      const isAdmin = req.user!.role === "ADMIN";
      const isAuthor = content.authorId === req.user!.id;
      if (!isAdmin && !isAuthor) {
        res.status(403).json({
          error: "Only the primary author or an admin can restore versions",
        });
        return;
      }

      // Presence guard: block if any *other* user is in the editor session.
      if (editorPresenceStore.isCollaborationActive(contentId, req.user!.id)) {
        res.status(409).json({
          error:
            "Cannot restore while other co-authors are in the editor session. Ask them to leave, then retry.",
        });
        return;
      }

      if (baseN !== undefined) {
        const latest = await prisma.contentVersion.findFirst({
          where: { contentId },
          orderBy: { versionNumber: "desc" },
          select: { versionNumber: true },
        });
        const headNum = latest?.versionNumber ?? 0;
        if (headNum !== baseN) {
          res.status(409).json({
            error:
              "Head revision changed. Refresh history, then retry restore from the latest version.",
            currentVersionNumber: headNum,
          });
          return;
        }
      }

      const source = await prisma.contentVersion.findUnique({
        where: { id: versionId },
        select: { id: true, contentId: true, title: true, body: true },
      });
      if (!source || source.contentId !== contentId) {
        res.status(404).json({ error: "Version not found for this content" });
        return;
      }

      // Restore by creating a new MANUAL_SAVE version with the old body.
      const latest = await prisma.contentVersion.findFirst({
        where: { contentId },
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
      });
      const nextVersionNumber = (latest?.versionNumber ?? 0) + 1;
      const created = await prisma.contentVersion.create({
        data: {
          contentId,
          authorId: req.user!.id,
          changeType: "MANUAL_SAVE",
          title: String(source.title ?? content.title ?? "Untitled"),
          body: source.body as any,
          metadataSnapshot: { restoredFromVersionId: versionId } as any,
          versionNumber: nextVersionNumber,
        },
      });
      res.status(200).json({
        id: created.id,
        versionNumber: created.versionNumber,
        title: created.title,
        changeType: created.changeType,
        body: created.body,
        metadataSnapshot: created.metadataSnapshot,
        createdAt: created.createdAt,
        contentId: created.contentId,
        authorId: created.authorId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

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
 *       403:
 *         description: Forbidden for audience due to lifecycle/visibility
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
    if (isForbiddenResult(result)) {
      res.status(403).json({
        error:
          "Forbidden: this content is not accessible for your role or visibility group",
      });
      return;
    }
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
 * Copy-with-attribution policy for the reader UI.
 * Audience clients call this before writing clipboard text.
 */
router.get("/:id/copy-policy", async (req: AuthRequest, res: Response) => {
  try {
    const result = await contentService.getById(req.params.id, {
      id: req.user!.id,
      isAdmin: req.user!.role === "ADMIN",
    });
    if (isForbiddenResult(result)) {
      res.status(403).json({
        error:
          "Forbidden: this content is not accessible for your role or visibility group",
      });
      return;
    }
    if (!result) {
      res.status(404).json({ error: "Content not found" });
      return;
    }
    const policy = getCopyAttributionPolicy({
      contentId: result.content.id,
      title: result.content.title ?? "Untitled",
      slug: result.content.slug ?? "",
      authorName:
        result.content.author?.displayName ||
        result.content.author?.email ||
        "Unknown author",
    });
    res.status(200).json(policy);
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
 *               baseVersionNumber:
 *                 type: integer
 *                 description: Expected latest revision number for optimistic concurrency (omit to skip check)
 *     responses:
 *       200:
 *         description: Updated content version
 *       400:
 *         description: Invalid payload
 *       403:
 *         description: Forbidden – not primary author, co-author, or admin
 *       409:
 *         description: baseVersionNumber stale — another save created a newer revision
 *       404:
 *         description: Content not found
 *       422:
 *         description: Invalid state for editing or template formatting violations
 *       500:
 *         description: Server error
 */
router.post("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const {
      body,
      title,
      contentType,
      baseVersionNumber,
      templateId,
      channelId,
    } = req.body;
    if (body !== undefined && body !== null && !isValidTipTapDocument(body)) {
      res.status(400).json({
        error:
          "body must be a valid TipTap document (type: 'doc', content: array)",
      });
      return;
    }
    const baseN =
      baseVersionNumber === undefined || baseVersionNumber === null
        ? undefined
        : Number(baseVersionNumber);
    if (
      baseN !== undefined &&
      (typeof baseN !== "number" || !Number.isInteger(baseN) || baseN < 0)
    ) {
      res
        .status(400)
        .json({ error: "baseVersionNumber must be a non-negative integer" });
      return;
    }
    const result = await contentService.saveBody(
      auditContext(req),
      req.params.id,
      {
        body: body ?? undefined,
        title,
        contentType: contentType ?? undefined,
        baseVersionNumber: baseN,
        templateId: typeof templateId === "string" ? templateId : undefined,
        channelId: typeof channelId === "string" ? channelId : undefined,
      },
    );
    if ("notFound" in result && result.notFound) {
      res.status(404).json({ error: "Content not found" });
      return;
    }
    if ("forbidden" in result && result.forbidden) {
      res.status(403).json({
        error:
          "Only the primary author, an accepted co-author, or an admin can edit this content",
      });
      return;
    }
    if ("conflict" in result && result.conflict) {
      res.status(409).json({
        error:
          "A newer revision exists. Reload the document and re-apply your changes, or save from the latest version.",
        currentVersionNumber: result.currentVersionNumber,
      });
      return;
    }
    if ("invalidState" in result && result.invalidState) {
      res.status(422).json({
        error: `Cannot save body when content is ${result.state}. Only DRAFT or IN_REVIEW can be edited.`,
      });
      return;
    }
    if ("invalidFormatting" in result && result.invalidFormatting) {
      res.status(422).json({
        error: "Formatting rule violations",
        violations: result.violations,
      });
      return;
    }
    if ("invalidChannelBinding" in result && result.invalidChannelBinding) {
      res.status(400).json({ error: result.error });
      return;
    }
    if ("version" in result) {
      void notifyBookmarkedUsersOnContentUpdate({
        actorId: req.user!.id,
        contentId: req.params.id,
        title: result.version.title,
        type: "BODY_UPDATED",
      }).catch(() => undefined);
      res.status(200).json(result.version);
    }
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
      const body = req.body as {
        lifecycleState?: unknown;
        bypassReviewQuorumForChannelPublish?: unknown;
      };
      const raw = body?.lifecycleState;
      const lifecycleState =
        typeof raw === "string"
          ? (raw.toUpperCase() as LifecycleState)
          : (raw as LifecycleState);
      if (!lifecycleState) {
        res.status(400).json({ error: "lifecycleState is required" });
        return;
      }
      const bypassReviewQuorumForChannelPublish =
        body?.bypassReviewQuorumForChannelPublish === true;
      const result = await contentService.transitionState(
        auditContext(req),
        req.params.id,
        lifecycleState,
        { bypassReviewQuorumForChannelPublish },
      );
      if ("notFound" in result && result.notFound) {
        res.status(404).json({ error: "Content not found" });
        return;
      }
      if ("forbidden" in result && result.forbidden) {
        res.status(403).json({
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
      if ("unfilledPlaceholders" in result && result.unfilledPlaceholders) {
        res.status(422).json({
          error: `Replace merge tokens with actual values before changing lifecycle state (${result.keys.join(", ")}).`,
          code: "UNFILLED_PLACEHOLDERS",
          keys: result.keys,
        });
        return;
      }
      if ("policyViolation" in result && result.policyViolation) {
        res.status(409).json({
          error: result.error,
          code: result.code,
          requiredQuorum: result.requiredQuorum,
        });
        return;
      }
      if ("content" in result) {
        if (result.content.lifecycleState === "PUBLISHED") {
          void notifyBookmarkedUsersOnContentUpdate({
            actorId: req.user!.id,
            contentId: result.content.id,
            title: result.content.title,
            type: "PUBLISHED",
          }).catch(() => undefined);
        }
        res.status(200).json(result.content);
      }
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
    if (!detail || isForbiddenResult(detail)) {
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
    if (!detail || isForbiddenResult(detail)) {
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
    if (!detail || isForbiddenResult(detail)) {
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
    if (!detail || isForbiddenResult(detail)) {
      res.status(404).json({ error: "Content not found" });
      return;
    }
    const prisma = getPrismaClient();
    const folderIdRaw = (req.body as { folderId?: unknown })?.folderId;
    const folderId =
      typeof folderIdRaw === "string" && folderIdRaw.trim()
        ? folderIdRaw.trim()
        : null;
    if (folderId) {
      const folder = await prisma.bookmarkFolder.findFirst({
        where: { id: folderId, userId: req.user!.id },
        select: { id: true },
      });
      if (!folder) {
        res.status(404).json({ error: "Bookmark folder not found" });
        return;
      }
    }
    await prisma.contentBookmark.upsert({
      where: {
        contentId_userId: { contentId: req.params.id, userId: req.user!.id },
      },
      create: { contentId: req.params.id, userId: req.user!.id, folderId },
      update: { folderId },
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
    if (!detail || isForbiddenResult(detail)) {
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
    if (!detail || isForbiddenResult(detail)) {
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
 * /api/v1/content/{id}/progress:
 *   get:
 *     summary: Get reading progress for current user
 *     tags:
 *       - Content
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current reading progress
 *       404:
 *         description: Content not found
 *   patch:
 *     summary: Upsert reading progress (debounced client updates + manual override)
 *     description: Server applies authoritative merge rules and throttles rapid updates per user/content.
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
 *             properties:
 *               percent:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *               status:
 *                 type: string
 *                 enum: [NOT_STARTED, READING, DONE]
 *     responses:
 *       200:
 *         description: Updated (or current throttled) reading progress
 *       400:
 *         description: Invalid payload
 *       404:
 *         description: Content not found
 */
router.get("/:id/progress", async (req: AuthRequest, res: Response) => {
  try {
    const detail = await contentService.getById(req.params.id, {
      id: req.user!.id,
      isAdmin: req.user!.role === "ADMIN",
    });
    if (!detail || isForbiddenResult(detail)) {
      res.status(404).json({ error: "Content not found" });
      return;
    }

    const prisma = getPrismaClient();
    const row = await prisma.contentReadingProgress.findUnique({
      where: {
        userId_contentId: { userId: req.user!.id, contentId: req.params.id },
      },
      select: { percent: true, status: true, updatedAt: true },
    });

    res.status(200).json({
      percent: row?.percent ?? 0,
      status: (row?.status ?? "NOT_STARTED") as ReadingProgressStatus,
      updatedAt: row?.updatedAt ?? null,
      throttled: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.patch("/:id/progress", async (req: AuthRequest, res: Response) => {
  try {
    const detail = await contentService.getById(req.params.id, {
      id: req.user!.id,
      isAdmin: req.user!.role === "ADMIN",
    });
    if (!detail || isForbiddenResult(detail)) {
      res.status(404).json({ error: "Content not found" });
      return;
    }

    const incomingPercent = clampPercent((req.body as { percent?: unknown }).percent);
    const rawStatus = (req.body as { status?: unknown }).status;
    const incomingStatus = rawStatus == null ? null : rawStatus;
    const hasPercent = "percent" in (req.body ?? {});
    const hasStatus = "status" in (req.body ?? {});
    if (!hasPercent && !hasStatus) {
      res.status(400).json({ error: "At least one of percent or status is required" });
      return;
    }
    if (hasPercent && incomingPercent === null) {
      res.status(400).json({ error: "percent must be a finite number between 0 and 100" });
      return;
    }
    if (hasStatus && !isReadingProgressStatus(incomingStatus)) {
      res.status(400).json({
        error: `status must be one of: ${READING_PROGRESS_STATUSES.join(", ")}`,
      });
      return;
    }

    const throttleKey = `${req.user!.id}:${req.params.id}`;
    const now = Date.now();
    const lastAt = progressThrottleByUserContent.get(throttleKey) ?? 0;
    const prisma = getPrismaClient();
    if (now - lastAt < READING_PROGRESS_THROTTLE_MS) {
      const current = await prisma.contentReadingProgress.findUnique({
        where: {
          userId_contentId: { userId: req.user!.id, contentId: req.params.id },
        },
        select: { percent: true, status: true, updatedAt: true },
      });
      res.status(200).json({
        percent: current?.percent ?? 0,
        status: (current?.status ?? "NOT_STARTED") as ReadingProgressStatus,
        updatedAt: current?.updatedAt ?? null,
        throttled: true,
      });
      return;
    }

    const existing = await prisma.contentReadingProgress.findUnique({
      where: {
        userId_contentId: { userId: req.user!.id, contentId: req.params.id },
      },
      select: { percent: true, status: true },
    });
    const merged = mergeReadingProgress({
      existing: existing
        ? {
            percent: existing.percent,
            status: existing.status as ReadingProgressStatus,
          }
        : null,
      incomingPercent,
      incomingStatus: (incomingStatus as ReadingProgressStatus | null) ?? null,
    });

    const upserted = await prisma.contentReadingProgress.upsert({
      where: {
        userId_contentId: { userId: req.user!.id, contentId: req.params.id },
      },
      create: {
        userId: req.user!.id,
        contentId: req.params.id,
        percent: merged.percent,
        status: merged.status,
      },
      update: {
        percent: merged.percent,
        status: merged.status,
      },
      select: { percent: true, status: true, updatedAt: true },
    });
    progressThrottleByUserContent.set(throttleKey, now);
    res.status(200).json({
      percent: upserted.percent,
      status: upserted.status,
      updatedAt: upserted.updatedAt,
      throttled: false,
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
    if (!detail || isForbiddenResult(detail)) {
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
    if (!detail || isForbiddenResult(detail)) {
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
    if (!detail || isForbiddenResult(detail)) {
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
 * /api/v1/content/{id}/reactions:
 *   get:
 *     summary: Get reaction aggregates and current user's reaction
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
 *         description: Reaction summary
 *       404:
 *         description: Content not found
 *   post:
 *     summary: Toggle or set a reaction emoji
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
 *               - emoji
 *             properties:
 *               emoji:
 *                 type: string
 *                 enum: [LIKE, LOVE, CLAP, INSIGHTFUL, LAUGH, CELEBRATE]
 *     responses:
 *       200:
 *         description: Updated reaction summary
 *       400:
 *         description: Invalid emoji
 *       404:
 *         description: Content not found
 */
router.get("/:id/reactions", async (req: AuthRequest, res: Response) => {
  try {
    const detail = await contentService.getById(req.params.id, {
      id: req.user!.id,
      isAdmin: req.user!.role === "ADMIN",
    });
    if (!detail || isForbiddenResult(detail)) {
      res.status(404).json({ error: "Content not found" });
      return;
    }

    const prisma = getPrismaClient();
    const [countsRows, mine] = await Promise.all([
      prisma.contentReaction.groupBy({
        by: ["emoji"],
        where: { contentId: req.params.id },
        _count: { _all: true },
      }),
      prisma.contentReaction.findUnique({
        where: {
          contentId_userId: { contentId: req.params.id, userId: req.user!.id },
        },
        select: { emoji: true },
      }),
    ]);

    const counts = REACTION_EMOJIS.map((emoji) => ({
      emoji,
      count: countsRows.find((r) => r.emoji === emoji)?._count._all ?? 0,
    }));
    res.status(200).json({
      counts,
      myReaction: mine?.emoji ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post("/:id/reactions", async (req: AuthRequest, res: Response) => {
  try {
    const rawEmoji = (req.body as { emoji?: unknown }).emoji;
    if (typeof rawEmoji !== "string") {
      res.status(400).json({ error: "emoji is required" });
      return;
    }
    const emoji = rawEmoji.toUpperCase() as ReactionEmoji;
    if (!REACTION_EMOJIS.includes(emoji)) {
      res.status(400).json({
        error: `emoji must be one of: ${REACTION_EMOJIS.join(", ")}`,
      });
      return;
    }

    const detail = await contentService.getById(req.params.id, {
      id: req.user!.id,
      isAdmin: req.user!.role === "ADMIN",
    });
    if (!detail || isForbiddenResult(detail)) {
      res.status(404).json({ error: "Content not found" });
      return;
    }

    const prisma = getPrismaClient();
    const existing = await prisma.contentReaction.findUnique({
      where: {
        contentId_userId: { contentId: req.params.id, userId: req.user!.id },
      },
      select: { emoji: true },
    });

    // Toggle behavior: same emoji removes reaction, different emoji updates it.
    if (existing?.emoji === emoji) {
      await prisma.contentReaction.deleteMany({
        where: { contentId: req.params.id, userId: req.user!.id },
      });
    } else {
      await prisma.contentReaction.upsert({
        where: {
          contentId_userId: { contentId: req.params.id, userId: req.user!.id },
        },
        create: { contentId: req.params.id, userId: req.user!.id, emoji },
        update: { emoji },
      });
    }

    const [countsRows, mine] = await Promise.all([
      prisma.contentReaction.groupBy({
        by: ["emoji"],
        where: { contentId: req.params.id },
        _count: { _all: true },
      }),
      prisma.contentReaction.findUnique({
        where: {
          contentId_userId: { contentId: req.params.id, userId: req.user!.id },
        },
        select: { emoji: true },
      }),
    ]);
    const counts = REACTION_EMOJIS.map((e) => ({
      emoji: e,
      count: countsRows.find((r) => r.emoji === e)?._count._all ?? 0,
    }));
    res.status(200).json({
      counts,
      myReaction: mine?.emoji ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/content/{id}/comments:
 *   get:
 *     summary: List threaded comments (max depth 2) for a content item
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
 *     summary: Add a comment or one-level reply (max depth 2)
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
 *               parentId:
 *                 type: string
 *                 nullable: true
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
    if (!detail || isForbiddenResult(detail)) {
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
      parentId: string | null;
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

    const normalized = rows.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      contentId: c.contentId,
      parentId: c.parentId,
      author: c.author,
    }));
    const byParent = new Map<string | null, typeof normalized>();
    for (const c of normalized) {
      const arr = byParent.get(c.parentId) ?? [];
      arr.push(c);
      byParent.set(c.parentId, arr);
    }
    const topLevel = (byParent.get(null) ?? []).map((p) => ({
      ...p,
      replies: (byParent.get(p.id) ?? []).map((r) => ({ ...r, replies: [] })),
    }));
    res.status(200).json(topLevel);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post("/:id/comments", async (req: AuthRequest, res: Response) => {
  try {
    const { body, parentId } = req.body as { body?: unknown; parentId?: unknown };
    if (typeof body !== "string" || body.trim() === "") {
      res.status(400).json({ error: "body is required" });
      return;
    }
    if (parentId !== undefined && parentId !== null && typeof parentId !== "string") {
      res.status(400).json({ error: "parentId must be a string when provided" });
      return;
    }

    const detail = await contentService.getById(req.params.id, {
      id: req.user!.id,
      isAdmin: req.user!.role === "ADMIN",
    });
    if (!detail || isForbiddenResult(detail)) {
      res.status(404).json({ error: "Content not found" });
      return;
    }

    const prisma = getPrismaClient();
    let parentRef: { id: string; parentId: string | null; contentId: string } | null = null;
    if (typeof parentId === "string" && parentId.trim() !== "") {
      parentRef = await prisma.contentComment.findUnique({
        where: { id: parentId },
        select: { id: true, parentId: true, contentId: true },
      });
      if (!parentRef || parentRef.contentId !== req.params.id) {
        res.status(400).json({ error: "parentId is not a comment for this content" });
        return;
      }
      // Enforce max depth 2: reply can only target top-level comments.
      if (parentRef.parentId !== null) {
        res.status(422).json({
          error: "Thread depth limit reached. Maximum allowed depth is 2.",
        });
        return;
      }
    }

    const created = await prisma.contentComment.create({
      data: {
        contentId: req.params.id,
        authorId: req.user!.id,
        body: body.trim(),
        parentId: parentRef?.id ?? null,
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
      parentId: created.parentId,
      author: created.author,
      replies: [],
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
      res.status(403).json({
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
    if ("badRequest" in result && result.badRequest) {
      res.status(400).json({ error: result.error });
      return;
    }
    if ("notFound" in result && result.notFound) {
      res.status(404).json({ error: "Content not found" });
      return;
    }
    if ("forbidden" in result && result.forbidden) {
      res.status(403).json({
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
    if (!result || isForbiddenResult(result)) {
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
