import { Router, Response } from "express";

import type { AuthRequest } from "../../middlewares/auth.middleware";
import { getPrismaClient, PrismaUnitOfWork } from "../../repository";

const router = Router();

/**
 * Groups the current user belongs to (for content visibility selection).
 * Non-admin authors can use this to select `PRIVATE_TO_GROUP`.
 */
router.get("/mine", async (req: AuthRequest, res: Response) => {
  try {
    const uow = new PrismaUnitOfWork(getPrismaClient());
    const groups = await uow.repos().userRole.listGroupsForUser(req.user!.id);
    res.status(200).json(
      groups.map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description ?? null,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      })),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
