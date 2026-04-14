import Redis from "ioredis";
import type { RedisOptions } from "ioredis";
import { redisPingMs, searchCacheWritesSkipped } from "../../observability/prometheusRegistry";

let client: Redis | null | undefined;

const MAX_CACHE_VALUE_BYTES = parseInt(process.env.SEARCH_CACHE_MAX_VALUE_BYTES ?? "262144", 10);

function buildRedisOptions(): RedisOptions {
  const connectTimeout = parseInt(process.env.REDIS_CONNECT_TIMEOUT_MS ?? "10000", 10);
  const commandTimeout = parseInt(process.env.REDIS_COMMAND_TIMEOUT_MS ?? "5000", 10);
  return {
    maxRetriesPerRequest: 2,
    lazyConnect: true,
    connectTimeout,
    commandTimeout,
    enableOfflineQueue: false,
  };
}

export function getRedisClient(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    client = null;
    return client;
  }
  try {
    client = new Redis(url, buildRedisOptions());
    return client;
  } catch {
    client = null;
    return client;
  }
}

export async function redisGet(key: string): Promise<string | null> {
  const r = getRedisClient();
  if (!r) return null;
  try {
    if (r.status !== "ready") await r.connect().catch(() => undefined);
    return await r.get(key);
  } catch {
    return null;
  }
}

export async function redisSet(key: string, value: string, ttlSec: number): Promise<void> {
  const byteLen = Buffer.byteLength(value, "utf8");
  if (byteLen > MAX_CACHE_VALUE_BYTES) {
    searchCacheWritesSkipped.inc({ reason: "oversize" });
    return;
  }
  const r = getRedisClient();
  if (!r) {
    searchCacheWritesSkipped.inc({ reason: "no_redis" });
    return;
  }
  try {
    if (r.status !== "ready") await r.connect().catch(() => undefined);
    await r.set(key, value, "EX", ttlSec);
  } catch {
    searchCacheWritesSkipped.inc({ reason: "error" });
  }
}

/** Invalidates logical search cache entries by incrementing a global epoch. */
export async function bumpSearchCacheEpoch(): Promise<void> {
  const r = getRedisClient();
  if (!r) return;
  try {
    if (r.status !== "ready") await r.connect().catch(() => undefined);
    await r.incr("comms:search:epoch");
  } catch {
    /* ignore */
  }
}

export async function getSearchCacheEpoch(): Promise<string> {
  const r = getRedisClient();
  if (!r) return "0";
  try {
    if (r.status !== "ready") await r.connect().catch(() => undefined);
    const v = await r.get("comms:search:epoch");
    return v ?? "0";
  } catch {
    return "0";
  }
}

export type RedisHealth = { ok: boolean; latencyMs: number; error?: string };

export async function getRedisHealth(): Promise<RedisHealth> {
  const r = getRedisClient();
  if (!r) {
    redisPingMs.set(-1);
    return { ok: false, latencyMs: -1, error: "REDIS_URL not set" };
  }
  const started = Date.now();
  try {
    if (r.status !== "ready") await r.connect();
    await r.ping();
    const ms = Date.now() - started;
    redisPingMs.set(ms);
    return { ok: true, latencyMs: ms };
  } catch (e) {
    redisPingMs.set(-1);
    return {
      ok: false,
      latencyMs: -1,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
