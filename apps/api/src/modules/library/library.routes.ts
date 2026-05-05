import { Router, Response } from "express";

import type { AuthRequest } from "../../middlewares/auth.middleware";
import { assetsService } from "../assets/assets.service";
import { validatePayload } from "../../shared/validation";
import { shareLinkBodySchema } from "../assets/assets.schema";
import { AppError } from "../../shared/errors/appError";

const router = Router();

function handleError(res: Response, e: unknown): void {
  if (e instanceof AppError && e.statusCode < 500) {
    res.status(e.statusCode).json({
      error: e.message,
      ...(e.code ? { code: e.code } : {}),
      ...(e.details !== undefined ? { details: e.details } : {}),
    });
    return;
  }
  const err = e as { status?: number; message?: string };
  res.status(typeof err.status === "number" ? err.status : 500).json({
    error: err.message ?? "Internal error",
  });
}

/**
 * Signed expiring URL for library-placement assets (shareable link).
 * POST /api/v1/library/:id/share-link
 */
router.post("/:id/share-link", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const body = validatePayload(shareLinkBodySchema, req.body ?? {});
    const ttlRaw = Number(body.expiresInSeconds ?? body.ttl);
    const expiresInSeconds =
      Number.isFinite(ttlRaw) && ttlRaw > 0 ? Math.floor(ttlRaw) : undefined;
    const result = await assetsService.shareLibraryLink(userId, id, expiresInSeconds);
    res.json(result);
  } catch (e: unknown) {
    handleError(res, e);
  }
});

export default router;
