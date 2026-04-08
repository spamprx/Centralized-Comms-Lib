import { Router, Response } from "express";

import { getPrismaClient, PrismaUnitOfWork } from "../../repository";
import type { AuthRequest } from "../../middlewares/auth.middleware";
import type { AuditContext } from "../../shared/context";
import type { TipTapDocument } from "../../repository/types";
import type { LayoutPhase } from "../../repository/types/templateLayoutSection";
import { contentService } from "../../service";

const router = Router();

function auditContext(req: AuthRequest): AuditContext {
  return {
    actorId: req.user!.id,
    isAdmin: req.user!.role === "ADMIN",
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  };
}

function isTipTapDoc(obj: unknown): obj is TipTapDocument {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const d = obj as Record<string, unknown>;
  return d.type === "doc" && Array.isArray(d.content);
}

/**
 * @openapi
 * /api/v1/components:
 *   post:
 *     summary: Register a reusable UI component
 *     tags:
 *       - Components
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - key
 *               - name
 *             properties:
 *               key:
 *                 type: string
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Component created
 *       409:
 *         description: Duplicate key
 *   get:
 *     summary: List all components
 *     tags:
 *       - Components
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Component list
 */
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const { key, name, description } = req.body as {
      key?: string;
      name?: string;
      description?: string | null;
    };
    if (!key?.trim() || !name?.trim()) {
      res.status(400).json({ error: "key and name are required" });
      return;
    }
    const uow = new PrismaUnitOfWork(getPrismaClient());
    const c = await uow.withTransaction((r) =>
      r.componentRegistry.createComponent({
        key: key.trim(),
        name: name.trim(),
        description: description ?? null,
      }),
    );
    res.status(201).json(c);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unique constraint") || msg.includes("Unique")) {
      res.status(409).json({ error: "Component key already exists" });
      return;
    }
    res.status(500).json({ error: msg });
  }
});

/** List all registered components. */
router.get("/", async (_req: AuthRequest, res: Response) => {
  try {
    const uow = new PrismaUnitOfWork(getPrismaClient());
    const list = await uow.repos().componentRegistry.listComponents();
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * @openapi
 * /api/v1/components/search:
 *   get:
 *     summary: Filter components by key, name, or description substring
 *     tags:
 *       - Components
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Filtered list
 */
router.get("/search", async (req: AuthRequest, res: Response) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const uow = new PrismaUnitOfWork(getPrismaClient());
    const list = await uow.repos().componentRegistry.listComponents();
    const filtered = q
      ? list.filter(
          (c) =>
            c.key.toLowerCase().includes(q) ||
            c.name.toLowerCase().includes(q) ||
            (c.description?.toLowerCase().includes(q) ?? false),
        )
      : list;
    res.status(200).json(filtered);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * @openapi
 * /api/v1/components/{componentId}/versions:
 *   post:
 *     summary: Add a version row for a component
 *     tags:
 *       - Components
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: componentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - version
 *             properties:
 *               version:
 *                 type: string
 *               linkRefs:
 *                 type: array
 *                 items: {}
 *               propSchema:
 *                 type: object
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Version created
 */
router.post("/:componentId/versions", async (req: AuthRequest, res: Response) => {
  try {
    const { version, linkRefs, propSchema } = req.body as {
      version?: string;
      linkRefs?: unknown;
      propSchema?: unknown;
    };
    if (!version?.trim()) {
      res.status(400).json({ error: "version is required" });
      return;
    }
    const uow = new PrismaUnitOfWork(getPrismaClient());
    const v = await uow.withTransaction((r) =>
      r.componentRegistry.createVersion({
        componentId: req.params.componentId,
        version: version.trim(),
        linkRefs,
        propSchema,
      }),
    );
    res.status(201).json(v);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * @openapi
 * /api/v1/components/templates/{templateId}/sections:
 *   post:
 *     summary: Add a template layout section (optionally linked to a component version)
 *     tags:
 *       - Components
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phase
 *               - sortOrder
 *             properties:
 *               phase:
 *                 type: string
 *                 enum: [DRAFT, ACTIVE]
 *               sortOrder:
 *                 type: integer
 *               componentVersionId:
 *                 type: string
 *                 nullable: true
 *               props:
 *                 type: object
 *     responses:
 *       201:
 *         description: Section created
 */
router.post("/templates/:templateId/sections", async (req: AuthRequest, res: Response) => {
  try {
    const { phase, sortOrder, componentVersionId, props } = req.body as {
      phase?: LayoutPhase;
      sortOrder?: number;
      componentVersionId?: string | null;
      props?: unknown;
    };
    if (phase !== "DRAFT" && phase !== "ACTIVE") {
      res.status(400).json({ error: "phase must be DRAFT or ACTIVE" });
      return;
    }
    if (typeof sortOrder !== "number" || sortOrder < 0) {
      res.status(400).json({ error: "sortOrder must be a non-negative number" });
      return;
    }
    const uow = new PrismaUnitOfWork(getPrismaClient());
    const row = await uow.withTransaction((r) =>
      r.templateLayoutSection.create({
        templateId: req.params.templateId,
        phase,
        sortOrder,
        componentVersionId: componentVersionId ?? null,
        props: props ?? {},
      }),
    );
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * @openapi
 * /api/v1/components/content/{contentId}/insert:
 *   post:
 *     summary: Append a component placeholder paragraph to content body (TipTap)
 *     tags:
 *       - Components
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - componentKey
 *             properties:
 *               componentKey:
 *                 type: string
 *               componentVersionId:
 *                 type: string
 *               label:
 *                 type: string
 *     responses:
 *       200:
 *         description: New version saved
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Content not found
 *       422:
 *         description: Not editable or formatting violations
 */
router.post("/content/:contentId/insert", async (req: AuthRequest, res: Response) => {
  try {
    const { componentKey, componentVersionId, label } = req.body as {
      componentKey?: string;
      componentVersionId?: string;
      label?: string;
    };
    if (!componentKey?.trim()) {
      res.status(400).json({ error: "componentKey is required" });
      return;
    }

    const detail = await contentService.getById(req.params.contentId, {
      id: req.user!.id,
      isAdmin: req.user!.role === "ADMIN",
    });
    if (!detail) {
      res.status(404).json({ error: "Content not found" });
      return;
    }
    const latest = detail.versions[0];
    const prevBody =
      latest?.body && isTipTapDoc(latest.body)
        ? latest.body
        : ({ type: "doc", content: [] } as TipTapDocument);
    const prevNodes = Array.isArray((prevBody as { content?: unknown }).content)
      ? ([...(prevBody as { content: unknown[] }).content] as unknown[])
      : [];
    const tag =
      label?.trim() ||
      `[Component ${componentKey.trim()}${componentVersionId ? ` ref:${componentVersionId}` : ""}]`;
    const merged: TipTapDocument = {
      type: "doc",
      content: [
        ...prevNodes,
        {
          type: "paragraph",
          content: [{ type: "text", text: tag }],
        },
      ],
    } as TipTapDocument;

    const result = await contentService.saveBody(auditContext(req), req.params.contentId, {
      body: merged,
    });
    if ("notFound" in result && result.notFound) {
      res.status(404).json({ error: "Content not found" });
      return;
    }
    if ("forbidden" in result && result.forbidden) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if ("invalidState" in result && result.invalidState) {
      res.status(422).json({ error: "Content not editable in this state" });
      return;
    }
    if ("invalidFormatting" in result && result.invalidFormatting) {
      res.status(422).json({ violations: result.violations });
      return;
    }
    if ("version" in result) res.status(200).json({ version: result.version, inserted: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
