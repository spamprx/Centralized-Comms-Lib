import { Router } from "express";

import { sanitize } from "../../middlewares/sanitize.middleware";
import { rateLimiter } from "../../middlewares/rateLimit.middleware";
import { authenticate } from "../../middlewares/auth.middleware";
import { registerPublicRoutes } from "../../application/http/registerPublicRoutes";
import { registerProtectedRoutes } from "../../application/http/registerProtectedRoutes";

/**
 * Gateway layer:
 * - input sanitization
 * - generic throttling
 * - authn boundary before protected route registration
 */
export function createGatewayRouter(): Router {
  const router = Router();

  router.use(sanitize);
  router.use(rateLimiter);

  registerPublicRoutes(router);

  router.use(authenticate);
  registerProtectedRoutes(router);

  return router;
}
