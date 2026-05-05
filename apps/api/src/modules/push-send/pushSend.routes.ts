import { Router, type Response } from "express";
import type { AuthRequest } from "../../middlewares/auth.middleware";
import { pushSendService, type PushSendInput } from "./pushSend.service";

const router = Router();

router.post("/send", async (req: AuthRequest, res: Response) => {
  try {
    const input = req.body as PushSendInput;
    if (!input.event_type?.trim()) {
      res.status(400).json({ error: "event_type is required" });
      return;
    }
    if (!Array.isArray(input.blocks) || input.blocks.length === 0) {
      res.status(400).json({ error: "blocks array is required and must not be empty" });
      return;
    }
    if (!Array.isArray(input.recipients) || input.recipients.length === 0) {
      res.status(400).json({ error: "recipients array is required and must not be empty" });
      return;
    }
    for (const r of input.recipients) {
      if (!r?.user_id || typeof r.user_id !== "string") {
        res.status(400).json({ error: "Each recipient must include user_id" });
        return;
      }
    }

    const out = await pushSendService.send(input);
    res.status(out.failedCount > 0 ? 207 : 200).json(out);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
