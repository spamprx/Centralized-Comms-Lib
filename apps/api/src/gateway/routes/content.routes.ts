import { Router, Response } from "express";
import { getPrismaClient, PrismaUnitOfWork } from "../../repository";
import type { LifecycleState, Visibility } from "../../repository";
import type { AuthRequest } from "../middleware/auth.middleware";

const router = Router();

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    + "-" + Date.now().toString(36);
}

router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const { title, aiGenerated } = req.body;
    const authorId = req.user!.id;

    if (!title) {
      res.status(400).json({ error: "title is required" });
      return;
    }

    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);

    const result = await uow.withTransaction(async (repos) => {
      const slug = slugify(title);
      const content = await repos.content.createDraft({
        title,
        slug,
        authorId,
        aiGenerated: aiGenerated ?? false,
      });

      const version = await repos.content.createVersion({
        contentId: content.id,
        authorId,
        changeType: aiGenerated ? "AI_GENERATED" : "MANUAL_SAVE",
        title,
      });

      await repos.audit.append({
        action: "CREATE",
        resource: "CONTENT",
        resourceId: content.id,
        newValue: { title, slug, lifecycleState: "DRAFT" },
        actorId: authorId,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      return { content, version };
    });

    res.status(201).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const repos = uow.repos();

    const filters = {
      authorId: req.query.authorId as string | undefined,
      lifecycleState: req.query.lifecycleState as LifecycleState | undefined,
      visibility: req.query.visibility as Visibility | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    };

    const contents = await repos.content.list(filters);
    res.status(200).json(contents);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const repos = uow.repos();

    const content = await repos.content.getById(req.params.id);
    if (!content) {
      res.status(404).json({ error: "Content not found" });
      return;
    }

    const tags = await repos.tag.listForContent(content.id);
    const versions = await repos.content.listVersions(content.id);

    res.status(200).json({ ...content, tags, versions });
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

    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);

    const result = await uow.withTransaction(async (repos) => {
      const existing = await repos.content.getById(req.params.id);
      if (!existing) return null;

      const updated = await repos.content.updateTitle(req.params.id, title);

      await repos.content.createVersion({
        contentId: updated.id,
        authorId: req.user!.id,
        changeType: "MANUAL_SAVE",
        title,
      });

      await repos.audit.append({
        action: "UPDATE",
        resource: "CONTENT",
        resourceId: updated.id,
        oldValue: { title: existing.title },
        newValue: { title },
        actorId: req.user!.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      return updated;
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

const VALID_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  DRAFT: ["IN_REVIEW", "ARCHIVED"],
  IN_REVIEW: ["DRAFT", "PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["ARCHIVED", "IN_REVIEW"],
  ARCHIVED: ["DRAFT"],
};

router.patch("/:id/state", async (req: AuthRequest, res: Response) => {
  try {
    const { lifecycleState } = req.body;
    if (!lifecycleState) {
      res.status(400).json({ error: "lifecycleState is required" });
      return;
    }

    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);

    const result = await uow.withTransaction(async (repos) => {
      const existing = await repos.content.getById(req.params.id);
      if (!existing) return { notFound: true } as const;

      const allowed = VALID_TRANSITIONS[existing.lifecycleState] ?? [];
      if (!allowed.includes(lifecycleState)) {
        return {
          notFound: false,
          invalidTransition: true,
          current: existing.lifecycleState,
        } as const;
      }

      const updated = await repos.content.updateLifecycleState(req.params.id, lifecycleState);

      await repos.content.createVersion({
        contentId: updated.id,
        authorId: req.user!.id,
        changeType: "STATE_TRANSITION",
        title: updated.title,
        metadataSnapshot: { from: existing.lifecycleState, to: lifecycleState },
      });

      await repos.audit.append({
        action: "STATE_TRANSITION",
        resource: "CONTENT",
        resourceId: updated.id,
        oldValue: { lifecycleState: existing.lifecycleState },
        newValue: { lifecycleState },
        actorId: req.user!.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      await repos.outbox.add({
        aggregateType: "CONTENT",
        aggregateId: updated.id,
        eventType: `CONTENT.${lifecycleState}`,
        payload: { contentId: updated.id, from: existing.lifecycleState, to: lifecycleState },
      });

      return { notFound: false, invalidTransition: false, content: updated } as const;
    });

    if (result.notFound) {
      res.status(404).json({ error: "Content not found" });
      return;
    }
    if (result.invalidTransition) {
      res.status(422).json({
        error: `Invalid state transition from ${result.current} to ${lifecycleState}`,
      });
      return;
    }

    res.status(200).json(result.content);
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

    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);

    const result = await uow.withTransaction(async (repos) => {
      const existing = await repos.content.getById(req.params.id);
      if (!existing) return null;

      const updated = await repos.content.updateVisibility(req.params.id, visibility);

      if (visibility === "PRIVATE_TO_GROUP" && visibilityGroupId) {
        await repos.content.bindVisibilityGroup(req.params.id, visibilityGroupId);
      } else if (visibility !== "PRIVATE_TO_GROUP") {
        await repos.content.bindVisibilityGroup(req.params.id, null);
      }

      await repos.audit.append({
        action: "VISIBILITY_CHANGE",
        resource: "CONTENT",
        resourceId: updated.id,
        oldValue: { visibility: existing.visibility },
        newValue: { visibility, visibilityGroupId: visibilityGroupId ?? null },
        actorId: req.user!.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      return updated;
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

router.post("/:id/tags", async (req: AuthRequest, res: Response) => {
  try {
    const { tagId } = req.body;
    if (!tagId) {
      res.status(400).json({ error: "tagId is required" });
      return;
    }

    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);

    await uow.withTransaction(async (repos) => {
      await repos.tag.assignToContent(req.params.id, tagId);

      await repos.audit.append({
        action: "TAG_ASSIGN",
        resource: "CONTENT",
        resourceId: req.params.id,
        newValue: { tagId },
        actorId: req.user!.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
    });

    res.status(200).json({ message: "Tag assigned" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.delete("/:id/tags/:tagId", async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);

    await uow.withTransaction(async (repos) => {
      await repos.tag.removeFromContent(req.params.id, req.params.tagId);

      await repos.audit.append({
        action: "TAG_REMOVE",
        resource: "CONTENT",
        resourceId: req.params.id,
        oldValue: { tagId: req.params.tagId },
        actorId: req.user!.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
    });

    res.status(200).json({ message: "Tag removed" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get("/:id/versions", async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const repos = uow.repos();

    const versions = await repos.content.listVersions(req.params.id);
    res.status(200).json(versions);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
