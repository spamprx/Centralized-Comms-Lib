import { Router, Response } from "express";

import type { AuthRequest } from "../../middlewares/auth.middleware";
import { whatsappSendService } from "../whatsapp-send/whatsappSend.service";
import {
  emailSendService,
  type EmailSendInput,
} from "./emailSend.service";

const router = Router();

function validateRecipients(input: EmailSendInput, res: Response): boolean {
  if (!Array.isArray(input.recipients) || input.recipients.length === 0) {
    res
      .status(400)
      .json({ error: "recipients array is required and must not be empty" });
    return false;
  }
  for (const r of input.recipients) {
    if (!r.user_id || !r.email) {
      res
        .status(400)
        .json({ error: "Each recipient must include user_id and email" });
      return false;
    }
  }
  return true;
}

/**
 * @openapi
 * /api/v1/email-send/preview:
 *   post:
 *     summary: Preview the email notification payload without sending
 *     tags:
 *       - Email Send
 *     security:
 *       - bearerAuth: []
 */
router.post("/preview", async (req: AuthRequest, res: Response) => {
  try {
    const input = req.body as EmailSendInput;
    if (!input.event_type) {
      res.status(400).json({ error: "event_type is required" });
      return;
    }
    if (!Array.isArray(input.blocks) || input.blocks.length === 0) {
      res
        .status(400)
        .json({ error: "blocks array is required and must not be empty" });
      return;
    }
    if (!validateRecipients(input, res)) return;

    const notifyPayload = emailSendService.buildNotifyPayload(input);
    res.status(200).json({ notify_payload: notifyPayload });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/email-send/send:
 *   post:
 *     summary: Convert TipTap content and send via email through notification server
 *     tags:
 *       - Email Send
 *     security:
 *       - bearerAuth: []
 */
router.post("/send", async (req: AuthRequest, res: Response) => {
  try {
    const input = req.body as EmailSendInput;
    if (!input.event_type) {
      res.status(400).json({ error: "event_type is required" });
      return;
    }
    if (!Array.isArray(input.blocks) || input.blocks.length === 0) {
      res
        .status(400)
        .json({ error: "blocks array is required and must not be empty" });
      return;
    }
    if (!validateRecipients(input, res)) return;

    const notifyPayload = emailSendService.buildNotifyPayload(input);
    // Register MinIO / private URLs with notification-framework media (same as WhatsApp) so
    // SendGrid can download attachments; mutates payload.content.attachments in place.
    await whatsappSendService.finalizeNotifyPayload(
      req.user!.id,
      notifyPayload as unknown as Parameters<
        typeof whatsappSendService.finalizeNotifyPayload
      >[1],
    );
    const notifyResponse = await emailSendService.sendToNotify(notifyPayload);
    res.status(notifyResponse.ok ? 200 : 502).json({
      notify_payload: notifyPayload,
      notify_response: notifyResponse,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
