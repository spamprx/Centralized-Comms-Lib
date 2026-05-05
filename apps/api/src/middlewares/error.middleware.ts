import type { Request, Response, NextFunction } from "express";
import { AppError } from "../shared/errors/appError";
import { logger } from "../shared/logger/logger";

/**
 * Global Express error handler (DISHA: `error.middleware.ts`).
 */
export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.code ? { code: err.code } : {}),
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }
  if (err.message === "CORS blocked" || err.message === "Not allowed by CORS") {
    res.status(403).json({ error: "CORS blocked", code: "CORS_BLOCKED" });
    return;
  }
  logger.error(err.stack);
  res.status(500).json({ error: err.message || "Internal Server Error" });
}
