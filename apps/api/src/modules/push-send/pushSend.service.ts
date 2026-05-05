import { JWT } from "google-auth-library";
import { getFirebaseServiceAccountEnv } from "../../config/firebaseAdminEnv";
import type { ContentBlock } from "../whatsapp-send/whatsappSend.service";
import { getPrismaClient } from "../../repository";

type PushRecipient = {
  user_id: string;
};

export type PushSendInput = {
  event_type: string;
  recipients: PushRecipient[];
  blocks: ContentBlock[];
  field_values?: Record<string, string>;
  title?: string;
};

type SendResult = {
  userId: string;
  deviceId: string;
  ok: boolean;
  status: number;
  responseBody: unknown;
};

const MAX_BODY_LENGTH = 240;
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const FCM_BASE = "https://fcm.googleapis.com/v1/projects";

let authClient: JWT | null = null;

function ensureAuthClient(): JWT {
  if (authClient) return authClient;
  const env = getFirebaseServiceAccountEnv();
  if (!env) {
    throw new Error(
      "Firebase admin credentials are not configured. Set FIREBASE_SERVICE_ACCOUNT_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL, and FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY.",
    );
  }
  authClient = new JWT({
    email: env.clientEmail,
    key: env.privateKey,
    scopes: [FCM_SCOPE],
  });
  return authClient;
}

function resolveFieldTokens(
  input: string,
  fieldValues: Record<string, string>,
): string {
  return input.replace(/\{\{(\w+)\}\}/g, (_, key) => fieldValues[key] ?? `{{${key}}}`);
}

function collectTextSegments(node: unknown, out: string[]): void {
  if (typeof node === "string") {
    const text = node.trim();
    if (text.length > 0) out.push(text);
    return;
  }
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectTextSegments(item, out);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (typeof obj.text === "string" && obj.text.trim().length > 0) {
    out.push(obj.text.trim());
  }
  // Walk every nested value so we can parse rich text payloads regardless of exact shape.
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") {
      collectTextSegments(value, out);
    }
  }
}

function blocksToPushBody(
  blocks: ContentBlock[],
  fieldValues: Record<string, string>,
): string {
  const segments: string[] = [];
  collectTextSegments(blocks, segments);
  const raw = resolveFieldTokens(segments.join(" ").trim(), fieldValues);
  const compact = raw.replace(/\s+/g, " ").trim();
  if (!compact) {
    const fieldFallback = Object.values(fieldValues)
      .map((v) => v.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (fieldFallback) {
      return fieldFallback.length > MAX_BODY_LENGTH
        ? `${fieldFallback.slice(0, MAX_BODY_LENGTH - 1)}…`
        : fieldFallback;
    }
    return "You have a new update.";
  }
  return compact.length > MAX_BODY_LENGTH
    ? `${compact.slice(0, MAX_BODY_LENGTH - 1)}…`
    : compact;
}

async function getAccessToken(): Promise<string> {
  const client = ensureAuthClient();
  try {
    const tokenResponse = await client.getAccessToken();
    const token =
      typeof tokenResponse === "string"
        ? tokenResponse
        : (tokenResponse?.token ?? null);
    if (!token || typeof token !== "string") {
      throw new Error("Empty access token response");
    }
    return token;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to get Firebase access token: ${detail}`);
  }
}

async function sendToFcm(
  projectId: string,
  accessToken: string,
  token: string,
  title: string,
  body: string,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const response = await fetch(`${FCM_BASE}/${projectId}/messages:send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      message: {
        token,
        notification: {
          title,
          body,
        },
        data: {
          title,
          body,
        },
        webpush: {
          notification: {
            title,
            body,
          },
        },
      },
    }),
  });
  const payload = await response.json().catch(() => null);
  return {
    ok: response.ok,
    status: response.status,
    body: payload,
  };
}

async function send(
  input: PushSendInput,
): Promise<{
  title: string;
  body: string;
  recipientCount: number;
  tokenCount: number;
  deliveredCount: number;
  failedCount: number;
  results: SendResult[];
}> {
  const env = getFirebaseServiceAccountEnv();
  if (!env) {
    throw new Error("Firebase admin env vars are missing");
  }
  const userIds = [...new Set(input.recipients.map((r) => r.user_id.trim()).filter(Boolean))];
  if (userIds.length === 0) {
    throw new Error("At least one recipient user_id is required");
  }

  const title = (input.title?.trim() || input.event_type.trim() || "New update").slice(0, 120);
  const body = blocksToPushBody(input.blocks, input.field_values ?? {});
  const prisma = getPrismaClient();
  await prisma.userPushNotification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: "PUSH_SENT",
      title,
      body,
      payload: {
        eventType: input.event_type,
      },
    })),
  });
  const tokens = await prisma.userDeviceFcmToken.findMany({
    where: { userId: { in: userIds } },
    select: {
      userId: true,
      deviceId: true,
      token: true,
    },
  });
  if (tokens.length === 0) {
    return {
      title,
      body,
      recipientCount: userIds.length,
      tokenCount: 0,
      deliveredCount: 0,
      failedCount: 0,
      results: [],
    };
  }

  const accessToken = await getAccessToken();
  const results: SendResult[] = [];
  for (const row of tokens) {
    const r = await sendToFcm(env.projectId, accessToken, row.token, title, body);
    results.push({
      userId: row.userId,
      deviceId: row.deviceId,
      ok: r.ok,
      status: r.status,
      responseBody: r.body,
    });
  }

  return {
    title,
    body,
    recipientCount: userIds.length,
    tokenCount: tokens.length,
    deliveredCount: results.filter((r) => r.ok).length,
    failedCount: results.filter((r) => !r.ok).length,
    results,
  };
}

export const pushSendService = {
  send,
};
