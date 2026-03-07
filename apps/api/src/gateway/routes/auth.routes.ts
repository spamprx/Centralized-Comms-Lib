import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getPrismaClient, PrismaUnitOfWork } from "../../repository";
import type { UserRole } from "../middleware/auth.middleware";
const router = Router();

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_ISSUER = process.env.JWT_ISSUER;
const JWT_AUDIENCE = process.env.JWT_AUDIENCE;
const SALT_ROUNDS = 12;

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

    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);

    const result = await uow.withTransaction(async (repos) => {
      const existing = await repos.userRole.getUserByEmail(email);
      if (existing) {
        return { conflict: true } as const;
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const user = await repos.userRole.createUser({ email, displayName, passwordHash });

      await repos.audit.append({
        action: "CREATE",
        resource: "USER",
        resourceId: user.id,
        newValue: { email, displayName },
        actorId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      return { conflict: false, user } as const;
    });

    if (result.conflict) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const token = signToken({ id: result.user.id, email: result.user.email, role: "USER" });

    res.status(201).json({
      user: result.user,
      token,
    });
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

    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const repos = uow.repos();

    const user = await repos.userRole.getUserByEmailWithPassword(email);
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const roles = await repos.userRole.listRolesForUser(user.id);
    const isAdmin = roles.some((r) => r.name.toUpperCase() === "ADMIN");

    const token = signToken({
      id: user.id,
      email: user.email,
      role: isAdmin ? "ADMIN" : "USER",
    });

    const { passwordHash: _, ...safeUser } = user;

    res.status(200).json({
      user: safeUser,
      token,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
