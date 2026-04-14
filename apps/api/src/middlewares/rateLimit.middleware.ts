import rateLimit, {
  RateLimitRequestHandler,
  ipKeyGenerator,
} from "express-rate-limit";
import { Request, Response } from "express";

// FUTURE: Replace the default in-memory store with a Redis-backed store
//       (e.g. `rate-limit-redis`) so that limits are shared across all
//       API instances when running behind a load balancer or in a cluster.

/** Build a consistent 429 JSON response. `windowMs` drives the retryAfter value. */
function rateLimitResponse(message: string, windowMs: number) {
  return (_req: Request, res: Response) => {
    res.status(429).json({
      error: message,
      retryAfter: Math.ceil(windowMs / 1000), // seconds until window resets
    });
  };
}

/**
 * Extract the raw client IP from the request, preferring X-Forwarded-For
 * when behind a proxy, then pass it through ipKeyGenerator to normalize
 * IPv4-mapped IPv6 addresses (e.g. ::ffff:1.2.3.4 → 1.2.3.4).
 */
const makeKeyGenerator =
  () =>
  (req: Request): string =>
    ipKeyGenerator(
      (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ??
        req.ip ??
        req.socket.remoteAddress ??
        "unknown",
    );

const SKIP_PATHS = new Set(["/health"]);

const GENERAL_WINDOW_MS = 15 * 60 * 1000;

/***
 * General API limiter
 * 100 requests per 15 minutes per IP, applied to all routes.
 * FUTURE: back with a shared Redis store for multi-instance support.
 ***/
export const rateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: GENERAL_WINDOW_MS,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: makeKeyGenerator(),
  skip: (req) => SKIP_PATHS.has(req.path),
  handler: rateLimitResponse(
    "Too many requests. Please try again later.",
    GENERAL_WINDOW_MS,
  ),
});

const AUTH_WINDOW_MS = 15 * 60 * 1000;

/***
 * Auth route limiter
 * 10 requests per 15 minutes per IP — brute-force protection for
 * login / register / forgot-password endpoints.
 ***/
export const authRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: AUTH_WINDOW_MS,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: makeKeyGenerator(),
  handler: rateLimitResponse(
    "Too many authentication attempts. Please try again in 15 minutes.",
    AUTH_WINDOW_MS,
  ),
});

const AI_WINDOW_MS = 60 * 1000;

/***
 * AI route limiter
 * 10 requests per minute per IP — controls burst usage on AI endpoints.
 * Works alongside aiQuota.middleware.ts which enforces per-user daily quota.
 ***/
export const aiRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: AI_WINDOW_MS,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: makeKeyGenerator(),
  handler: rateLimitResponse(
    "AI request limit reached. Maximum 10 requests per minute.",
    AI_WINDOW_MS,
  ),
});
