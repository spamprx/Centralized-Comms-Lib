import http from "node:http";
import jwt from "jsonwebtoken";
import { WebSocketServer, type WebSocket } from "ws";
import { getPrismaClient } from "../repository";
import {
  editorPresenceStore,
  userMayJoinEditorPresence,
  type PresenceSnapshotUser,
} from "./editorPresenceStore";

type JwtPayload = { id: string; email: string; role: "USER" | "ADMIN" };

type ClientMsg =
  | { type: "presence:join"; contentId: string }
  | { type: "presence:leave"; contentId: string }
  | { type: "presence:ping"; contentId: string };

type ServerMsg =
  | {
      type: "presence:update";
      contentId: string;
      users: PresenceSnapshotUser[];
    }
  | {
      type: "presence:restore_requested";
      contentId: string;
      requestedBy: { userId: string; email: string; displayName: string };
    }
  | { type: "presence:error"; message: string; status?: number };

const JWT_SECRET_RAW = process.env.JWT_SECRET;
if (!JWT_SECRET_RAW)
  throw new Error("JWT_SECRET is not defined in environment");
const JWT_SECRET: string = JWT_SECRET_RAW;

const JWT_VERIFY_OPTIONS: jwt.VerifyOptions = {
  algorithms: ["HS256"],
  ...(process.env.JWT_ISSUER && { issuer: process.env.JWT_ISSUER }),
  ...(process.env.JWT_AUDIENCE && { audience: process.env.JWT_AUDIENCE }),
};

function safeJsonParse(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function isJwtPayload(x: unknown): x is JwtPayload {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.email === "string" &&
    (o.role === "USER" || o.role === "ADMIN")
  );
}

function send(ws: WebSocket, msg: ServerMsg): void {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(msg));
}

function broadcast(
  contentId: string,
  msg: ServerMsg,
  peers: Set<WebSocket>,
): void {
  const payload = JSON.stringify(msg);
  for (const ws of peers) {
    if (ws.readyState === ws.OPEN) ws.send(payload);
  }
}

/**
 * Phase 1: WebSocket presence for editor Activity panel.
 * Auth: `ws://.../ws?token=JWT`
 */
export function attachWebsocketServer(server: http.Server): void {
  const wss = new WebSocketServer({ server, path: "/ws" });

  // Room membership: contentId -> sockets
  const rooms = new Map<string, Set<WebSocket>>();
  // Expose rooms to HTTP routes (best-effort notifications).
  wsRooms = rooms;
  const socketConnId = new WeakMap<WebSocket, string>();
  const socketUser = new WeakMap<WebSocket, JwtPayload>();
  const socketJoinedContent = new WeakMap<WebSocket, Set<string>>();

  const mkConnId = (): string =>
    `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

  const addToRoom = (contentId: string, ws: WebSocket): void => {
    const set = rooms.get(contentId) ?? new Set<WebSocket>();
    set.add(ws);
    rooms.set(contentId, set);
  };

  const removeFromRoom = (contentId: string, ws: WebSocket): void => {
    const set = rooms.get(contentId);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) rooms.delete(contentId);
  };

  const publishUpdate = (contentId: string): void => {
    const peers = rooms.get(contentId);
    if (!peers) return;
    broadcast(
      contentId,
      {
        type: "presence:update",
        contentId,
        users: editorPresenceStore.list(contentId),
      },
      peers,
    );
  };

  wss.on("connection", async (ws, req) => {
    const url = new URL(req.url ?? "", "http://localhost");
    const token = url.searchParams.get("token") ?? "";
    let payload: JwtPayload | null = null;
    try {
      const decoded = jwt.verify(token, JWT_SECRET, JWT_VERIFY_OPTIONS);
      payload = isJwtPayload(decoded) ? decoded : null;
    } catch {
      send(ws, {
        type: "presence:error",
        message: "Unauthorized",
        status: 401,
      });
      ws.close();
      return;
    }
    if (!payload) {
      send(ws, {
        type: "presence:error",
        message: "Unauthorized",
        status: 401,
      });
      ws.close();
      return;
    }

    // Prevent downstream FK crashes if the DB was reset but the client holds an old JWT.
    const dbUser = await getPrismaClient().user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, displayName: true },
    });
    if (!dbUser) {
      send(ws, {
        type: "presence:error",
        message: "User not found",
        status: 401,
      });
      ws.close();
      return;
    }

    const connId = mkConnId();
    socketConnId.set(ws, connId);
    socketUser.set(ws, payload);
    socketJoinedContent.set(ws, new Set<string>());

    ws.on("message", async (raw) => {
      const text = typeof raw === "string" ? raw : raw.toString("utf8");
      const parsed = safeJsonParse(text);
      if (!parsed || typeof parsed !== "object") return;
      const msg = parsed as Partial<ClientMsg>;
      if (typeof msg.type !== "string" || typeof msg.contentId !== "string")
        return;

      const contentId = msg.contentId;
      const isAdmin = payload.role === "ADMIN";

      // Validate access before joining/touching.
      const allowed = await userMayJoinEditorPresence(
        contentId,
        payload.id,
        isAdmin,
      );
      if (!allowed) {
        send(ws, {
          type: "presence:error",
          message: "Forbidden",
          status: 403,
        });
        return;
      }

      if (msg.type === "presence:join" || msg.type === "presence:ping") {
        // Touch updates TTL and registers this connection.
        editorPresenceStore.touch(
          contentId,
          {
            id: dbUser.id,
            email: dbUser.email,
            displayName: dbUser.displayName,
          },
          connId,
        );
        addToRoom(contentId, ws);
        socketJoinedContent.get(ws)!.add(contentId);
        publishUpdate(contentId);
        return;
      }

      if (msg.type === "presence:leave") {
        editorPresenceStore.leave(contentId, payload.id, connId, {
          force: true,
        });
        removeFromRoom(contentId, ws);
        socketJoinedContent.get(ws)!.delete(contentId);
        publishUpdate(contentId);
      }
    });

    ws.on("close", () => {
      const joined = socketJoinedContent.get(ws);
      if (!joined) return;
      for (const contentId of joined.values()) {
        editorPresenceStore.leave(contentId, payload.id, connId, {
          force: false,
        });
        removeFromRoom(contentId, ws);
        publishUpdate(contentId);
      }
    });
  });
}

let wsRooms: Map<string, Set<WebSocket>> | null = null;

/** Best-effort server-initiated broadcast to all sockets in a content room. */
export function broadcastToContentRoom(
  contentId: string,
  msg: ServerMsg,
): void {
  const rooms = wsRooms;
  if (!rooms) return;
  const peers = rooms.get(contentId);
  if (!peers) return;
  broadcast(contentId, msg, peers);
}
