import { Router, Response } from "express";
import type { AuthRequest } from "../../middlewares/auth.middleware";
import { profileService } from "./profile.service";
import { emitAdminUserActivity } from "../../realtime/adminActivityHub";

const router = Router();

/**
 * Client heartbeat while the SPA is open. Updates `User.presencePingAt` and notifies admin SSE.
 */
router.post("/presence", async (req: AuthRequest, res: Response) => {
  try {
    const out = await profileService.recordPresencePing(req.user!.id);
    if (out) {
      emitAdminUserActivity({
        userId: req.user!.id,
        presencePingAt: out.presencePingAt,
      });
    }
    res.status(204).end();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/** Logout / leave app — clears `presencePingAt` so admin UI stops showing “Active now”. */
router.delete("/presence", async (req: AuthRequest, res: Response) => {
  try {
    await profileService.clearPresencePing(req.user!.id);
    emitAdminUserActivity({
      userId: req.user!.id,
      clearPresencePing: true,
    });
    res.status(204).end();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get("/me", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const data = await profileService.getMe(userId);
    if (!data) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.status(200).json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.patch("/me", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { displayName, email } = req.body as {
      displayName?: unknown;
      email?: unknown;
    };
    if (displayName !== undefined && typeof displayName !== "string") {
      res.status(400).json({ error: "displayName must be a string" });
      return;
    }
    if (email !== undefined && typeof email !== "string") {
      res.status(400).json({ error: "email must be a string" });
      return;
    }
    const updated = await profileService.updateMe(userId, {
      displayName,
      email,
    });
    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.status(200).json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get("/me/activity", async (req: AuthRequest, res: Response) => {
  try {
    const items = await profileService.listActivity(req.user!.id);
    res.status(200).json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get("/me/bookmarks", async (req: AuthRequest, res: Response) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const items = await profileService.listBookmarks(req.user!.id, q);
    res.status(200).json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
