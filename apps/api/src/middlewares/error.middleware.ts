import type { Request, Response, NextFunction } from "express";

/**
 * Global Express error handler (DISHA: `error.middleware.ts`).
 */
export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error(err.stack);
  res.status(500).json({ error: err.message || "Internal Server Error" });
}
