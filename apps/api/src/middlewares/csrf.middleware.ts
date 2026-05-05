import type { Request, Response, NextFunction } from "express";
import { CSRF_TOKEN_COOKIE } from "../shared/authCookies";

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Double-submit CSRF: mutating requests must send `X-CSRF-Token` matching the
 * non-HttpOnly `csrf_token` cookie set at login/register.
 */
export function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (SAFE.has(req.method)) {
    next();
    return;
  }
  const cookieVal = req.cookies?.[CSRF_TOKEN_COOKIE] as string | undefined;
  const headerVal = req.headers["x-csrf-token"];
  let header = "";
  if (typeof headerVal === "string") header = headerVal;
  else if (Array.isArray(headerVal) && headerVal[0]) header = headerVal[0];
  if (
    !cookieVal ||
    !header ||
    cookieVal.length < 8 ||
    header.length < 8 ||
    cookieVal !== header
  ) {
    res.status(403).json({
      error: "CSRF token missing or invalid",
      code: "CSRF_FAILED",
    });
    return;
  }
  next();
}
