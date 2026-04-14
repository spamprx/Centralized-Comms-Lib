import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Global roles only — carried in the JWT.
// FUTURE: Content-scoped roles (AUTHOR, CO_AUTHOR, REVIEWER) live on the content record in the DB and are enforced in Service Layer (Object-Level Authorization).
export type UserRole = "USER" | "ADMIN";

export interface JwtPayload {
  id: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

const BEARER_PREFIX = "Bearer ";

const JWT_VERIFY_OPTIONS: jwt.VerifyOptions = {
  algorithms: ["HS256"],
  ...(process.env.JWT_ISSUER && { issuer: process.env.JWT_ISSUER }),
  ...(process.env.JWT_AUDIENCE && { audience: process.env.JWT_AUDIENCE }),
};

// Validate at startup — a missing secret should crash immediately, not silently fail on the first authenticated request.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in environment");
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith(BEARER_PREFIX)) {
    return authHeader.slice(BEARER_PREFIX.length).trim();
  }
  return null;
}

function isJwtError(err: unknown): err is jwt.JsonWebTokenError {
  return err instanceof jwt.JsonWebTokenError;
}

// Verifies the JWT on every protected route and attaches the decoded payload to req.user for downstream handlers.

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  try {
    const token = extractToken(req);

    if (!token) {
      res.status(401).json({ error: "No token provided" });
      return;
    }

    const decoded = jwt.verify(
      token,
      JWT_SECRET,
      JWT_VERIFY_OPTIONS,
    ) as JwtPayload;
    req.user = decoded;

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: "Token has expired" });
      return;
    }
    if (err instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    next(err);
  }
};

// Global role-based access control — always use after authenticate.
// Usage: router.delete("/users/:id", authenticate, authorize("ADMIN"), handler)

export const authorize = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden — insufficient permissions" });
      return;
    }

    next();
  };
};

// For routes that serve both guests and authenticated users.
// Attaches req.user if the token is present and valid — does not block if absent.

export const optionalAuthenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  try {
    const token = extractToken(req);

    if (!token) {
      next();
      return;
    }

    const decoded = jwt.verify(
      token,
      JWT_SECRET,
      JWT_VERIFY_OPTIONS,
    ) as JwtPayload;
    req.user = decoded;

    next();
  } catch (err) {
    if (isJwtError(err)) {
      next();
      return;
    }
    console.error("[optionalAuthenticate] Unexpected error:", err);
    next();
  }
};
