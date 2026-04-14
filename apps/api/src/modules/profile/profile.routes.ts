import { Router, Response } from "express";
import type { AuthRequest } from "../../middlewares/auth.middleware";
import { profileService } from "./profile.service";

const router = Router();

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
