import type { UserRoleRepository } from "../../interfaces";
import type {
  CreatePermissionInput,
  CreateRoleInput,
  CreateUserGroupInput,
  CreateUserInput,
  Permission,
  Role,
  User,
  UserGroup,
  UserWithPassword,
} from "../../types";
import type { PrismaDb } from "./prismaTypes";

function toUser(row: {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toUserWithPassword(row: {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): UserWithPassword {
  return {
    ...toUser(row),
    passwordHash: row.passwordHash,
  };
}

function toRole(row: {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}): Role {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isSystem: row.isSystem,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toPermission(row: {
  id: string;
  action: string;
  resource: string;
  roleId: string;
}): Permission {
  return {
    id: row.id,
    action: row.action,
    resource: row.resource,
    roleId: row.roleId,
  };
}

function toGroup(row: {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}): UserGroup {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaUserRoleRepository implements UserRoleRepository {
  public constructor(private readonly db: PrismaDb) {}

  async createUser(input: CreateUserInput): Promise<User> {
    const row = await this.db.user.create({
      data: {
        email: input.email,
        displayName: input.displayName,
        passwordHash: input.passwordHash,
        avatarUrl: input.avatarUrl ?? null,
      },
    });
    return toUser(row);
  }

  async getUserById(id: string): Promise<User | null> {
    const row = await this.db.user.findUnique({ where: { id } });
    return row ? toUser(row) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const row = await this.db.user.findUnique({ where: { email } });
    return row ? toUser(row) : null;
  }

  async getUserByEmailWithPassword(
    email: string,
  ): Promise<UserWithPassword | null> {
    const row = await this.db.user.findUnique({ where: { email } });
    return row ? toUserWithPassword(row) : null;
  }

  async listUsers(): Promise<User[]> {
    const rows = await this.db.user.findMany({
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toUser);
  }

  async updateUser(
    id: string,
    input: {
      displayName?: string;
      email?: string;
      isActive?: boolean;
      avatarUrl?: string | null;
    },
  ): Promise<User> {
    const row = await this.db.user.update({
      where: { id },
      data: {
        ...(input.displayName !== undefined && {
          displayName: input.displayName,
        }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
      },
    });
    return toUser(row);
  }

  async deleteUser(id: string): Promise<void> {
    await this.db.user.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async createRole(input: CreateRoleInput): Promise<Role> {
    const row = await this.db.role.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        isSystem: input.isSystem ?? false,
      },
    });
    return toRole(row);
  }

  async getRoleById(id: string): Promise<Role | null> {
    const row = await this.db.role.findUnique({ where: { id } });
    return row ? toRole(row) : null;
  }

  async getRoleByName(name: string): Promise<Role | null> {
    const row = await this.db.role.findUnique({ where: { name } });
    return row ? toRole(row) : null;
  }

  async listRoles(): Promise<Role[]> {
    const rows = await this.db.role.findMany({ orderBy: { name: "asc" } });
    return rows.map(toRole);
  }

  async listRolesForUser(userId: string): Promise<Role[]> {
    const rows = await this.db.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
    return rows.map((r: any) => toRole(r.role));
  }

  async updateRole(
    id: string,
    input: { name?: string; description?: string | null; isSystem?: boolean },
  ): Promise<Role> {
    const row = await this.db.role.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.isSystem !== undefined && { isSystem: input.isSystem }),
      },
    });
    return toRole(row);
  }

  async deleteRole(id: string): Promise<void> {
    await this.db.role.delete({ where: { id } });
  }

  async assignRole(
    userId: string,
    roleId: string,
    assignedById?: string,
  ): Promise<void> {
    await this.db.userRole.create({
      data: {
        userId,
        roleId,
        assignedById: assignedById ?? null,
      },
    });
  }

  async removeRole(userId: string, roleId: string): Promise<void> {
    await this.db.userRole.deleteMany({
      where: { userId, roleId },
    });
  }

  async createPermission(input: CreatePermissionInput): Promise<Permission> {
    const row = await this.db.permission.create({
      data: {
        action: input.action,
        resource: input.resource,
        roleId: input.roleId,
      },
    });
    return toPermission(row);
  }

  async listPermissionsForRole(roleId: string): Promise<Permission[]> {
    const rows = await this.db.permission.findMany({ where: { roleId } });
    return rows.map(toPermission);
  }

  async listPermissionsForUser(userId: string): Promise<Permission[]> {
    const rows = await this.db.userRole.findMany({
      where: { userId },
      include: { role: { include: { permissions: true } } },
    });
    return rows.flatMap((ur: any) =>
      ur.role.permissions.map((p: any) => toPermission(p)),
    );
  }

  async updatePermission(
    id: string,
    input: { action?: string; resource?: string },
  ): Promise<Permission> {
    const row = await this.db.permission.update({
      where: { id },
      data: {
        ...(input.action !== undefined && { action: input.action }),
        ...(input.resource !== undefined && { resource: input.resource }),
      },
    });
    return toPermission(row);
  }

  async deletePermission(id: string): Promise<void> {
    await this.db.permission.delete({ where: { id } });
  }

  async createGroup(input: CreateUserGroupInput): Promise<UserGroup> {
    const row = await this.db.userGroup.create({
      data: {
        name: input.name,
        description: input.description ?? null,
      },
    });
    return toGroup(row);
  }

  async listGroups(): Promise<UserGroup[]> {
    const rows = await this.db.userGroup.findMany({ orderBy: { name: "asc" } });
    return rows.map(toGroup);
  }

  async listGroupsForUser(userId: string): Promise<UserGroup[]> {
    const memberships = await this.db.userGroupMembership.findMany({
      where: { userId },
      include: { group: true },
    });
    return memberships.map((m: any) => toGroup(m.group));
  }

  async getGroupById(groupId: string): Promise<UserGroup | null> {
    const row = await this.db.userGroup.findUnique({ where: { id: groupId } });
    return row ? toGroup(row) : null;
  }

  async addUserToGroup(userId: string, groupId: string): Promise<void> {
    await this.db.userGroupMembership.create({
      data: { userId, groupId },
    });
  }

  async removeUserFromGroup(userId: string, groupId: string): Promise<void> {
    await this.db.userGroupMembership.deleteMany({
      where: { userId, groupId },
    });
  }

  async listGroupMembers(groupId: string): Promise<User[]> {
    const memberships = await this.db.userGroupMembership.findMany({
      where: { groupId },
      include: { user: true },
    });
    return memberships.map((m: any) => toUser(m.user));
  }
}
