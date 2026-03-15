import { Router, Response } from "express";
import { getPrismaClient, PrismaUnitOfWork } from "../../repository";
import type { AuthRequest } from "../middleware/auth.middleware";

const router = Router();

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const { name, parentId } = req.body;
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);

    const result = await uow.withTransaction(async (repos) => {
      const existing = await repos.tag.getByName(name);
      if (existing) return { conflict: true, tag: existing } as const;

      const slug = slugify(name);
      const tag = await repos.tag.create({ name, slug, parentId: parentId ?? null });

      await repos.audit.append({
        action: "CREATE",
        resource: "TAG",
        resourceId: tag.id,
        newValue: { name, slug, parentId: parentId ?? null },
        actorId: req.user!.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      return { conflict: false, tag } as const;
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
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const repos = uow.repos();

    const tags = await repos.tag.list();
    res.status(200).json(tags);
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

    const tag = await repos.tag.getById(req.params.id);
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
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);

    await uow.withTransaction(async (repos) => {
      await repos.tag.delete(req.params.id);

      await repos.audit.append({
        action: "DELETE",
        resource: "TAG",
        resourceId: req.params.id,
        actorId: req.user!.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
    });

    res.status(200).json({ message: "Tag deleted" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
