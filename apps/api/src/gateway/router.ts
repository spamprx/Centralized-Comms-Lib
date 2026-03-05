import { Router } from "express";

import { sanitize } from "./middleware/sanitize.middleware";
import { rateLimiter } from "./middleware/rateLimit.middleware";
import { authenticate } from "./middleware/auth.middleware";
import { aiQuotaEnforcer } from "./middleware/aiQuota.middleware";

// FUTURE: Import module routers as they are built

const router = Router();

/***
 * Layer 1 — Sanitize
 * Applied to every route: strips null bytes, escapes HTML, enforces
 * content-type and payload size limits, and blocks dangerous patterns.
 ***/
router.use(sanitize);

/***
 * Layer 2 — Rate Limit (General)
 * Applied to every route: 100 requests per 15 minutes per IP.
 * Skips /health automatically (configured inside rateLimiter).
 ***/
router.use(rateLimiter);

/***
 * Public Routes
 * No authentication required.
 * Auth routes get their own stricter rate limiter (10 req / 15 min).
 ***/

// FUTURE: router.use("/auth", authRateLimiter, authRouter);

/***
 * Layer 3 — Authentication
 * All routes below this line require a valid JWT.
 * Verifies the token and attaches req.user for downstream use.
 ***/
router.use(authenticate);

/*** Protected Routes ***/

// FUTURE: router.use("/content",  contentRouter);
// FUTURE: router.use("/workflow", workflowRouter);
// FUTURE: router.use("/assets",   assetRouter);
// FUTURE: router.use("/collab",   collabRouter);

/***
 * Layer 4 — AI Layer (Rate Limit + Daily Quota)
 * Burst cap (10 req / min per IP) via aiRateLimiter.
 * Daily per-user quota (default 50 req / 24 h) via aiQuotaEnforcer.
 * Both run after authenticate so req.user is available for quota tracking.
 ***/

// FUTURE: router.use("/ai", aiRateLimiter, aiQuotaEnforcer, aiRouter);

export default router;
