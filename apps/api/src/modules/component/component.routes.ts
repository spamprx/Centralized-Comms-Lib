import { Router, Response } from "express";

import { getPrismaClient, PrismaUnitOfWork } from "../../repository";
import { authorize, type AuthRequest } from "../../middlewares/auth.middleware";
import type { AuditContext } from "../../shared/context";
import type { TipTapDocument } from "../../repository/types";
import type { LayoutPhase } from "../../repository/types/templateLayoutSection";
import { contentService } from "../../service";
import {
  buildDetachedLibraryNode,
  buildLinkedLibraryNode,
  isTipTapDoc,
  normalizeSnapshotDoc,
} from "./libraryComponent";
import {
  patchComponentVersionCanonicalBody,
  propagateLinkedComponentToContent,
} from "./componentPropagation.service";

const router = Router();

function auditContext(req: AuthRequest): AuditContext {
  return {
    actorId: req.user!.id,
    isAdmin: req.user!.role === "ADMIN",
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  };
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
    const ctx = auditContext(req);
    const uow = new PrismaUnitOfWork(getPrismaClient());
    const c = await uow.withTransaction(async (r) => {
      const comp = await r.componentRegistry.createComponent({
        key: key.trim(),
        name: name.trim(),
        description: description ?? null,
      });
      await r.audit.append({
        action: "CREATE",
        resource: "COMPONENT",
        resourceId: comp.id,
        newValue: {
          key: key.trim(),
          name: name.trim(),
          description: description ?? null,
        },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return comp;
    });
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
    const list = await uow
      .repos()
      .componentRegistry.listComponentsWithLatestVersion();
    res.status(200).json(list);
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err) });
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
    const q =
      typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const uow = new PrismaUnitOfWork(getPrismaClient());
    const list = await uow
      .repos()
      .componentRegistry.listComponentsWithLatestVersion();
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
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * @openapi
 * /api/v1/components/versions/{versionId}:
 *   get:
 *     summary: Get a component version (canonical body for linked sync)
 *     tags:
 *       - Components
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: versionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Version with parent component metadata
 *       404:
 *         description: Not found
 */
router.get("/versions/:versionId", async (req: AuthRequest, res: Response) => {
  try {
    const uow = new PrismaUnitOfWork(getPrismaClient());
    const ver = await uow
      .repos()
      .componentRegistry.getVersionById(req.params.versionId);
    if (!ver) {
      res.status(404).json({ error: "Component version not found" });
      return;
    }
    const comp = await uow
      .repos()
      .componentRegistry.getComponentById(ver.componentId);
    if (!comp) {
      res.status(404).json({ error: "Component not found" });
      return;
    }
    res.status(200).json({
      ...ver,
      component: {
        id: comp.id,
        key: comp.key,
        name: comp.name,
        description: comp.description,
      },
    });
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * @openapi
 * /api/v1/components/versions/{versionId}/propagate:
 *   post:
 *     summary: Push canonical library body into all linked usages (admin)
 *     tags:
 *       - Components
 */
router.post(
  "/versions/:versionId/propagate",
  authorize("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = auditContext(req);
      const result = await propagateLinkedComponentToContent(
        ctx,
        req.params.versionId,
      );
      if ("notFound" in result && result.notFound) {
        res.status(404).json({ error: "Component version not found" });
        return;
      }
      const uow = new PrismaUnitOfWork(getPrismaClient());
      await uow.withTransaction(async (r) => {
        await r.audit.append({
          action: "UPDATE",
          resource: "COMPONENT_VERSION",
          resourceId: req.params.versionId,
          newValue: { linkedPropagation: true },
          actorId: ctx.actorId,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        });
      });
      res.status(200).json(result);
    } catch (err) {
      res
        .status(500)
        .json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

/**
 * @openapi
 * /api/v1/components/versions/{versionId}:
 *   patch:
 *     summary: Update canonical component version body and optionally propagate to linked content (admin)
 *     tags:
 *       - Components
 */
router.patch(
  "/versions/:versionId",
  authorize("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { bodyJson, propagate } = req.body as {
        bodyJson?: unknown | null;
        propagate?: boolean;
      };
      if (
        bodyJson !== undefined &&
        bodyJson !== null &&
        !isTipTapDoc(bodyJson)
      ) {
        res
          .status(400)
          .json({ error: "bodyJson must be a valid TipTap document or null" });
        return;
      }
      const ctx = auditContext(req);
      const shouldPropagate = propagate !== false;
      const out = await patchComponentVersionCanonicalBody(
        ctx,
        req.params.versionId,
        bodyJson,
        {
          propagate: shouldPropagate,
        },
      );
      if ("notFound" in out && out.notFound) {
        res.status(404).json({ error: "Component version not found" });
        return;
      }
      const uow = new PrismaUnitOfWork(getPrismaClient());
      await uow.withTransaction(async (r) => {
        await r.audit.append({
          action: "UPDATE",
          resource: "COMPONENT_VERSION",
          resourceId: req.params.versionId,
          newValue: {
            bodyJson: bodyJson !== undefined,
            propagate: shouldPropagate,
          },
          actorId: ctx.actorId,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        });
      });
      res.status(200).json(out);
    } catch (err) {
      res
        .status(500)
        .json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

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
 *               bodyJson:
 *                 description: Canonical TipTap document for this library version
 *                 type: object
 *                 nullable: true
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
router.post(
  "/:componentId/versions",
  async (req: AuthRequest, res: Response) => {
    try {
      const { version, bodyJson, linkRefs, propSchema } = req.body as {
        version?: string;
        bodyJson?: unknown;
        linkRefs?: unknown;
        propSchema?: unknown;
      };
      if (!version?.trim()) {
        res.status(400).json({ error: "version is required" });
        return;
      }
      if (
        bodyJson !== undefined &&
        bodyJson !== null &&
        !isTipTapDoc(bodyJson)
      ) {
        res.status(400).json({
          error:
            "bodyJson must be a valid TipTap document (type: 'doc', content: array)",
        });
        return;
      }
      const ctx = auditContext(req);
      const uow = new PrismaUnitOfWork(getPrismaClient());
      const v = await uow.withTransaction(async (r) => {
        const ver = await r.componentRegistry.createVersion({
          componentId: req.params.componentId,
          version: version.trim(),
          bodyJson: bodyJson === undefined ? undefined : bodyJson,
          linkRefs,
          propSchema,
        });
        await r.audit.append({
          action: "CREATE",
          resource: "COMPONENT_VERSION",
          resourceId: ver.id,
          newValue: {
            componentId: req.params.componentId,
            version: version.trim(),
          },
          actorId: ctx.actorId,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        });
        return ver;
      });
      res.status(201).json(v);
    } catch (err) {
      res
        .status(500)
        .json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

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
router.post(
  "/templates/:templateId/sections",
  async (req: AuthRequest, res: Response) => {
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
        res
          .status(400)
          .json({ error: "sortOrder must be a non-negative number" });
        return;
      }
      const ctx = auditContext(req);
      const uow = new PrismaUnitOfWork(getPrismaClient());
      const row = await uow.withTransaction(async (r) => {
        const section = await r.templateLayoutSection.create({
          templateId: req.params.templateId,
          phase,
          sortOrder,
          componentVersionId: componentVersionId ?? null,
          props: props ?? {},
        });
        await r.audit.append({
          action: "CREATE",
          resource: "TEMPLATE_LAYOUT_SECTION",
          resourceId: section.id,
          newValue: {
            templateId: req.params.templateId,
            phase,
            sortOrder,
            componentVersionId: componentVersionId ?? null,
          },
          actorId: ctx.actorId,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        });
        return section;
      });
      res.status(201).json(row);
    } catch (err) {
      res
        .status(500)
        .json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

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
 *               insertionMode:
 *                 type: string
 *                 enum: [linked, detached]
 *                 description: linked follows library body; detached stores a snapshot
 *               componentKey:
 *                 type: string
 *               componentVersionId:
 *                 type: string
 *                 description: Required — library version to link or to snapshot from
 *               label:
 *                 type: string
 *               snapshotDoc:
 *                 type: object
 *                 description: Required when insertionMode is detached (TipTap doc or content array)
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
router.post(
  "/content/:contentId/insert",
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        insertionMode,
        componentKey,
        componentVersionId,
        label,
        snapshotDoc,
      } = req.body as {
        insertionMode?: string;
        componentKey?: string;
        componentVersionId?: string;
        label?: string;
        snapshotDoc?: unknown;
      };
      const mode = insertionMode === "detached" ? "detached" : "linked";

      if (!componentKey?.trim()) {
        res.status(400).json({ error: "componentKey is required" });
        return;
      }
      if (!componentVersionId?.trim()) {
        res.status(400).json({ error: "componentVersionId is required" });
        return;
      }
      if (
        insertionMode !== undefined &&
        insertionMode !== "linked" &&
        insertionMode !== "detached"
      ) {
        res
          .status(400)
          .json({ error: "insertionMode must be 'linked' or 'detached'" });
        return;
      }

      const uow = new PrismaUnitOfWork(getPrismaClient());
      const versionRecord = await uow
        .repos()
        .componentRegistry.getVersionById(componentVersionId.trim());
      if (!versionRecord) {
        res.status(404).json({ error: "Component version not found" });
        return;
      }
      const componentRecord = await uow
        .repos()
        .componentRegistry.getComponentById(versionRecord.componentId);
      if (!componentRecord || componentRecord.key !== componentKey.trim()) {
        res.status(400).json({
          error: "componentKey does not match this component version",
        });
        return;
      }

      let block: Record<string, unknown>;
      if (mode === "linked") {
        const canonical =
          versionRecord.bodyJson != null && isTipTapDoc(versionRecord.bodyJson)
            ? (versionRecord.bodyJson as TipTapDocument)
            : null;
        block = buildLinkedLibraryNode({
          componentKey: componentKey.trim(),
          componentVersionId: versionRecord.id,
          label: label?.trim() || componentRecord.name || componentKey.trim(),
          componentName: componentRecord.name,
          canonicalBody: canonical,
        });
      } else {
        const normalized = normalizeSnapshotDoc(snapshotDoc);
        if (!normalized) {
          res.status(400).json({
            error:
              "snapshotDoc is required for detached insertion (TipTap doc or content array)",
          });
          return;
        }
        block = buildDetachedLibraryNode({
          componentKey: componentKey.trim(),
          snapshotVersionId: versionRecord.id,
          label: label?.trim() || componentRecord.name || componentKey.trim(),
          componentName: componentRecord.name,
          snapshotDoc: normalized,
        });
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
      const prevNodes = Array.isArray(
        (prevBody as { content?: unknown }).content,
      )
        ? ([...(prevBody as { content: unknown[] }).content] as unknown[])
        : [];
      const merged: TipTapDocument = {
        type: "doc",
        content: [...prevNodes, block],
      } as TipTapDocument;

      const result = await contentService.saveBody(
        auditContext(req),
        req.params.contentId,
        {
          body: merged,
        },
      );
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
      if ("version" in result)
        res.status(200).json({ version: result.version, inserted: true });
    } catch (err) {
      res
        .status(500)
        .json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

export default router;
