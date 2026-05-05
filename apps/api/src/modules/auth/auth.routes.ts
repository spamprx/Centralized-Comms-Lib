import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import {
  optionalAuthenticate,
  type AuthRequest,
  type UserRole,
} from "../../middlewares/auth.middleware";
import { authStrictLimiter } from "../../middlewares/rateLimit.middleware";
import { authService } from "../../service";
import { validatePayload } from "../../shared/validation";
import { AppError } from "../../shared/errors/appError";
import { clearAuthCookies, setAuthCookies } from "../../shared/authCookies";
import { loginBodySchema, registerBodySchema } from "./auth.schema";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_ISSUER = process.env.JWT_ISSUER;
const JWT_AUDIENCE = process.env.JWT_AUDIENCE;

function signToken(payload: {
  id: string;
  email: string;
  role: UserRole;
}): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "24h",
    algorithm: "HS256",
    ...(JWT_ISSUER && { issuer: JWT_ISSUER }),
    ...(JWT_AUDIENCE && { audience: JWT_AUDIENCE }),
  });
}

/**
 * @openapi
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user account
 *     tags:
 *       - Auth
 */
router.post(
  "/register",
  authStrictLimiter,
  async (req: Request, res: Response) => {
    try {
      const { email, displayName, password } = validatePayload(
        registerBodySchema,
        req.body,
      );
      const result = await authService.register(
        { ipAddress: req.ip, userAgent: req.headers["user-agent"] },
        { email, displayName, password },
      );
      if (result.conflict) {
        res.status(409).json({ error: "Email already registered" });
        return;
      }
      const token = signToken({
        id: result.user.id,
        email: result.user.email,
        role: "USER",
      });
      setAuthCookies(res, token);
      res.status(201).json({ user: result.user, role: "USER" as const });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({
          error: err.message,
          ...(err.code ? { code: err.code } : {}),
          ...(err.details !== undefined ? { details: err.details } : {}),
        });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     summary: Log in with email and password
 *     tags:
 *       - Auth
 */
router.post("/login", authStrictLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = validatePayload(loginBodySchema, req.body);
    const result = await authService.login(
      { ipAddress: req.ip, userAgent: req.headers["user-agent"] },
      { email, password },
    );
    if ("accountInactive" in result) {
      res.status(403).json({
        error:
          "This account has been deactivated. Contact an administrator if you need access.",
        code: "ACCOUNT_INACTIVE",
      });
      return;
    }
    if ("invalidCredentials" in result) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const { user, role } = result;
    const token = signToken({ id: user.id, email: user.email, role });
    setAuthCookies(res, token);
    res.status(200).json({ user, role });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        error: err.message,
        ...(err.code ? { code: err.code } : {}),
        ...(err.details !== undefined ? { details: err.details } : {}),
      });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * Session probe (cookie or Bearer). Returns 200 with `user: null` when not signed in,
 * so the SPA does not treat every visit as a 401 "No token provided".
 */
router.get("/me", optionalAuthenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(200).json({ user: null, role: null });
      return;
    }
    const data = await authService.getMe(req.user.id);
    if (!data) {
      res.status(401).json({ error: "Session invalid" });
      return;
    }
    res.status(200).json({ user: data.user, role: data.role });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/** Clear HttpOnly auth + CSRF cookies. */
router.post("/logout", (_req: Request, res: Response) => {
  clearAuthCookies(res);
  res.status(204).end();
});

export default router;
