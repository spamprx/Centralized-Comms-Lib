import { getPrismaClient } from "../repository";

type PresenceUser = {
  userId: string;
  email: string;
  displayName: string;
  /** Epoch ms */
  lastSeenAtMs: number;
  /** Distinct websocket connections (multi-tab support). */
  connections: Set<string>;
};

export type PresenceSnapshotUser = {
  userId: string;
  email: string;
  displayName: string;
};

const PRESENCE_TTL_MS = 60_000;
const PRESENCE_SWEEP_MS = 10_000;
// When a socket disconnects (refresh, network blip), keep the user visible briefly to avoid a “session empty” gap.
const DISCONNECT_GRACE_MS = 15_000;

function nowMs(): number {
  return Date.now();
}

/**
 * Phase 1 presence: in-memory store with TTL.
 * - Accurate for a single API instance.
 * - For multi-pod (k8s), replace this with a shared store (e.g. Redis) + pub/sub.
 */
export class InMemoryEditorPresenceStore {
  private readonly byContent = new Map<string, Map<string, PresenceUser>>();

  constructor() {
    setInterval(() => this.sweepExpired(), PRESENCE_SWEEP_MS).unref();
  }

  private sweepExpired(): void {
    const t = nowMs();
    for (const [contentId, users] of this.byContent.entries()) {
      for (const [userId, u] of users.entries()) {
        if (t - u.lastSeenAtMs > PRESENCE_TTL_MS) {
          users.delete(userId);
        }
      }
      if (users.size === 0) this.byContent.delete(contentId);
    }
  }

  touch(contentId: string, user: { id: string; email: string; displayName: string }, connId: string) {
    const users = this.byContent.get(contentId) ?? new Map<string, PresenceUser>();
    const existing = users.get(user.id);
    const next: PresenceUser = existing
      ? {
          ...existing,
          email: user.email,
          displayName: user.displayName,
          lastSeenAtMs: nowMs(),
        }
      : {
          userId: user.id,
          email: user.email,
          displayName: user.displayName,
          lastSeenAtMs: nowMs(),
          connections: new Set<string>(),
        };
    next.connections.add(connId);
    users.set(user.id, next);
    this.byContent.set(contentId, users);
  }

  leave(
    contentId: string,
    userId: string,
    connId: string,
    opts?: { force?: boolean },
  ): void {
    const users = this.byContent.get(contentId);
    if (!users) return;
    const u = users.get(userId);
    if (!u) return;
    u.connections.delete(connId);
    if (u.connections.size === 0) {
      if (opts?.force) {
        // Explicit “leave editor” should remove immediately.
        users.delete(userId);
      } else {
        // Disconnect should keep presence briefly to survive refresh / reconnect.
        u.lastSeenAtMs = nowMs();
        users.set(userId, u);
      }
    } else users.set(userId, u);
    if (users.size === 0) this.byContent.delete(contentId);
  }

  list(contentId: string): PresenceSnapshotUser[] {
    const users = this.byContent.get(contentId);
    if (!users) return [];
    const t = nowMs();
    const out: PresenceSnapshotUser[] = [];
    for (const u of users.values()) {
      const ageMs = t - u.lastSeenAtMs;
      const keepDisconnected = u.connections.size === 0 && ageMs <= DISCONNECT_GRACE_MS;
      if (ageMs <= PRESENCE_TTL_MS && (u.connections.size > 0 || keepDisconnected)) {
        out.push({ userId: u.userId, email: u.email, displayName: u.displayName });
      }
    }
    return out;
  }

  isCollaborationActive(contentId: string, requesterId: string): boolean {
    return this.list(contentId).some((u) => u.userId !== requesterId);
  }
}

export const editorPresenceStore = new InMemoryEditorPresenceStore();

export async function userMayJoinEditorPresence(
  contentId: string,
  userId: string,
  isAdmin: boolean,
): Promise<boolean> {
  if (isAdmin) return true;
  const prisma = getPrismaClient();
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    select: { authorId: true },
  });
  if (!content) return false;
  if (content.authorId === userId) return true;
  const co = await prisma.contentCoAuthor.findUnique({
    where: { contentId_userId: { contentId, userId } },
    select: { status: true },
  });
  return co?.status === "ACCEPTED";
}

