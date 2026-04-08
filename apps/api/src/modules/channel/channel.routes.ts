import { Router, Response } from "express";

import type { AuthRequest } from "../../middlewares/auth.middleware";
import { channelService } from "../../service";
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

/**
 * @openapi
 * /api/v1/channels:
 *   get:
 *     summary: List delivery channels
 *     tags:
 *       - Channels
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Channel list
 */
router.get("/", async (_req: AuthRequest, res: Response) => {
  try {
    const channels = await channelService.list();
    res.status(200).json(channels);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/channels:
 *   post:
 *     summary: Create a channel
 *     tags:
 *       - Channels
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
 *               key:
 *                 type: string
 *                 description: Stable identifier (slug). Defaults from name if omitted.
 *               description:
 *                 type: string
 *                 nullable: true
 */
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const { name, key, description } = req.body as {
      name?: string;
      key?: string;
      description?: string | null;
    };
    const result = await channelService.create(auditContext(req), {
      name: name ?? "",
      key,
      description,
    });
    if (result.conflict) {
      res.status(409).json({ error: "Channel key already exists", channel: result.channel });
      return;
    }
    res.status(201).json(result.channel);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("required") || message.includes("valid")) {
      res.status(400).json({ error: message });
      return;
    }
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/channels/{id}:
 *   get:
 *     summary: Get channel by id
 *     tags:
 *       - Channels
 *     security:
 *       - bearerAuth: []
 */
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const ch = await channelService.getById(req.params.id);
    if (!ch) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }
    res.status(200).json(ch);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
