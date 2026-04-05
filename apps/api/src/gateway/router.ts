import { Router } from "express";

import { sanitize } from "./middleware/sanitize.middleware";
import { rateLimiter, authRateLimiter } from "./middleware/rateLimit.middleware";
import { authenticate } from "./middleware/auth.middleware";

import authRouter from "./routes/auth.routes";
import contentRouter from "./routes/content.routes";
import tagRouter from "./routes/tag.routes";
import reviewRouter from "./routes/review.routes";
import adminRouter from "./routes/admin.routes";
import analyticsRouter from "./routes/analytics.routes";
import channelRouter from "./routes/channel.routes";
import templateRouter from "./routes/template.routes";

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
router.use("/auth", authRateLimiter, authRouter);

/***
 * Layer 3 — Authentication
 * All routes below this line require a valid JWT.
 * Verifies the token and attaches req.user for downstream use.
 ***/
router.use(authenticate);

/*** Protected Routes ***/
router.use("/content", contentRouter);
router.use("/tags", tagRouter);
router.use("/reviews", reviewRouter);
router.use("/admin", adminRouter);
router.use("/analytics", analyticsRouter);
router.use("/channels", channelRouter);
router.use("/templates", templateRouter);

export default router;
