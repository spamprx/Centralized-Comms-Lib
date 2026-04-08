import { getPrismaClient, PrismaUnitOfWork } from "../../repository";
import type { AuditContext } from "../../shared/context";
import { hashPassword, verifyPassword } from "../../utils/hash";

export const authService = {
  async register(
    ctx: Omit<AuditContext, "actorId"> & { ipAddress?: string; userAgent?: string },
    input: { email: string; displayName: string; password: string },
  ): Promise<
    | { user: { id: string; email: string; displayName: string; avatarUrl: string | null }; conflict: false }
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

  async login(input: {
    email: string;
    password: string;
  }): Promise<
    | { user: { id: string; email: string; displayName: string; avatarUrl: string | null }; role: "ADMIN" | "USER" }
    | { invalidCredentials: true }
  > {
    const repos = new PrismaUnitOfWork(getPrismaClient()).repos();
    const user = await repos.userRole.getUserByEmailWithPassword(input.email);
    if (!user) return { invalidCredentials: true };
    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) return { invalidCredentials: true };
    const roles = await repos.userRole.listRolesForUser(user.id);
    const isAdmin = roles.some((r) => r.name.toUpperCase() === "ADMIN");
    const { passwordHash: _, ...safeUser } = user;
    return {
      user: safeUser,
      role: isAdmin ? "ADMIN" : "USER",
    };
  },
};
