import { getPrismaClient, PrismaUnitOfWork } from "../../repository";
import type { AuditContext } from "../../shared/context";
import { hashPassword, verifyPassword } from "../../shared/hash";

export const authService = {
  async register(
    ctx: Omit<AuditContext, "actorId"> & {
      ipAddress?: string;
      userAgent?: string;
    },
    input: { email: string; displayName: string; password: string },
  ): Promise<
    | {
        user: {
          id: string;
          email: string;
          displayName: string;
          avatarUrl: string | null;
        };
        conflict: false;
      }
    | { conflict: true }
  > {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const result = await uow.withTransaction(async (repos) => {
      const existing = await repos.userRole.getUserByEmail(input.email);
      if (existing) return { conflict: true } as const;
      const passwordHash = await hashPassword(input.password);
      const user = await repos.userRole.createUser({
        email: input.email,
        displayName: input.displayName,
        passwordHash,
      });
      await repos.audit.append({
        action: "CREATE",
        resource: "USER",
        resourceId: user.id,
        newValue: { email: input.email, displayName: input.displayName },
        actorId: user.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return { conflict: false, user } as const;
    });
    return result;
  },

  async login(
    ctx: { ipAddress?: string; userAgent?: string },
    input: {
      email: string;
      password: string;
    },
  ): Promise<
    | {
        user: {
          id: string;
          email: string;
          displayName: string;
          avatarUrl: string | null;
        };
        role: "ADMIN" | "USER";
      }
    | { invalidCredentials: true }
    | { accountInactive: true }
  > {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const repos = uow.repos();
    const user = await repos.userRole.getUserByEmailWithPassword(input.email);
    if (!user) {
      await repos.audit.append({
        action: "LOGIN_FAILED",
        resource: "USER",
        resourceId: "unknown",
        newValue: { email: input.email, reason: "user_not_found" },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return { invalidCredentials: true };
    }
    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      await repos.audit.append({
        action: "LOGIN_FAILED",
        resource: "USER",
        resourceId: user.id,
        newValue: { email: input.email, reason: "invalid_password" },
        actorId: user.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return { invalidCredentials: true };
    }
    if (!user.isActive) {
      await repos.audit.append({
        action: "LOGIN_FAILED",
        resource: "USER",
        resourceId: user.id,
        newValue: { email: input.email, reason: "account_inactive" },
        actorId: user.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return { accountInactive: true };
    }
    const roles = await repos.userRole.listRolesForUser(user.id);
    const isAdmin = roles.some((r) => r.name.toUpperCase() === "ADMIN");
    await repos.audit.append({
      action: "LOGIN",
      resource: "USER",
      resourceId: user.id,
      newValue: { email: user.email, role: isAdmin ? "ADMIN" : "USER" },
      actorId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    const { passwordHash: _, ...safeUser } = user;
    return {
      user: safeUser,
      role: isAdmin ? "ADMIN" : "USER",
    };
  },

  async getMe(userId: string): Promise<{
    user: {
      id: string;
      email: string;
      displayName: string;
      avatarUrl: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
    role: "ADMIN" | "USER";
  } | null> {
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
        isActive: true,
      },
    });
    if (!user || !user.isActive) return null;
    const uow = new PrismaUnitOfWork(prisma);
    const roles = await uow.repos().userRole.listRolesForUser(userId);
    const isAdmin = roles.some((r) => r.name.toUpperCase() === "ADMIN");
    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      role: isAdmin ? "ADMIN" : "USER",
    };
  },
};
