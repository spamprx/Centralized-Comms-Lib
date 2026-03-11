import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "../middleware/auth.middleware";
import { authService } from "../../service";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_ISSUER = process.env.JWT_ISSUER;
const JWT_AUDIENCE = process.env.JWT_AUDIENCE;

function signToken(payload: { id: string; email: string; role: UserRole }): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "24h",
    algorithm: "HS256",
    ...(JWT_ISSUER && { issuer: JWT_ISSUER }),
    ...(JWT_AUDIENCE && { audience: JWT_AUDIENCE }),
  });
}

router.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, displayName, password } = req.body;
    if (!email || !displayName || !password) {
      res.status(400).json({ error: "email, displayName, and password are required" });
      return;
    }
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
    res.status(201).json({ user: result.user, token });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }
    const result = await authService.login({ email, password });
    if ("invalidCredentials" in result) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const { user, role } = result;
    const token = signToken({ id: user.id, email: user.email, role });
    res.status(200).json({ user, token });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
