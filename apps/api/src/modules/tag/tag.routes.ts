import { Router, Response } from "express";
import { authorize, type AuthRequest } from "../../middlewares/auth.middleware";
import { tagService } from "../../service";
import type { AuditContext } from "../../shared/context";
import { validatePayload } from "../../shared/validation";
import { AppError } from "../../shared/errors/appError";
import { createTagBodySchema } from "./tag.schema";

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
 * /api/v1/tags:
 *   post:
 *     summary: Create a new tag
 *     tags:
 *       - Tags
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               parentId:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Tag created
 *       400:
 *         description: Invalid payload
 *       409:
 *         description: Tag already exists
 *       500:
 *         description: Server error
 */
router.post("/", authorize("ADMIN"), async (req: AuthRequest, res: Response) => {
  try {
    const { name, parentId } = validatePayload(createTagBodySchema, req.body);
    const result = await tagService.create(auditContext(req), {
      name,
      parentId: parentId ?? null,
    });
    if (result.conflict) {
      res.status(409).json({ error: "Tag already exists", tag: result.tag });
      return;
    }
    res.status(201).json(result.tag);
  } catch (err) {
    if (err instanceof AppError) {
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
 * /api/v1/tags:
 *   get:
 *     summary: List all tags
 *     tags:
 *       - Tags
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of tags
 *       500:
 *         description: Server error
 */
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const tags = await tagService.list();
    res.status(200).json(tags);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/tags/{id}:
 *   get:
 *     summary: Get a tag by ID
 *     tags:
 *       - Tags
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
 *         description: Tag details
 *       404:
 *         description: Tag not found
 *       500:
 *         description: Server error
 */
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const tag = await tagService.getById(req.params.id);
    if (!tag) {
      res.status(404).json({ error: "Tag not found" });
      return;
    }
    res.status(200).json(tag);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/tags/{id}:
 *   delete:
 *     summary: Delete a tag
 *     tags:
 *       - Tags
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
 *         description: Tag deleted
 *       500:
 *         description: Server error
 */
router.delete("/:id", authorize("ADMIN"), async (req: AuthRequest, res: Response) => {
  try {
    await tagService.delete(auditContext(req), req.params.id);
    res.status(200).json({ message: "Tag deleted" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
