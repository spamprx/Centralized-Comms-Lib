import { Router } from "express";

import { applicationDomainRouters } from "./domainRouters";

/**
 * Application layer route registration.
 * Keeps endpoint contracts stable while decoupling gateway composition from feature routing.
 */
export function registerProtectedRoutes(router: Router): void {
  router.use("/content", applicationDomainRouters.content);
  router.use("/tags", applicationDomainRouters.tag);
  router.use("/reviews", applicationDomainRouters.review);
  router.use("/admin", applicationDomainRouters.admin);
  router.use("/analytics", applicationDomainRouters.analytics);
  router.use("/channels", applicationDomainRouters.channel);
  router.use("/templates", applicationDomainRouters.template);
  router.use("/search", applicationDomainRouters.search);
  router.use("/components", applicationDomainRouters.component);
  router.use("/citations", applicationDomainRouters.citation);
}
