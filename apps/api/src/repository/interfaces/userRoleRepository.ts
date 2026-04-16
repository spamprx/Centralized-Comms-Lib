import {
  CreatePermissionInput,
  CreateRoleInput,
  CreateUserGroupInput,
  CreateUserInput,
  Permission,
  Role,
  User,
  UserGroup,
  UserWithPassword,
} from "../types";

export interface UserRoleRepository {
  createUser(input: CreateUserInput): Promise<User>;
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserByEmailWithPassword(email: string): Promise<UserWithPassword | null>;
  listUsers(): Promise<User[]>;
  /** Updates `lastActiveAt` to now. Returns the new timestamp, or null if the user row is missing. */
  touchLastActiveAt(userId: string): Promise<Date | null>;
  /** Updates `presencePingAt` for an active account (used by app heartbeat). */
  touchPresencePingAt(userId: string): Promise<Date | null>;
  /** Clears app presence (logout / tab strategy). */
  clearPresencePingAt(userId: string): Promise<void>;
  updateUser(
    id: string,
    input: {
      displayName?: string;
      email?: string;
      isActive?: boolean;
      avatarUrl?: string | null;
    },
  ): Promise<User>;
  deleteUser(id: string): Promise<void>;

  createRole(input: CreateRoleInput): Promise<Role>;
  getRoleById(id: string): Promise<Role | null>;
  getRoleByName(name: string): Promise<Role | null>;
  listRoles(): Promise<Role[]>;
  listRolesForUser(userId: string): Promise<Role[]>;
  updateRole(
    id: string,
    input: { name?: string; description?: string | null; isSystem?: boolean },
  ): Promise<Role>;
  deleteRole(id: string): Promise<void>;
  assignRole(
    userId: string,
    roleId: string,
    assignedById?: string,
  ): Promise<void>;
  removeRole(userId: string, roleId: string): Promise<void>;

  createPermission(input: CreatePermissionInput): Promise<Permission>;
  listPermissionsForRole(roleId: string): Promise<Permission[]>;
  listPermissionsForUser(userId: string): Promise<Permission[]>;
  updatePermission(
    id: string,
    input: { action?: string; resource?: string },
  ): Promise<Permission>;
  deletePermission(id: string): Promise<void>;

  createGroup(input: CreateUserGroupInput): Promise<UserGroup>;
  listGroups(): Promise<UserGroup[]>;
  listGroupsForUser(userId: string): Promise<UserGroup[]>;
  getGroupById(groupId: string): Promise<UserGroup | null>;
  addUserToGroup(userId: string, groupId: string): Promise<void>;
  removeUserFromGroup(userId: string, groupId: string): Promise<void>;
  listGroupMembers(groupId: string): Promise<User[]>;
}
