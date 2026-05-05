import { Router } from "express";

import { authRateLimiter } from "../../middlewares/rateLimit.middleware";
import { applicationDomainRouters } from "./domainRouters";

export function registerPublicRoutes(router: Router): void {
  router.use("/auth", authRateLimiter, applicationDomainRouters.auth);
  router.use("/", applicationDomainRouters.firebasePublic);
}
