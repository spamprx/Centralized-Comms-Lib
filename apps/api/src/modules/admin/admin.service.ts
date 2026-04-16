import { getPrismaClient, PrismaUnitOfWork } from "../../repository";
import type { AuditContext } from "../../shared/context";
import { hashPassword } from "../../shared/hash";
import {
  getSettingsSnapshot,
  mergeSettingsSection,
} from "./adminSettings.defaults";

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

  async updateRole(
    ctx: AuditContext,
    id: string,
    input: { name?: string; description?: string | null; isSystem?: boolean },
  ) {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const existing = await repos.userRole.getRoleById(id);
      if (!existing) return { notFound: true } as const;
      const updated = await repos.userRole.updateRole(id, input);
      await repos.audit.append({
        action: "UPDATE",
        resource: "ROLE",
        resourceId: id,
        oldValue: {
          name: existing.name,
          description: existing.description,
          isSystem: existing.isSystem,
        },
        newValue: {
          name: input.name ?? existing.name,
          description: input.description ?? existing.description,
          isSystem: input.isSystem ?? existing.isSystem,
        },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return { role: updated } as const;
    });
  },

  async deleteRole(ctx: AuditContext, id: string) {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const existing = await repos.userRole.getRoleById(id);
      if (!existing) return { notFound: true } as const;
      await repos.userRole.deleteRole(id);
      await repos.audit.append({
        action: "DELETE",
        resource: "ROLE",
        resourceId: id,
        oldValue: {
          name: existing.name,
          description: existing.description,
          isSystem: existing.isSystem,
        },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return { deleted: true } as const;
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

  async updatePermission(
    ctx: AuditContext,
    id: string,
    input: { action?: string; resource?: string },
  ) {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const existing = await prisma.permission.findUnique({ where: { id } });
      if (!existing) return { notFound: true } as const;
      const updated = await repos.userRole.updatePermission(id, input);
      await repos.audit.append({
        action: "UPDATE",
        resource: "PERMISSION",
        resourceId: id,
        oldValue: {
          action: existing.action,
          resource: existing.resource,
        },
        newValue: {
          action: input.action ?? existing.action,
          resource: input.resource ?? existing.resource,
        },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return { permission: updated } as const;
    });
  },

  async deletePermission(ctx: AuditContext, id: string) {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const existing = await prisma.permission.findUnique({ where: { id } });
      if (!existing) return { notFound: true } as const;
      await repos.userRole.deletePermission(id);
      await repos.audit.append({
        action: "DELETE",
        resource: "PERMISSION",
        resourceId: id,
        oldValue: {
          action: existing.action,
          resource: existing.resource,
          roleId: existing.roleId,
        },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return { deleted: true } as const;
    });
  },

  async assignRoleToUser(
    ctx: AuditContext,
    userId: string,
    roleId: string,
  ): Promise<void> {
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

  async removeRoleFromUser(
    ctx: AuditContext,
    userId: string,
    roleId: string,
  ): Promise<void> {
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

  async updateUserRole(
    ctx: AuditContext,
    userId: string,
    fromRoleId: string,
    toRoleId: string,
  ): Promise<void> {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    await uow.withTransaction(async (repos) => {
      await repos.userRole.removeRole(userId, fromRoleId);
      await repos.userRole.assignRole(userId, toRoleId, ctx.actorId);
      await repos.audit.append({
        action: "ROLE_UPDATE",
        resource: "USER",
        resourceId: userId,
        oldValue: { roleId: fromRoleId },
        newValue: { roleId: toRoleId },
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

  async listUsersWithAssociations() {
    const repos = new PrismaUnitOfWork(getPrismaClient()).repos();
    const users = await repos.userRole.listUsers();
    return Promise.all(
      users.map(async (u) => {
        const roles = await repos.userRole.listRolesForUser(u.id);
        const groups = await repos.userRole.listGroupsForUser(u.id);
        return { ...u, roles, groups };
      }),
    );
  },

  async createUser(
    ctx: AuditContext,
    input: {
      email: string;
      displayName: string;
      password: string;
      roleId?: string | null;
    },
  ) {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const existing = await repos.userRole.getUserByEmail(input.email);
      if (existing) return { conflict: true } as const;
      const passwordHash = await hashPassword(input.password);
      const user = await repos.userRole.createUser({
        email: input.email,
        displayName: input.displayName,
        passwordHash,
        avatarUrl: null,
      });
      if (input.roleId) {
        await repos.userRole.assignRole(user.id, input.roleId, ctx.actorId);
      }
      await repos.audit.append({
        action: "CREATE",
        resource: "USER",
        resourceId: user.id,
        newValue: {
          email: input.email,
          displayName: input.displayName,
          roleId: input.roleId,
        },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return { user } as const;
    });
  },

  async updateUser(
    ctx: AuditContext,
    id: string,
    input: {
      displayName?: string;
      email?: string;
      isActive?: boolean;
      avatarUrl?: string | null;
      roleId?: string | null;
    },
  ) {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const existing = await repos.userRole.getUserById(id);
      if (!existing) return { notFound: true } as const;
      const updated = await repos.userRole.updateUser(id, {
        ...(input.displayName !== undefined && {
          displayName: input.displayName,
        }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
      });
      if (input.roleId) {
        const current = await repos.userRole.listRolesForUser(id);
        for (const r of current) {
          await repos.userRole.removeRole(id, r.id);
        }
        await repos.userRole.assignRole(id, input.roleId, ctx.actorId);
      }
      await repos.audit.append({
        action: "UPDATE",
        resource: "USER",
        resourceId: id,
        oldValue: {
          email: existing.email,
          displayName: existing.displayName,
          isActive: existing.isActive,
        },
        newValue: {
          email: input.email ?? existing.email,
          displayName: input.displayName ?? existing.displayName,
          isActive: input.isActive ?? existing.isActive,
          roleId: input.roleId ?? undefined,
        },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return { user: updated } as const;
    });
  },

  async deactivateUser(ctx: AuditContext, id: string) {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const existing = await repos.userRole.getUserById(id);
      if (!existing) return { notFound: true } as const;
      await repos.userRole.deleteUser(id);
      await repos.audit.append({
        action: "UPDATE",
        resource: "USER",
        resourceId: id,
        oldValue: { isActive: existing.isActive },
        newValue: { isActive: false, note: "deactivated via admin" },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return { ok: true } as const;
    });
  },

  async bulkSetUsersActive(
    ctx: AuditContext,
    ids: string[],
    isActive: boolean,
  ) {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    await uow.withTransaction(async (repos) => {
      for (const id of ids) {
        const existing = await repos.userRole.getUserById(id);
        if (!existing) continue;
        if (isActive) {
          await repos.userRole.updateUser(id, { isActive: true });
        } else {
          await repos.userRole.deleteUser(id);
        }
        await repos.audit.append({
          action: "UPDATE",
          resource: "USER",
          resourceId: id,
          oldValue: { isActive: existing.isActive },
          newValue: { isActive },
          actorId: ctx.actorId,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        });
      }
    });
    return { count: ids.length } as const;
  },

  async bulkDeactivateUsers(ctx: AuditContext, ids: string[]) {
    return adminService.bulkSetUsersActive(ctx, ids, false);
  },

  async resetUserPassword(_ctx: AuditContext, id: string) {
    const repos = new PrismaUnitOfWork(getPrismaClient()).repos();
    const user = await repos.userRole.getUserById(id);
    if (!user) return { notFound: true } as const;
    return {
      emailSent: false,
      message: "Password reset email is not configured in this environment.",
    } as const;
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

  async updateGroup(
    ctx: AuditContext,
    id: string,
    input: { name?: string; description?: string | null },
  ) {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const existing = await repos.userRole.getGroupById(id);
      if (!existing) return { notFound: true } as const;
      const updated = await prisma.userGroup.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && {
            description: input.description,
          }),
        },
      });
      await repos.audit.append({
        action: "UPDATE",
        resource: "GROUP",
        resourceId: id,
        oldValue: {
          name: existing.name,
          description: existing.description,
        },
        newValue: {
          name: input.name ?? existing.name,
          description: input.description ?? existing.description,
        },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return { group: updated } as const;
    });
  },

  async deleteGroup(ctx: AuditContext, id: string) {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const existing = await repos.userRole.getGroupById(id);
      if (!existing) return { notFound: true } as const;
      await prisma.userGroup.delete({ where: { id } });
      await repos.audit.append({
        action: "DELETE",
        resource: "GROUP",
        resourceId: id,
        oldValue: {
          name: existing.name,
          description: existing.description,
        },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return { deleted: true } as const;
    });
  },

  async addGroupMember(
    ctx: AuditContext,
    groupId: string,
    userId: string,
  ): Promise<void> {
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
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }) {
    const repos = new PrismaUnitOfWork(getPrismaClient()).repos();
    return repos.audit.list(filters);
  },

  getSettings() {
    return getSettingsSnapshot();
  },

  patchSettingsSection(section: string, patch: Record<string, unknown>) {
    return mergeSettingsSection(
      section as Parameters<typeof mergeSettingsSection>[0],
      patch,
    );
  },
};
