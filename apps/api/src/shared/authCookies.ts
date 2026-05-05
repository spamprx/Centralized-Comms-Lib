import type { CookieOptions, Response } from "express";
import { randomBytes } from "node:crypto";

export const AUTH_TOKEN_COOKIE = "auth_token";
export const CSRF_TOKEN_COOKIE = "csrf_token";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function cookieBaseOptions(): Pick<
  CookieOptions,
  "httpOnly" | "sameSite" | "secure" | "path"
> {
  const secure =
    process.env.COOKIE_SECURE === "true" ||
    process.env.NODE_ENV === "production";
  return {
    path: "/",
    sameSite: "strict",
    secure,
    httpOnly: false,
  };
}

function authTokenCookieOptions(maxAgeMs: number): CookieOptions {
  const secure =
    process.env.COOKIE_SECURE === "true" ||
    process.env.NODE_ENV === "production";
  return {
    path: "/",
    sameSite: "strict",
    secure,
    httpOnly: true,
    maxAge: maxAgeMs,
  };
}

function csrfCookieOptions(maxAgeMs: number): CookieOptions {
  return {
    ...cookieBaseOptions(),
    httpOnly: false,
    maxAge: maxAgeMs,
  };
}

export function setAuthCookies(
  res: Response,
  jwt: string,
  maxAgeMs = ONE_DAY_MS,
): void {
  const csrf = randomBytes(32).toString("hex");
  res.cookie(AUTH_TOKEN_COOKIE, jwt, authTokenCookieOptions(maxAgeMs));
  res.cookie(CSRF_TOKEN_COOKIE, csrf, csrfCookieOptions(maxAgeMs));
}

export function clearAuthCookies(res: Response): void {
  const secure =
    process.env.COOKIE_SECURE === "true" ||
    process.env.NODE_ENV === "production";
  res.clearCookie(AUTH_TOKEN_COOKIE, { path: "/", secure, sameSite: "strict" });
  res.clearCookie(CSRF_TOKEN_COOKIE, { path: "/", secure, sameSite: "strict" });
}
