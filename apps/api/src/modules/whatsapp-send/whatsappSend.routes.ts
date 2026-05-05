import { Router, Response } from "express";

import type { AuthRequest } from "../../middlewares/auth.middleware";
import {
  whatsappSendService,
  type WhatsAppBatchSendInput,
  type WhatsAppSendInput,
} from "./whatsappSend.service";
import type { AuditContext } from "../../shared/context";
import { contentService } from "../content/content.service";

const router = Router();

function auditContext(req: AuthRequest): AuditContext {
  return {
    actorId: req.user!.id,
    isAdmin: req.user?.role === "ADMIN",
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  };
}

/**
 * @openapi
 * /api/v1/whatsapp-send/convert:
 *   post:
 *     summary: Convert TipTap JSON to notification-framework payload for WhatsApp
 *     description: |
 *       Accepts TipTap content blocks with recipient details, converts to the
 *       JSON format expected by the notification-framework /notify endpoint,
 *       stores the request for audit, and returns the generated payload.
 *     tags:
 *       - WhatsApp Send
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - event_type
 *               - recipients
 *               - blocks
 *             properties:
 *               event_type:
 *                 type: string
 *                 description: Event type for the notification framework (e.g. ORDER_UPDATE)
 *               client_id:
 *                 type: string
 *                 description: Client identifier (optional — falls back to NOTIFY_CLIENT_ID env var)
 *               recipients:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - user_id
 *                     - wa_number
 *                   properties:
 *                     user_id:
 *                       type: string
 *                     wa_number:
 *                       type: string
 *               blocks:
 *                 type: array
 *                 description: TipTap content blocks (richText, field, media)
 *                 items:
 *                   type: object
 *               field_values:
 *                 type: object
 *                 description: Key-value map to resolve {{token}} placeholders
 *                 additionalProperties:
 *                   type: string
 *               attachments:
 *                 type: array
 *                 description: Additional attachments to include
 *                 items:
 *                   type: object
 *                   properties:
 *                     file_id:
 *                       type: string
 *                       description: Existing notification-framework media file reference
 *                     url:
 *                       type: string
 *                       description: Source URL that will be registered to notification-framework media
 *                     name:
 *                       type: string
 *                     mime_type:
 *                       type: string
 *                     delivery_mode:
 *                       type: string
 *                       enum: [auto, link_only, provider_media]
 *     responses:
 *       201:
 *         description: Converted payload stored and returned
 *       400:
 *         description: Validation error
 */
router.post("/convert", async (req: AuthRequest, res: Response) => {
  try {
    const { event_type, client_id, recipients, blocks, field_values, attachments } =
      req.body as WhatsAppSendInput;

    if (!event_type) {
      res.status(400).json({ error: "event_type is required" });
      return;
    }
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      res.status(400).json({ error: "recipients array is required and must not be empty" });
      return;
    }
    for (const r of recipients) {
      if (!r.user_id || !r.wa_number) {
        res.status(400).json({ error: "Each recipient must have user_id and wa_number" });
        return;
      }
    }
    if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
      res.status(400).json({ error: "blocks array is required and must not be empty" });
      return;
    }

    const input: WhatsAppSendInput = {
      event_type,
      client_id,
      recipients,
      blocks,
      field_values,
      attachments,
    };

    const { id, notifyPayload } = await whatsappSendService.convertAndStore(
      auditContext(req),
      input,
    );

    res.status(201).json({
      id,
      notify_payload: notifyPayload,
      message: "Payload generated. Use notify_payload to POST to the notification server /notify endpoint.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/whatsapp-send/send:
 *   post:
 *     summary: Convert TipTap JSON and forward to the notification server
 *     description: |
 *       Converts, stores, and immediately sends the payload to the notification
 *       server configured via NOTIFY_SERVER_URL / NOTIFY_API_KEY env vars.
 *     tags:
 *       - WhatsApp Send
 *     security:
 *       - bearerAuth: []
 */
router.post("/send", async (req: AuthRequest, res: Response) => {
  try {
    const { event_type, recipients, blocks, field_values, attachments, client_id } =
      req.body as WhatsAppSendInput;

    if (!event_type) {
      res.status(400).json({ error: "event_type is required" });
      return;
    }
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      res.status(400).json({ error: "recipients array is required and must not be empty" });
      return;
    }
    if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
      res.status(400).json({ error: "blocks array is required and must not be empty" });
      return;
    }

    const { id, notifyPayload, notifyResponse } = await whatsappSendService.convertStoreAndSend(
      auditContext(req),
      { event_type, client_id, recipients, blocks, field_values, attachments },
    );

    const statusCode = notifyResponse.ok ? 200 : 502;
    res.status(statusCode).json({
      id,
      notify_payload: notifyPayload,
      notify_response: notifyResponse,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/whatsapp-send/preview:
 *   post:
 *     summary: Preview the notification payload without storing
 *     tags:
 *       - WhatsApp Send
 *     security:
 *       - bearerAuth: []
 */
router.post("/placeholder-manifest", async (req: AuthRequest, res: Response) => {
  try {
    const { blocks } = req.body as { blocks?: unknown };
    if (!blocks || !Array.isArray(blocks)) {
      res.status(400).json({ error: "blocks array is required" });
      return;
    }
    const manifest = whatsappSendService.collectPlaceholderKeysFromBlocks(
      blocks as WhatsAppSendInput["blocks"],
    );
    res.status(200).json(manifest);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post("/send-batch", async (req: AuthRequest, res: Response) => {
  try {
    const { event_type, client_id, blocks, attachments, rows } =
      req.body as WhatsAppBatchSendInput;

    if (!event_type) {
      res.status(400).json({ error: "event_type is required" });
      return;
    }
    if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
      res.status(400).json({ error: "blocks array is required and must not be empty" });
      return;
    }
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: "rows array is required and must not be empty" });
      return;
    }
    for (const r of rows) {
      if (!r.user_id || !r.wa_number) {
        res.status(400).json({ error: "Each row must include user_id and wa_number" });
        return;
      }
    }

    const { results } = await whatsappSendService.convertStoreAndSendBatch(
      auditContext(req),
      { event_type, client_id, blocks, attachments, rows },
    );

    res.status(200).json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post("/preview", async (req: AuthRequest, res: Response) => {
  try {
    const { event_type, client_id, recipients, blocks, field_values, attachments } =
      req.body as WhatsAppSendInput;

    if (!event_type || !recipients || !blocks) {
      res.status(400).json({ error: "event_type, recipients, and blocks are required" });
      return;
    }

    const notifyPayload = whatsappSendService.buildNotifyPayload({
      event_type,
      client_id,
      recipients,
      blocks,
      field_values,
      attachments,
    });

    await whatsappSendService.finalizeNotifyPayload(req.user!.id, notifyPayload);

    res.status(200).json({ notify_payload: notifyPayload });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * Prior successful WhatsApp recipients for this content’s publish event (deduped by user_id + number).
 */
router.get("/prior-recipients", async (req: AuthRequest, res: Response) => {
  try {
    const contentId = typeof req.query.contentId === "string" ? req.query.contentId.trim() : "";
    if (!contentId) {
      res.status(400).json({ error: "contentId query parameter is required" });
      return;
    }

    const detail = await contentService.getById(contentId, {
      id: req.user!.id,
      isAdmin: req.user?.role === "ADMIN",
    });
    if (detail == null) {
      res.status(404).json({ error: "Content not found" });
      return;
    }
    if ("forbidden" in detail && detail.forbidden) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const items = await whatsappSendService.listPriorSentRecipientsForContent(contentId);
    res.status(200).json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/whatsapp-send/requests:
 *   get:
 *     summary: List send requests for the authenticated user
 *     tags:
 *       - WhatsApp Send
 *     security:
 *       - bearerAuth: []
 */
router.get("/requests", async (req: AuthRequest, res: Response) => {
  try {
    const limit = Number.parseInt(req.query.limit as string) || 20;
    const offset = Number.parseInt(req.query.offset as string) || 0;
    const records = await whatsappSendService.listByUser(req.user!.id, { limit, offset });
    res.status(200).json(records);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/whatsapp-send/requests/{id}:
 *   get:
 *     summary: Get a specific send request by ID
 *     tags:
 *       - WhatsApp Send
 *     security:
 *       - bearerAuth: []
 */
router.get("/requests/:id", async (req: AuthRequest, res: Response) => {
  try {
    const record = await whatsappSendService.getById(req.params.id);
    if (!record) {
      res.status(404).json({ error: "Send request not found" });
      return;
    }
    res.status(200).json(record);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/whatsapp-send/requests/{id}/status:
 *   patch:
 *     summary: Update the status of a send request (after forwarding to notification server)
 *     tags:
 *       - WhatsApp Send
 *     security:
 *       - bearerAuth: []
 */
router.patch("/requests/:id/status", async (req: AuthRequest, res: Response) => {
  try {
    const { status, failure_message } = req.body as {
      status?: "SENT" | "FAILED";
      failure_message?: string;
    };

    if (!status || !["SENT", "FAILED"].includes(status)) {
      res.status(400).json({ error: "status must be SENT or FAILED" });
      return;
    }

    const record = await whatsappSendService.getById(req.params.id);
    if (!record) {
      res.status(404).json({ error: "Send request not found" });
      return;
    }

    const updated = await whatsappSendService.markStatus(
      req.params.id,
      status,
      failure_message,
    );
    res.status(200).json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
