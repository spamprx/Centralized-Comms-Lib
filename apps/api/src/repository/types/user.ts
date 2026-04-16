export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  isActive: boolean;
  lastActiveAt: Date | null;
  presencePingAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithPassword extends User {
  passwordHash: string;
}

export interface CreateUserInput {
  email: string;
  displayName: string;
  passwordHash: string;
  avatarUrl?: string | null;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRoleInput {
  name: string;
  description?: string | null;
  isSystem?: boolean;
}

export interface Permission {
  id: string;
  action: string;
  resource: string;
  roleId: string;
}

export interface CreatePermissionInput {
  action: string;
  resource: string;
  roleId: string;
}

export interface UserGroup {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserGroupInput {
  name: string;
  description?: string | null;
}
