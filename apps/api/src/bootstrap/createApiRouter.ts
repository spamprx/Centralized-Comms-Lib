import { Router } from "express";

import { createGatewayRouter } from "../gateway/http/createGatewayRouter";

/**
 * Bootstrap composition root for API v1 router.
 */
export function createApiRouter(): Router {
  return createGatewayRouter();
}
