import type { NextFunction, Response } from "express";
import { getPrismaClient, PrismaUnitOfWork } from "../repository";
import { emitAdminUserActivity } from "../realtime/adminActivityHub";
import type { AuthRequest } from "./auth.middleware";

const THROTTLE_MS = 45_000;
const lastTouch = new Map<string, number>();

/**
 * After JWT auth, periodically persists `User.lastActiveAt` and notifies admin SSE subscribers.
 * Throttled per user to limit write load.
 */
export function recordUserActivity(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): void {
  const uid = req.user?.id;
  if (!uid || req.method === "OPTIONS") {
    next();
    return;
  }

  const now = Date.now();
  const prev = lastTouch.get(uid) ?? 0;
  if (now - prev < THROTTLE_MS) {
    next();
    return;
  }
  lastTouch.set(uid, now);

  void (async () => {
    try {
      const prisma = getPrismaClient();
      const uow = new PrismaUnitOfWork(prisma);
      const at = await uow.repos().userRole.touchLastActiveAt(uid);
      if (at) emitAdminUserActivity({ userId: uid, lastActiveAt: at });
    } catch {
      /* user removed or DB hiccup — ignore */
    }
  })();

  next();
}
