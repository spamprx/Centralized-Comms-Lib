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

  createRole(input: CreateRoleInput): Promise<Role>;
  getRoleById(id: string): Promise<Role | null>;
  getRoleByName(name: string): Promise<Role | null>;
  listRoles(): Promise<Role[]>;
  listRolesForUser(userId: string): Promise<Role[]>;
  assignRole(userId: string, roleId: string, assignedById?: string): Promise<void>;
  removeRole(userId: string, roleId: string): Promise<void>;

  createPermission(input: CreatePermissionInput): Promise<Permission>;
  listPermissionsForRole(roleId: string): Promise<Permission[]>;
  listPermissionsForUser(userId: string): Promise<Permission[]>;

  createGroup(input: CreateUserGroupInput): Promise<UserGroup>;
  listGroups(): Promise<UserGroup[]>;
  listGroupsForUser(userId: string): Promise<UserGroup[]>;
  getGroupById(groupId: string): Promise<UserGroup | null>;
  addUserToGroup(userId: string, groupId: string): Promise<void>;
  removeUserFromGroup(userId: string, groupId: string): Promise<void>;
  listGroupMembers(groupId: string): Promise<User[]>;
}

