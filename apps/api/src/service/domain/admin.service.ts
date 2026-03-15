import { getPrismaClient, PrismaUnitOfWork } from "../../repository";
import type { AuditContext } from "../context";

export const adminService = {
  // ── Roles ─────────────────────────────────────────────────────────────────
  async listRoles() {
    const repos = new PrismaUnitOfWork(getPrismaClient()).repos();
    return repos.userRole.listRoles();
  },

  async createRole(
    ctx: AuditContext,
    input: { name: string; description?: string | null },
  ) {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const existing = await repos.userRole.getRoleByName(input.name);
      if (existing) return { conflict: true } as const;
      const role = await repos.userRole.createRole({
        name: input.name,
        description: input.description ?? null,
      });
      await repos.audit.append({
        action: "CREATE",
        resource: "ROLE",
        resourceId: role.id,
        newValue: { name: input.name, description: input.description },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return { role };
    });
  },

  async listPermissionsForRole(roleId: string) {
    const repos = new PrismaUnitOfWork(getPrismaClient()).repos();
    return repos.userRole.listPermissionsForRole(roleId);
  },

  async createPermission(
    ctx: AuditContext,
    roleId: string,
    input: { action: string; resource: string },
  ) {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const perm = await repos.userRole.createPermission({
        action: input.action,
        resource: input.resource,
        roleId,
      });
      await repos.audit.append({
        action: "CREATE",
        resource: "PERMISSION",
        resourceId: perm.id,
        newValue: { action: input.action, resource: input.resource, roleId },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return perm;
    });
  },

  async assignRoleToUser(ctx: AuditContext, userId: string, roleId: string): Promise<void> {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    await uow.withTransaction(async (repos) => {
      await repos.userRole.assignRole(userId, roleId, ctx.actorId);
      await repos.audit.append({
        action: "ROLE_ASSIGN",
        resource: "USER",
        resourceId: userId,
        newValue: { roleId },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    });
  },

  async removeRoleFromUser(ctx: AuditContext, userId: string, roleId: string): Promise<void> {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    await uow.withTransaction(async (repos) => {
      await repos.userRole.removeRole(userId, roleId);
      await repos.audit.append({
        action: "ROLE_REMOVE",
        resource: "USER",
        resourceId: userId,
        oldValue: { roleId },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    });
  },

  // ── Users ─────────────────────────────────────────────────────────────────
  async listUsers() {
    const repos = new PrismaUnitOfWork(getPrismaClient()).repos();
    return repos.userRole.listUsers();
  },

  async getUserById(id: string) {
    const repos = new PrismaUnitOfWork(getPrismaClient()).repos();
    const user = await repos.userRole.getUserById(id);
    if (!user) return null;
    const roles = await repos.userRole.listRolesForUser(user.id);
    const groups = await repos.userRole.listGroupsForUser(user.id);
    return { ...user, roles, groups };
  },

  // ── Groups ────────────────────────────────────────────────────────────────
  async listGroups() {
    const repos = new PrismaUnitOfWork(getPrismaClient()).repos();
    return repos.userRole.listGroups();
  },

  async createGroup(
    ctx: AuditContext,
    input: { name: string; description?: string | null },
  ) {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const g = await repos.userRole.createGroup({
        name: input.name,
        description: input.description ?? null,
      });
      await repos.audit.append({
        action: "CREATE",
        resource: "GROUP",
        resourceId: g.id,
        newValue: { name: input.name, description: input.description },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return g;
    });
  },

  async getGroupById(id: string) {
    const repos = new PrismaUnitOfWork(getPrismaClient()).repos();
    const group = await repos.userRole.getGroupById(id);
    if (!group) return null;
    const members = await repos.userRole.listGroupMembers(group.id);
    return { ...group, members };
  },

  async addGroupMember(ctx: AuditContext, groupId: string, userId: string): Promise<void> {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    await uow.withTransaction(async (repos) => {
      await repos.userRole.addUserToGroup(userId, groupId);
      await repos.audit.append({
        action: "GROUP_ADD_MEMBER",
        resource: "GROUP",
        resourceId: groupId,
        newValue: { userId },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    });
  },

  async removeGroupMember(
    ctx: AuditContext,
    groupId: string,
    userId: string,
  ): Promise<void> {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    await uow.withTransaction(async (repos) => {
      await repos.userRole.removeUserFromGroup(userId, groupId);
      await repos.audit.append({
        action: "GROUP_REMOVE_MEMBER",
        resource: "GROUP",
        resourceId: groupId,
        oldValue: { userId },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    });
  },

  // ── Logs ──────────────────────────────────────────────────────────────────
  async listLogs(filters: {
    actorId?: string;
    resource?: string;
    resourceId?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }) {
    const repos = new PrismaUnitOfWork(getPrismaClient()).repos();
    return repos.audit.list(filters);
  },
};
