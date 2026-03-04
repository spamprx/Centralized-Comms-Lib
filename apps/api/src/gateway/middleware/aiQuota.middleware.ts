import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";

interface QuotaEntry {
    used: number;
    resetAt: number; // unix timestamp ms
}

// Configurable via environment
const DAILY_QUOTA = parseInt(process.env.AI_DAILY_QUOTA ?? "50", 10);

const QUOTA_WINDOW_MS = parseInt(
    process.env.AI_QUOTA_WINDOW_MS ?? String(24 * 60 * 60 * 1000),
    10,
);

// FUTURE: Replace in-memory store with Redis
const quotaStore = new Map<string, QuotaEntry>();

// Periodically sweep expired entries to prevent unbounded memory growth.
// Runs once per quota window (default: every 24 hours).
setInterval(() => {
    const now = Date.now();
    for (const [userId, entry] of quotaStore) 
    {
        if (now >= entry.resetAt) quotaStore.delete(userId);
    }
}, QUOTA_WINDOW_MS).unref();

function getQuotaEntry(userId: string): QuotaEntry 
{
    const now = Date.now();
    const entry = quotaStore.get(userId);

    // No entry or window has expired — start fresh
    if (!entry || now >= entry.resetAt) 
    {
        const fresh: QuotaEntry = { used: 0, resetAt: now + QUOTA_WINDOW_MS };
        quotaStore.set(userId, fresh);
        return fresh;
    }

    return entry;
}

function resetTimestamp(resetAt: number): number 
{
    return Math.floor(resetAt / 1000);
}

// Enforces per-user daily AI request quota.
// Must run after authenticate — requires req.user to be set.
// Works alongside aiRateLimiter (rateLimit.middleware.ts) which caps burst per IP.
//
// Usage: router.post("/ai/generate", authenticate, aiQuotaEnforcer, handler)

export const aiQuotaEnforcer = (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): void => 
{
    if (!req.user) 
    {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    // TODO: ADMIN users are exempt from the daily quota cap.
    if (req.user.role === "ADMIN") 
    {
        next();
        return;
    }

    const userId = req.user.id;
    const entry = getQuotaEntry(userId);

    if (entry.used >= DAILY_QUOTA) 
    {
        res.status(429).json({
            error: "Daily AI quota exhausted.",
            limit: DAILY_QUOTA,
            retryAfter: resetTimestamp(entry.resetAt),
        });
        return;
    }

    entry.used += 1;
    quotaStore.set(userId, entry);

    res.setHeader("X-AI-Quota-Limit", DAILY_QUOTA);
    res.setHeader("X-AI-Quota-Remaining", DAILY_QUOTA - entry.used);
    res.setHeader("X-AI-Quota-Reset", resetTimestamp(entry.resetAt));

    next();
};
