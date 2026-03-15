import { Router, Response } from "express";
import type { LifecycleState, Visibility } from "../../repository";
import type { AuthRequest } from "../middleware/auth.middleware";
import { contentService } from "../../service";
import type { AuditContext } from "../../service/context";

const router = Router();

function auditContext(req: AuthRequest): AuditContext {
  return {
    actorId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  };
}

function isValidTipTapDocument(obj: unknown): obj is Record<string, unknown> {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const doc = obj as Record<string, unknown>;
  return doc.type === "doc" && Array.isArray(doc.content);
}

router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const { title, body, aiGenerated } = req.body;
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
    });
    res.status(201).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const filters = {
      authorId: req.query.authorId as string | undefined,
      lifecycleState: req.query.lifecycleState as LifecycleState | undefined,
      visibility: req.query.visibility as Visibility | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    };
    const contents = await contentService.list(filters);
    res.status(200).json(contents);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const result = await contentService.getById(req.params.id);
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

router.patch("/:id/title", async (req: AuthRequest, res: Response) => {
  try {
    const { title } = req.body;
    if (!title) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    const result = await contentService.updateTitle(
      auditContext(req),
      req.params.id,
      title,
    );
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

router.patch("/:id/body", async (req: AuthRequest, res: Response) => {
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
    if ("version" in result) res.status(200).json(result.version);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.patch("/:id/state", async (req: AuthRequest, res: Response) => {
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

router.post("/:id/tags", async (req: AuthRequest, res: Response) => {
  try {
    const { tagId } = req.body;
    if (!tagId) {
      res.status(400).json({ error: "tagId is required" });
      return;
    }
    await contentService.assignTag(auditContext(req), req.params.id, tagId);
    res.status(200).json({ message: "Tag assigned" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.delete("/:id/tags/:tagId", async (req: AuthRequest, res: Response) => {
  try {
    await contentService.removeTag(
      auditContext(req),
      req.params.id,
      req.params.tagId,
    );
    res.status(200).json({ message: "Tag removed" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get("/:id/versions", async (req: AuthRequest, res: Response) => {
  try {
    const versions = await contentService.listVersions(req.params.id);
    res.status(200).json(versions);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
