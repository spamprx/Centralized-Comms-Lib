import { Router, Response } from "express";
import { AssetUsageTargetType } from "@prisma/client";

import type { AuthRequest } from "../../middlewares/auth.middleware";
import { assetsService } from "./assets.service";
import type { AssetCategory, AssetPlacementDto } from "./assets.types";
import { linkIntegrityService } from "./linkIntegrity.service";
import { validatePayload } from "../../shared/validation";
import { AppError } from "../../shared/errors/appError";
import { uploadIntentBodySchema } from "./assets.schema";

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

function parseCategory(v: unknown): AssetCategory | undefined {
  if (
    v === "image" ||
    v === "video" ||
    v === "document" ||
    v === "audio" ||
    v === "other"
  ) {
    return v;
  }
  return undefined;
}

function parsePlacement(v: unknown): AssetPlacementDto | undefined {
  if (v === "MY_ASSETS" || v === "LIBRARY") return v;
  return undefined;
}

/**
 * @openapi
 * /api/v1/assets/upload-intent:
 *   post:
 *     summary: Reserve metadata and get a presigned PUT URL for direct upload to object storage
 *     tags: [Assets]
 *     security:
 *       - bearerAuth: []
 */
router.post("/upload-intent", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const parsed = validatePayload(uploadIntentBodySchema, req.body);
    const placement = parsed.placement ?? "MY_ASSETS";
    const result = await assetsService.createUploadIntent(userId, {
      filename: parsed.filename,
      mimeType: parsed.mimeType,
      category: parsed.category,
      placement,
      sizeBytes: parsed.sizeBytes,
    });
    res.status(201).json(result);
  } catch (e: unknown) {
    handleError(res, e);
  }
});

/**
 * @openapi
 * /api/v1/assets:
 *   get:
 *     summary: List assets (my assets + library by default)
 *     tags: [Assets]
 *     security:
 *       - bearerAuth: []
 */
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const placement = parsePlacement(req.query.placement);
    const category = parseCategory(req.query.category);
    const limitRaw = Number(req.query.limit ?? 50);
    const offsetRaw = Number(req.query.offset ?? 0);
    const limit = Math.min(
      100,
      Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 50,
    );
    const offset =
      Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.floor(offsetRaw) : 0;

    const result = await assetsService.listAssets(userId, {
      placement,
      category,
      limit,
      offset,
    });
    res.json(result);
  } catch (e: unknown) {
    handleError(res, e);
  }
});

router.post("/:id/finalize", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === "ADMIN";
    const { id } = req.params;
    const result = await assetsService.finalizeUpload(userId, id, {
      isAdmin,
    });
    res.json(result);
  } catch (e: unknown) {
    handleError(res, e);
  }
});

router.get("/:id/view-link", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === "ADMIN";
    const { id } = req.params;
    const ttlRaw = Number(req.query.expiresInSeconds ?? req.query.ttl ?? 3600);
    const expiresInSeconds =
      Number.isFinite(ttlRaw) && ttlRaw > 0 ? Math.floor(ttlRaw) : 3600;
    const result = await assetsService.getViewLink(userId, id, expiresInSeconds, {
      isAdmin,
    });
    res.json(result);
  } catch (e: unknown) {
    handleError(res, e);
  }
});

router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === "ADMIN";
    const { id } = req.params;
    await assetsService.deleteAsset(userId, id, { isAdmin });
    res.status(204).send();
  } catch (e: unknown) {
    handleError(res, e);
  }
});

router.post("/:id/usages", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const body = req.body as Record<string, unknown>;
    const tt = body.targetType;
    const targetType =
      tt === "CONTENT" || tt === "TEMPLATE" || tt === "OTHER"
        ? (tt as AssetUsageTargetType)
        : undefined;
    const targetId =
      typeof body.targetId === "string" ? body.targetId.trim() : "";
    const fieldPath =
      typeof body.fieldPath === "string" ? body.fieldPath.trim() : null;

    if (!targetType) {
      res.status(400).json({
        error: "targetType must be CONTENT, TEMPLATE, or OTHER",
      });
      return;
    }
    if (!targetId) {
      res.status(400).json({ error: "targetId is required" });
      return;
    }

    const result = await assetsService.registerUsage(
      userId,
      id,
      {
        targetType,
        targetId,
        fieldPath,
      },
      { isAdmin: req.user!.role === "ADMIN" },
    );
    res.status(201).json(result);
  } catch (e: unknown) {
    handleError(res, e);
  }
});

router.post("/:id/link-checks", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const list = (req.body as { urls?: unknown })?.urls;
    const existing = await assetsService.getAssetIfAllowed(
      userId,
      req.user!.role === "ADMIN",
      id,
      "read",
    );
    if (!existing) {
      res.status(404).json({ error: "Asset not found" });
      return;
    }
    const out = await linkIntegrityService.attachLinks(id, list);
    res.status(201).json(out);
  } catch (e: unknown) {
    handleError(res, e);
  }
});

router.get("/:id/link-checks", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const existing = await assetsService.getAssetIfAllowed(
      userId,
      req.user!.role === "ADMIN",
      id,
      "read",
    );
    if (!existing) {
      res.status(404).json({ error: "Asset not found" });
      return;
    }
    const rows = await linkIntegrityService.listForAsset(id);
    res.status(200).json(
      rows.map((r: {
        id: string;
        assetId: string;
        url: string;
        status: string;
        httpStatusCode: number | null;
        errorMessage: string | null;
        checkedAt: Date | null;
        updatedAt: Date;
      }) => ({
        id: r.id,
        assetId: r.assetId,
        url: r.url,
        status: r.status,
        httpStatusCode: r.httpStatusCode,
        errorMessage: r.errorMessage,
        checkedAt: r.checkedAt?.toISOString() ?? null,
        updatedAt: r.updatedAt.toISOString(),
      })),
    );
  } catch (e: unknown) {
    handleError(res, e);
  }
});

export default router;
