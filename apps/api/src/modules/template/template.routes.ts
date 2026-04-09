import { Router, Response } from "express";

import type { TemplateBinding, TemplateStatus } from "../../repository/types";
import { templateService } from "../../service";
import type { AuditContext } from "../../shared/context";
import type { AuthRequest } from "../../middlewares/auth.middleware";
import { formattingRuleService } from "./formattingRule.service";

const router = Router();

function auditContext(req: AuthRequest): AuditContext {
  return {
    actorId: req.user!.id,
    isAdmin: req.user!.role === "ADMIN",
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  };
}

function bindingJson(b: TemplateBinding) {
  return {
    id: b.id,
    templateId: b.templateId,
    channelId: b.channelId,
    createdAt: b.createdAt.toISOString(),
  };
}

/**
 * @openapi
 * /api/v1/templates:
 *   post:
 *     summary: Create a template (draft)
 *     tags:
 *       - Templates
 *     security:
 *       - bearerAuth: []
 */
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, draftLayout } = req.body as {
      name?: string;
      description?: string | null;
      draftLayout?: unknown;
    };
    const template = await templateService.create(auditContext(req), {
      name: name ?? "",
      description,
      draftLayout,
    });
    res.status(201).json(templateService.templateToJSON(template));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes("name") ||
      message.includes("Invalid") ||
      message.includes("draftLayout")
    ) {
      res.status(400).json({ error: message });
      return;
    }
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/templates:
 *   get:
 *     summary: List templates
 *     tags:
 *       - Templates
 *     security:
 *       - bearerAuth: []
 */
router.get("/", async (_req: AuthRequest, res: Response) => {
  try {
    const list = await templateService.list();
    res.status(200).json(list.map((t) => templateService.templateToJSON(t)));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/templates/{id}/clone:
 *   post:
 *     summary: Deep-clone a template (new ids, regenerated region ids in layouts)
 *     tags:
 *       - Templates
 *     security:
 *       - bearerAuth: []
 */
router.post("/:id/clone", async (req: AuthRequest, res: Response) => {
  try {
    const result = await templateService.clone(auditContext(req), req.params.id);
    if ("notFound" in result && result.notFound) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    if ("ok" in result && result.ok) {
      const t = result.template;
      res.status(201).json({
        ...templateService.templateToJSON(t),
        bindings: t.bindings.map(bindingJson),
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/templates/{id}/i18n:
 *   patch:
 *     summary: Merge per-locale string maps into the template
 *     tags:
 *       - Templates
 *     security:
 *       - bearerAuth: []
 */
router.patch("/:id/i18n", async (req: AuthRequest, res: Response) => {
  try {
    const result = await templateService.patchI18n(auditContext(req), req.params.id, req.body);
    if ("notFound" in result && result.notFound) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    if ("invalid" in result && result.invalid) {
      res.status(400).json({ error: result.message });
      return;
    }
    if ("ok" in result && result.ok) {
      res.status(200).json(templateService.templateToJSON(result.template));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/templates/{id}/layout/draft:
 *   patch:
 *     summary: Save validated layout as draft
 *     tags:
 *       - Templates
 *     security:
 *       - bearerAuth: []
 */
router.patch("/:id/layout/draft", async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body as { layout?: unknown };
    const layout = body?.layout !== undefined ? body.layout : req.body;
    const result = await templateService.saveDraftLayout(auditContext(req), req.params.id, layout);
    if ("notFound" in result && result.notFound) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    if ("invalid" in result && result.invalid) {
      res.status(400).json({ error: result.message });
      return;
    }
    if ("ok" in result && result.ok) {
      res.status(200).json(templateService.templateToJSON(result.template));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/templates/{id}/activate:
 *   post:
 *     summary: Promote draft layout to active (requires bindings and valid layout)
 *     tags:
 *       - Templates
 *     security:
 *       - bearerAuth: []
 */
router.post("/:id/activate", async (req: AuthRequest, res: Response) => {
  try {
    const result = await templateService.activate(auditContext(req), req.params.id);
    if ("notFound" in result && result.notFound) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    if ("invalid" in result && result.invalid) {
      res.status(400).json({ error: result.message });
      return;
    }
    if ("ok" in result && result.ok) {
      res.status(200).json(templateService.templateToJSON(result.template));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/templates/{id}/bindings:
 *   post:
 *     summary: Bind template to an existing channel
 *     tags:
 *       - Templates
 *     security:
 *       - bearerAuth: []
 */
router.post("/:id/bindings", async (req: AuthRequest, res: Response) => {
  try {
    const { channelId } = req.body as { channelId?: string };
    const result = await templateService.addBinding(auditContext(req), req.params.id, channelId ?? "");
    if ("notFound" in result && result.notFound) {
      res.status(404).json({ error: "Template or channel not found" });
      return;
    }
    if ("invalid" in result && result.invalid) {
      res.status(400).json({ error: result.message });
      return;
    }
    if ("conflict" in result && result.conflict) {
      res.status(409).json({ error: "Binding already exists for this channel" });
      return;
    }
    if ("ok" in result && result.ok) {
      res.status(201).json(bindingJson(result.binding));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/templates/{id}/bindings/{bindingId}:
 *   delete:
 *     summary: Remove a template–channel binding
 *     tags:
 *       - Templates
 *     security:
 *       - bearerAuth: []
 */
router.delete("/:id/bindings/:bindingId", async (req: AuthRequest, res: Response) => {
  try {
    const result = await templateService.removeBinding(
      auditContext(req),
      req.params.id,
      req.params.bindingId,
    );
    if ("notFound" in result && result.notFound) {
      res.status(404).json({ error: "Binding not found" });
      return;
    }
    res.status(200).json({ message: "Binding removed" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/templates/{id}/formatting-rules:
 *   get:
 *     summary: Get TipTap formatting rules for a template
 *     tags:
 *       - Templates
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Rules document (may be empty object if unset)
 *   put:
 *     summary: Create or replace formatting rules for a template
 *     tags:
 *       - Templates
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               - rules
 *             properties:
 *               rules:
 *                 type: object
 *                 description: Fonts, colors, headings, and media constraints JSON
 *     responses:
 *       200:
 *         description: Updated rules
 *       400:
 *         description: Invalid body
 *       404:
 *         description: Template not found
 *   delete:
 *     summary: Delete formatting rules for a template
 *     tags:
 *       - Templates
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Deleted
 *       404:
 *         description: No rules row to delete
 */
router.get("/:id/formatting-rules", async (req: AuthRequest, res: Response) => {
  try {
    const row = await formattingRuleService.getForTemplate(req.params.id);
    res.status(200).json({
      id: row?.id ?? null,
      templateId: req.params.id,
      rules: row?.rules ?? {},
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.put("/:id/formatting-rules", async (req: AuthRequest, res: Response) => {
  try {
    const { rules } = req.body as { rules?: unknown };
    if (rules === undefined) {
      res.status(400).json({ error: "rules object is required" });
      return;
    }
    const result = await formattingRuleService.upsert(auditContext(req), req.params.id, rules);
    if ("notFound" in result && result.notFound) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    if ("invalid" in result && result.invalid) {
      res.status(400).json({ error: result.message });
      return;
    }
    const row = await formattingRuleService.getForTemplate(req.params.id);
    res.status(200).json({
      templateId: req.params.id,
      rules: row?.rules ?? {},
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.delete("/:id/formatting-rules", async (req: AuthRequest, res: Response) => {
  try {
    const result = await formattingRuleService.delete(auditContext(req), req.params.id);
    if ("notFound" in result && result.notFound) {
      res.status(404).json({ error: "Formatting rules not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/templates/{id}:
 *   get:
 *     summary: Get template with channel bindings
 *     tags:
 *       - Templates
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Template with bindings
 *       404:
 *         description: Template not found
 */
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const t = await templateService.getByIdWithBindings(req.params.id);
    if (!t) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    res.status(200).json({
      ...templateService.templateToJSON(t),
      bindings: t.bindings.map(bindingJson),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/templates/{id}:
 *   patch:
 *     summary: Update template metadata (deactivate with status DRAFT)
 *     tags:
 *       - Templates
 *     security:
 *       - bearerAuth: []
 */
router.patch("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, slug, status } = req.body as {
      name?: string;
      description?: string | null;
      slug?: string;
      status?: TemplateStatus;
    };
    const result = await templateService.update(auditContext(req), req.params.id, {
      name,
      description,
      slug,
      status,
    });
    if ("notFound" in result && result.notFound) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    if ("conflict" in result && result.conflict) {
      res.status(409).json({ error: result.message });
      return;
    }
    if ("invalid" in result && result.invalid) {
      res.status(400).json({ error: result.message });
      return;
    }
    if ("ok" in result && result.ok) {
      res.status(200).json(templateService.templateToJSON(result.template));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/templates/{id}:
 *   delete:
 *     summary: Delete template (blocked if ACTIVE or referenced by content)
 *     tags:
 *       - Templates
 *     security:
 *       - bearerAuth: []
 */
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const result = await templateService.delete(auditContext(req), req.params.id);
    if ("notFound" in result && result.notFound) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    if ("inUse" in result && result.inUse) {
      res.status(409).json({ error: result.reason });
      return;
    }
    res.status(200).json({ message: "Template deleted" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
