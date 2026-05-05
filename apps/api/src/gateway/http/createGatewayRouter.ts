import { Router } from "express";

import { sanitize } from "../../middlewares/sanitize.middleware";
import { rateLimiter } from "../../middlewares/rateLimit.middleware";
import { authenticate } from "../../middlewares/auth.middleware";
import { recordUserActivity } from "../../middlewares/recordUserActivity.middleware";
import { aiQuotaEnforcer } from "../../middlewares/aiQuota.middleware";
import { csrfProtection } from "../../middlewares/csrf.middleware";
import { registerPublicRoutes } from "../../application/http/registerPublicRoutes";
import { registerProtectedRoutes } from "../../application/http/registerProtectedRoutes";
import { registerAiRoutes } from "../../application/http/registerAiRoutes";

/**
 * Gateway layer (SRS §3.4.4):
 * 1. Payload sanitization
 * 2. Generic rate limiting
 * 3. Public routes (no auth required)
 * 4. JWT authentication boundary
 * 5. User activity recording
 * 6. AI Quota Enforcement — applied to all /ai/* sub-routes before they reach
 *    the Application Layer (SRS requirement: quota checked at Gateway, not
 *    scattered inside individual module routes)
 * 7. Protected domain routes
 */
export function createGatewayRouter(): Router {
  const router = Router();

  router.use(sanitize);
  router.use(rateLimiter);

  registerPublicRoutes(router);

  router.use(authenticate);
  router.use(csrfProtection);
  router.use(recordUserActivity);

  // AI Quota Enforcement applied at Gateway Layer for all AI-routed requests.
  // The /ai prefix acts as the enforcement boundary; all AI feature endpoints
  // should be mounted here so quota is centralised at the gateway, not per-module.
  router.use("/ai", aiQuotaEnforcer, (req, res, next) => {
    registerAiRoutes(req, res, next);
  });

  registerProtectedRoutes(router);

  return router;
}
