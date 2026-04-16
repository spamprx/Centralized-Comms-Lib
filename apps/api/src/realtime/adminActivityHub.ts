import { EventEmitter } from "node:events";

/** Admin SSE payload: at least one of `lastActiveAt` or `presencePingAt` is set per event. */
export type AdminUserActivityPayload = {
  type: "user_last_active";
  userId: string;
  lastActiveAt?: string;
  presencePingAt?: string | null;
};

const hub = new EventEmitter();
hub.setMaxListeners(250);

export function emitAdminUserActivity(update: {
  userId: string;
  lastActiveAt?: Date;
  presencePingAt?: Date;
  /** When true, broadcast `presencePingAt: null` (logout / explicit offline). */
  clearPresencePing?: boolean;
}): void {
  const payload: AdminUserActivityPayload = {
    type: "user_last_active",
    userId: update.userId,
    ...(update.lastActiveAt !== undefined && {
      lastActiveAt: update.lastActiveAt.toISOString(),
    }),
    ...(update.clearPresencePing && { presencePingAt: null }),
    ...(update.presencePingAt !== undefined &&
      !update.clearPresencePing && {
        presencePingAt: update.presencePingAt.toISOString(),
      }),
  };
  hub.emit("tick", payload);
}

/** @deprecated Prefer emitAdminUserActivity — kept for call sites that only touch lastActiveAt */
export function emitUserLastActive(userId: string, lastActiveAt: Date): void {
  emitAdminUserActivity({ userId, lastActiveAt });
}

export function subscribeUserLastActive(
  listener: (payload: AdminUserActivityPayload) => void,
): () => void {
  hub.on("tick", listener);
  return () => {
    hub.off("tick", listener);
  };
}
