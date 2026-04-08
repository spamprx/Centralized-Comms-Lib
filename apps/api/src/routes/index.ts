import { Router } from "express";

import { sanitize } from "../middlewares/sanitize.middleware";
import { rateLimiter, authRateLimiter } from "../middlewares/rateLimit.middleware";
import { authenticate } from "../middlewares/auth.middleware";

import authRouter from "../modules/auth/auth.routes";
import contentRouter from "../modules/content/content.routes";
import tagRouter from "../modules/tag/tag.routes";
import reviewRouter from "../modules/review/review.routes";
import adminRouter from "../modules/admin/admin.routes";
import analyticsRouter from "../modules/analytics/analytics.routes";
import channelRouter from "../modules/channel/channel.routes";
import templateRouter from "../modules/template/template.routes";
import searchRouter from "../modules/search/search.routes";
import componentRouter from "../modules/component/component.routes";
import citationRouter from "../modules/citation/citation.routes";

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
router.use("/search", searchRouter);
router.use("/components", componentRouter);
router.use("/citations", citationRouter);

export default router;
