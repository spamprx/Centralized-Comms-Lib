import { Router, Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware";
import { tagService } from "../../service";
import type { AuditContext } from "../../service/context";

const router = Router();

function auditContext(req: AuthRequest): AuditContext {
  return {
    actorId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  };
}

router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const { name, parentId } = req.body;
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
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
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const tags = await tagService.list();
    res.status(200).json(tags);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

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

router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    await tagService.delete(auditContext(req), req.params.id);
    res.status(200).json({ message: "Tag deleted" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
