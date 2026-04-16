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

/** Same JSON shape as GET /templates/:id so clients can merge without losing bindings. */
async function templateJsonWithBindingsForId(id: string) {
  const t = await templateService.getByIdWithBindings(id);
  if (!t) return null;
  return {
    ...templateService.templateToJSON(t),
    bindings: t.bindings.map(bindingJson),
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Weekly Newsletter"
 *               description:
 *                 type: string
 *                 example: "Standard newsletter layout"
 *               draftLayout:
 *                 type: object
 *                 example:
 *                   sections:
 *                     - id: hero
 *                       type: image
 *                       label: Hero Image
 *                     - id: body
 *                       type: richtext
 *                       label: Body
 *     responses:
 *       201:
 *         description: Created template
 *       400:
 *         description: Invalid name or layout
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
 *     responses:
 *       200:
 *         description: Array of templates
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the template to clone
 *     responses:
 *       201:
 *         description: Cloned template with bindings
 *       404:
 *         description: Source template not found
 */
router.post("/:id/clone", async (req: AuthRequest, res: Response) => {
  try {
    const result = await templateService.clone(
      auditContext(req),
      req.params.id,
    );
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
 * /api/v1/templates/translate:
 *   post:
 *     summary: Translate text to a target language using Google Translate
 *     tags:
 *       - Templates
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text, targetLocale]
 *             properties:
 *               text:
 *                 type: string
 *               targetLocale:
 *                 type: string
 *               sourceLocale:
 *                 type: string
 *                 description: Optional — auto-detected if omitted
 *     responses:
 *       200:
 *         description: Translated text with detected source language
 *       400:
 *         description: Invalid input
 */
router.post("/translate", async (req: AuthRequest, res: Response) => {
  try {
    const text = typeof req.body?.text === "string" ? req.body.text : "";
    const targetLocale =
      typeof req.body?.targetLocale === "string" ? req.body.targetLocale : "";
    const sourceLocale =
      typeof req.body?.sourceLocale === "string" && req.body.sourceLocale.trim()
        ? req.body.sourceLocale
        : undefined;

    const result = await templateService.translateText(
      text,
      targetLocale,
      sourceLocale,
    );

    if ("invalid" in result && result.invalid) {
      res.status(400).json({ error: result.message });
      return;
    }
    if ("ok" in result && result.ok) {
      res.status(200).json({
        translated: result.translated,
        detectedSource: result.detectedSource,
      });
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Template ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               layout:
 *                 type: object
 *                 description: Layout JSON to save as draft
 *             example:
 *               layout:
 *                 sections:
 *                   - id: hero
 *                     type: image
 *                     label: Hero Image
 *                   - id: body
 *                     type: richtext
 *                     label: Body
 *     responses:
 *       200:
 *         description: Updated template
 *       400:
 *         description: Invalid layout
 *       404:
 *         description: Template not found
 */
router.patch("/:id/layout/draft", async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body as { layout?: unknown };
    const layout = body?.layout !== undefined ? body.layout : req.body;
    const result = await templateService.saveDraftLayout(
      auditContext(req),
      req.params.id,
      layout,
    );
    if ("notFound" in result && result.notFound) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    if ("invalid" in result && result.invalid) {
      res.status(400).json({ error: result.message });
      return;
    }
    if ("ok" in result && result.ok) {
      const full = await templateJsonWithBindingsForId(req.params.id);
      if (!full) {
        res.status(500).json({ error: "Template not found after update" });
        return;
      }
      res.status(200).json(full);
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
 *     summary: Promote draft layout to active (valid draft layout required; channel bindings optional)
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
 *         description: Template ID
 *     responses:
 *       200:
 *         description: Activated template
 *       400:
 *         description: Invalid or missing draft layout
 *       404:
 *         description: Template not found
 */
router.post("/:id/activate", async (req: AuthRequest, res: Response) => {
  try {
    const result = await templateService.activate(
      auditContext(req),
      req.params.id,
    );
    if ("notFound" in result && result.notFound) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    if ("invalid" in result && result.invalid) {
      res.status(400).json({ error: result.message });
      return;
    }
    if ("ok" in result && result.ok) {
      const body = await templateJsonWithBindingsForId(req.params.id);
      if (!body) {
        res.status(500).json({ error: "Template not found after update" });
        return;
      }
      res.status(200).json(body);
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Template ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - channelId
 *             properties:
 *               channelId:
 *                 type: string
 *                 description: ID of the channel to bind
 *     responses:
 *       201:
 *         description: Created binding
 *       404:
 *         description: Template or channel not found
 *       409:
 *         description: Binding already exists
 */
router.post("/:id/bindings", async (req: AuthRequest, res: Response) => {
  try {
    const { channelId } = req.body as { channelId?: string };
    const result = await templateService.addBinding(
      auditContext(req),
      req.params.id,
      channelId ?? "",
    );
    if ("notFound" in result && result.notFound) {
      res.status(404).json({ error: "Template or channel not found" });
      return;
    }
    if ("invalid" in result && result.invalid) {
      res.status(400).json({ error: result.message });
      return;
    }
    if ("conflict" in result && result.conflict) {
      res
        .status(409)
        .json({ error: "Binding already exists for this channel" });
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
 *     summary: Remove a template-channel binding
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
 *         description: Template ID
 *       - in: path
 *         name: bindingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Binding ID to remove
 *     responses:
 *       200:
 *         description: Binding removed
 *       404:
 *         description: Binding not found
 */
router.delete(
  "/:id/bindings/:bindingId",
  async (req: AuthRequest, res: Response) => {
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
  },
);

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
 *         description: Template ID
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
 *         description: Template ID
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
 *                 example:
 *                   fonts:
 *                     heading: "Georgia, serif"
 *                     body: "Inter, sans-serif"
 *                   colors:
 *                     primary: "#1a73e8"
 *                   headings:
 *                     h1:
 *                       fontSize: "2rem"
 *                       fontWeight: 700
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
 *         description: Template ID
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
    const result = await formattingRuleService.upsert(
      auditContext(req),
      req.params.id,
      rules,
    );
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

router.delete(
  "/:id/formatting-rules",
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await formattingRuleService.delete(
        auditContext(req),
        req.params.id,
      );
      if ("notFound" in result && result.notFound) {
        res.status(404).json({ error: "Formatting rules not found" });
        return;
      }
      res.status(204).send();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

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
 *         description: Template ID
 *     responses:
 *       200:
 *         description: Template with bindings
 *       404:
 *         description: Template not found
 *   patch:
 *     summary: Update template metadata (deactivate with status DRAFT)
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
 *         description: Template ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               slug:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [DRAFT, ACTIVE]
 *     responses:
 *       200:
 *         description: Updated template
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Template not found
 *       409:
 *         description: Name or slug conflict
 *   delete:
 *     summary: Delete template (blocked if ACTIVE or referenced by content)
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
 *         description: Template ID
 *     responses:
 *       200:
 *         description: Template deleted
 *       404:
 *         description: Template not found
 *       409:
 *         description: Template is active or in use by content
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

router.patch("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, slug, status } = req.body as {
      name?: string;
      description?: string | null;
      slug?: string;
      status?: TemplateStatus;
    };
    const result = await templateService.update(
      auditContext(req),
      req.params.id,
      {
        name,
        description,
        slug,
        status,
      },
    );
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
      const body = await templateJsonWithBindingsForId(req.params.id);
      if (!body) {
        res.status(500).json({ error: "Template not found after update" });
        return;
      }
      res.status(200).json(body);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const result = await templateService.delete(
      auditContext(req),
      req.params.id,
    );
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
