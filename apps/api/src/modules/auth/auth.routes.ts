import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { authenticate, type AuthRequest, type UserRole } from "../../middlewares/auth.middleware";
import { authService } from "../../service";
import { getPrismaClient, PrismaUnitOfWork } from "../../repository";
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

function setAuthCookie(res: Response, token: string) {
  const secure = process.env.COOKIE_SECURE === "true";
  const sameSite = (process.env.COOKIE_SAMESITE as "lax" | "strict" | "none" | undefined) ?? "lax";
  res.cookie("auth_token", token, {
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
    maxAge: 24 * 60 * 60 * 1000,
  });
}
function clearAuthCookie(res: Response) {
  const secure = process.env.COOKIE_SECURE === "true";
  const sameSite = (process.env.COOKIE_SAMESITE as "lax" | "strict" | "none" | undefined) ?? "lax";
  res.clearCookie("auth_token", {
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
  });
}
/**
 * @openapi
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user account
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - displayName
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               displayName:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Missing required fields
 *       409:
 *         description: Email already registered
 *       500:
 *         description: Server error
 */
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
    const token = signToken({ id: result.user.id, email: result.user.email, role: "USER" });
    setAuthCookie(res, token);

    res.status(201).json({ user: result.user });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     summary: Log in with email and password
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Successful login; returns user and JWT
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }
    const result = await authService.login(
      { ipAddress: req.ip, userAgent: req.headers["user-agent"] },
      { email, password },
    );
    if ("invalidCredentials" in result) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const { user, role } = result;
    const token = signToken({ id: user.id, email: user.email, role });
    setAuthCookie(res, token);

    res.status(200).json({ user });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post("/logout", async (req: Request, res: Response) => {
  clearAuthCookie(res);
  res.status(200).json({ ok: true });
});

router.get("/me", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const repos = uow.repos();
    const user = await repos.userRole.getUserById(req.user!.id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.status(200).json({ user });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
