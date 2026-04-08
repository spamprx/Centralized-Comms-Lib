import Redis from "ioredis";

let client: Redis | null | undefined;

export function getRedisClient(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    client = null;
    return client;
  }
  try {
    client = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
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
  const r = getRedisClient();
  if (!r) return;
  try {
    if (r.status !== "ready") await r.connect().catch(() => undefined);
    await r.set(key, value, "EX", ttlSec);
  } catch {
    /* ignore */
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
