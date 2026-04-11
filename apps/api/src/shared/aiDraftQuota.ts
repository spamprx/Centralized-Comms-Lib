import Redis from "ioredis";
import { getRedisClient } from "./cache/redisClient";

const USER_DAILY_LIMIT = parseInt(process.env.AI_DAILY_QUOTA ?? "50", 10);
const ORG_DAILY_LIMIT = parseInt(process.env.AI_ORG_DAILY_QUOTA ?? "0", 10);

function utcDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function secondsUntilUtcMidnight(): number {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return Math.max(60, Math.ceil((next.getTime() - now.getTime()) / 1000));
}

function retryAfterEpoch(ttlSec: number): number {
  return Math.floor(Date.now() / 1000) + ttlSec;
}

type MemBucket = { count: number; day: string };
const userMem = new Map<string, MemBucket>();
const orgMem = new Map<string, MemBucket>();

function memIncr(map: Map<string, MemBucket>, logicalKey: string, limit: number): { ok: boolean; used: number } {
  const day = utcDayKey();
  const k = `${logicalKey}:${day}`;
  let b = map.get(k);
  if (!b || b.day !== day) {
    b = { count: 0, day };
    map.set(k, b);
  }
  b.count += 1;
  return { ok: b.count <= limit, used: b.count };
}

async function redisIncrQuota(r: Redis, key: string, limit: number): Promise<{ ok: boolean; used: number; ttlSec: number }> {
  await r.connect().catch(() => undefined);
  const n = await r.incr(key);
  if (n === 1) {
    await r.expire(key, secondsUntilUtcMidnight());
  }
  const ttl = await r.ttl(key);
  const ttlSec = ttl > 0 ? ttl : secondsUntilUtcMidnight();
  return { ok: n <= limit, used: n, ttlSec };
}

const QUOTA_PREFIX = "comms:ai:quota";

export type AiQuotaErrorCode =
  | "AI_USER_QUOTA_EXCEEDED"
  | "AI_ORG_QUOTA_EXCEEDED"
  | "AI_QUOTA_UNAVAILABLE";

export type AiQuotaErrorBody = {
  error: string;
  code: AiQuotaErrorCode;
  limit: number;
  scope: "user" | "org" | "system";
  retryAfter: number;
};

export type AiDraftQuotaSuccess = {
  ok: true;
  userLimit: number;
  userRemaining: number;
  orgLimit: number | null;
  orgRemaining: number | null;
  retryAfter: number;
};

export type AiDraftQuotaFailure = {
  ok: false;
  status: number;
  body: AiQuotaErrorBody;
};

export type AiDraftQuotaResult = AiDraftQuotaSuccess | AiDraftQuotaFailure;

function successPayload(
  userRemaining: number,
  orgRemaining: number | null,
  orgLimit: number | null,
  ttlSec: number,
): AiDraftQuotaSuccess {
  return {
    ok: true,
    userLimit: USER_DAILY_LIMIT,
    userRemaining: Math.max(0, userRemaining),
    orgLimit,
    orgRemaining: orgRemaining != null ? Math.max(0, orgRemaining) : null,
    retryAfter: retryAfterEpoch(ttlSec),
  };
}

/**
 * Per-user (UTC day) and optional per-workspace/org caps for AI-assisted draft creation.
 * Org quota is off when `AI_ORG_DAILY_QUOTA` ≤ 0.
 */
export async function tryConsumeAiDraftQuota(userId: string, orgWorkspaceId: string): Promise<AiDraftQuotaResult> {
  const day = utcDayKey();
  const userKeyRedis = `${QUOTA_PREFIX}:user:${userId}:${day}`;
  const orgKeyRedis = `${QUOTA_PREFIX}:org:${orgWorkspaceId}:${day}`;
  const orgLimitActive = ORG_DAILY_LIMIT > 0;
  const defaultTtl = secondsUntilUtcMidnight();

  const r = getRedisClient();
  if (!r) {
    const u = memIncr(userMem, userId, USER_DAILY_LIMIT);
    if (!u.ok) {
      return {
        ok: false,
        status: 429,
        body: {
          error: "Daily AI user quota exceeded.",
          code: "AI_USER_QUOTA_EXCEEDED",
          limit: USER_DAILY_LIMIT,
          scope: "user",
          retryAfter: retryAfterEpoch(defaultTtl),
        },
      };
    }
    if (orgLimitActive) {
      const o = memIncr(orgMem, orgWorkspaceId, ORG_DAILY_LIMIT);
      if (!o.ok) {
        return {
          ok: false,
          status: 429,
          body: {
            error: "Daily AI organization quota exceeded.",
            code: "AI_ORG_QUOTA_EXCEEDED",
            limit: ORG_DAILY_LIMIT,
            scope: "org",
            retryAfter: retryAfterEpoch(defaultTtl),
          },
        };
      }
      return successPayload(USER_DAILY_LIMIT - u.used, ORG_DAILY_LIMIT - o.used, ORG_DAILY_LIMIT, defaultTtl);
    }
    return successPayload(USER_DAILY_LIMIT - u.used, null, null, defaultTtl);
  }

  try {
    const uq = await redisIncrQuota(r, userKeyRedis, USER_DAILY_LIMIT);
    if (!uq.ok) {
      return {
        ok: false,
        status: 429,
        body: {
          error: "Daily AI user quota exceeded.",
          code: "AI_USER_QUOTA_EXCEEDED",
          limit: USER_DAILY_LIMIT,
          scope: "user",
          retryAfter: retryAfterEpoch(uq.ttlSec),
        },
      };
    }
    if (orgLimitActive) {
      const oq = await redisIncrQuota(r, orgKeyRedis, ORG_DAILY_LIMIT);
      if (!oq.ok) {
        return {
          ok: false,
          status: 429,
          body: {
            error: "Daily AI organization quota exceeded.",
            code: "AI_ORG_QUOTA_EXCEEDED",
            limit: ORG_DAILY_LIMIT,
            scope: "org",
            retryAfter: retryAfterEpoch(oq.ttlSec),
          },
        };
      }
      return successPayload(USER_DAILY_LIMIT - uq.used, ORG_DAILY_LIMIT - oq.used, ORG_DAILY_LIMIT, oq.ttlSec);
    }
    return successPayload(USER_DAILY_LIMIT - uq.used, null, null, uq.ttlSec);
  } catch {
    return {
      ok: false,
      status: 503,
      body: {
        error: "Quota service unavailable. Try again later.",
        code: "AI_QUOTA_UNAVAILABLE",
        limit: USER_DAILY_LIMIT,
        scope: "system",
        retryAfter: retryAfterEpoch(60),
      },
    };
  }
}
