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

router.get("/push-recipients", async (_req: AuthRequest, res: Response) => {
  try {
    const items = await profileService.listPushRecipientCandidates();
    res.status(200).json({ items });
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

router.post("/me/fcm-token", async (req: AuthRequest, res: Response) => {
  try {
    const { token, deviceId } = req.body as {
      token?: unknown;
      deviceId?: unknown;
    };
    if (typeof token !== "string" || typeof deviceId !== "string") {
      res.status(400).json({ error: "token and deviceId are required strings" });
      return;
    }
    const saved = await profileService.saveDeviceFcmToken(req.user!.id, {
      token,
      deviceId,
      userAgent: req.get("user-agent") ?? null,
    });
    res.status(200).json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith("Invalid FCM token")) {
      res.status(400).json({ error: message });
      return;
    }
    res.status(500).json({ error: message });
  }
});

router.delete("/me/fcm-token/:deviceId", async (req: AuthRequest, res: Response) => {
  try {
    const out = await profileService.deleteDeviceFcmToken(req.user!.id, req.params.deviceId);
    if (!out.deleted) {
      res.status(404).json({ error: "Device token not found" });
      return;
    }
    res.status(204).end();
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
    const folderIdRaw =
      typeof req.query.folderId === "string" ? req.query.folderId : undefined;
    const folderId =
      folderIdRaw === "default" ? null : folderIdRaw ? folderIdRaw : undefined;
    const items = await profileService.listBookmarks(req.user!.id, q, folderId);
    res.status(200).json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get("/bookmarks/folders", async (req: AuthRequest, res: Response) => {
  try {
    const items = await profileService.listBookmarkFolders(req.user!.id);
    res.status(200).json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post("/bookmarks/folders", async (req: AuthRequest, res: Response) => {
  try {
    const name = (req.body as { name?: unknown })?.name;
    if (typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const folder = await profileService.createBookmarkFolder(req.user!.id, name);
    res.status(201).json(folder);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.patch(
  "/bookmarks/folders/:folderId",
  async (req: AuthRequest, res: Response) => {
    try {
      const name = (req.body as { name?: unknown })?.name;
      if (typeof name !== "string" || !name.trim()) {
        res.status(400).json({ error: "name is required" });
        return;
      }
      const folder = await profileService.renameBookmarkFolder(
        req.user!.id,
        req.params.folderId,
        name,
      );
      if (!folder) {
        res.status(404).json({ error: "Folder not found" });
        return;
      }
      res.status(200).json(folder);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

router.delete(
  "/bookmarks/folders/:folderId",
  async (req: AuthRequest, res: Response) => {
    try {
      const ok = await profileService.deleteBookmarkFolder(
        req.user!.id,
        req.params.folderId,
      );
      if (!ok) {
        res.status(404).json({ error: "Folder not found" });
        return;
      }
      res.status(204).end();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

router.patch("/bookmarks/:bookmarkId", async (req: AuthRequest, res: Response) => {
  try {
    const folderIdRaw = (req.body as { folderId?: unknown }).folderId;
    if (
      folderIdRaw !== null &&
      folderIdRaw !== undefined &&
      typeof folderIdRaw !== "string"
    ) {
      res.status(400).json({ error: "folderId must be a string or null" });
      return;
    }
    const moved = await profileService.moveBookmark(
      req.user!.id,
      req.params.bookmarkId,
      typeof folderIdRaw === "string" && folderIdRaw.trim()
        ? folderIdRaw.trim()
        : null,
    );
    if (!moved) {
      res.status(404).json({ error: "Bookmark or folder not found" });
      return;
    }
    res.status(200).json(moved);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get(
  "/bookmarks/notifications",
  async (req: AuthRequest, res: Response) => {
    try {
      const unreadOnly =
        String(req.query.unreadOnly ?? "").toLowerCase() === "true";
      const items = await profileService.listBookmarkNotifications(
        req.user!.id,
        unreadOnly,
      );
      res.status(200).json({ items });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

router.patch(
  "/bookmarks/notifications/:id/read",
  async (req: AuthRequest, res: Response) => {
    try {
      const ok = await profileService.markBookmarkNotificationRead(
        req.user!.id,
        req.params.id,
      );
      if (!ok) {
        res.status(404).json({ error: "Notification not found" });
        return;
      }
      res.status(204).end();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

router.post(
  "/bookmarks/notifications/read-all",
  async (req: AuthRequest, res: Response) => {
    try {
      const count = await profileService.markAllBookmarkNotificationsRead(
        req.user!.id,
      );
      res.status(200).json({ updated: count });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

router.get("/me/push-notifications", async (req: AuthRequest, res: Response) => {
  try {
    const unreadOnly = String(req.query.unreadOnly ?? "").toLowerCase() === "true";
    const items = await profileService.listPushNotifications(req.user!.id, unreadOnly);
    res.status(200).json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.patch("/me/push-notifications/:id/read", async (req: AuthRequest, res: Response) => {
  try {
    const ok = await profileService.markPushNotificationRead(req.user!.id, req.params.id);
    if (!ok) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }
    res.status(204).end();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post("/me/push-notifications/read-all", async (req: AuthRequest, res: Response) => {
  try {
    const updated = await profileService.markAllPushNotificationsRead(req.user!.id);
    res.status(200).json({ updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
