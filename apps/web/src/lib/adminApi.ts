import type {
  ActivityLog,
  Group,
  Permission,
  Role,
  User,
  UserRole,
  UserStatus,
} from '../types/admin';

/** Raw shapes from GET /admin/users (with associations). */
export type ApiUserRow = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  roles: { id: string; name: string; description?: string | null }[];
  groups: { id: string; name: string }[];
};

export type ApiPermission = {
  id: string;
  action: string;
  resource: string;
  roleId: string;
};

export type ApiRoleRow = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ApiGroupMemberUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
};

export type ApiGroupSummary = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiGroupDetail = ApiGroupSummary & {
  members: ApiGroupMemberUser[];
};

export type ApiAuditEntry = {
  id: string;
  action: string;
  resource: string;
  resourceId: string;
  oldValue?: unknown | null;
  newValue?: unknown | null;
  actorId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

function toIso(d: string | Date): string {
  return typeof d === 'string' ? d : d.toISOString();
}

const PERM_ACTIONS: Permission['action'][] = ['create', 'read', 'update', 'delete', 'manage'];

function normalizeAction(action: string): Permission['action'] {
  const a = action.toLowerCase() as Permission['action'];
  return PERM_ACTIONS.includes(a) ? a : 'read';
}

export function apiPermissionToUi(p: ApiPermission): Permission {
  return {
    id: p.id,
    resource: p.resource,
    action: normalizeAction(p.action),
  };
}

export function uiPermissionToApiPayload(p: Pick<Permission, 'action' | 'resource'>): {
  action: string;
  resource: string;
} {
  return { action: p.action.toUpperCase(), resource: p.resource };
}

/** Map backend role name to a UI role bucket for filters and badges. */
export function backendRoleNameToUserRole(name: string): UserRole {
  const n = name.trim().toUpperCase().replace(/\s+/g, '_');
  if (n.includes('SUPER') && n.includes('ADMIN')) return 'super_admin';
  if (n === 'ADMIN' || n.endsWith('_ADMIN')) return 'admin';
  if (n.includes('MOD')) return 'moderator';
  if (n.includes('EDIT')) return 'editor';
  if (n.includes('VIEW')) return 'viewer';
  return 'viewer';
}

export function apiUserRowToUser(row: ApiUserRow): User {
  const roles = row.roles ?? [];
  const primary = roles[0];
  const role = primary ? backendRoleNameToUserRole(primary.name) : 'viewer';
  const status: UserStatus = row.isActive ? 'active' : 'inactive';
  return {
    id: row.id,
    name: row.displayName,
    email: row.email,
    avatar: row.avatarUrl ?? undefined,
    role,
    status,
    groups: (row.groups ?? []).map((g) => g.id),
    lastActive: toIso(row.updatedAt),
    createdAt: toIso(row.createdAt),
    primaryRoleId: primary?.id,
  };
}

/** Body for PATCH `/admin/users/:id/status` — backend maps active vs everything else to `isActive`. */
export function uiStatusToPatchStatus(status: UserStatus): 'active' | 'inactive' {
  return status === 'active' ? 'active' : 'inactive';
}

export function mapApiGroupDetail(g: ApiGroupDetail): Group {
  return {
    id: g.id,
    name: g.name,
    description: g.description ?? '',
    members: (g.members ?? []).map((m) => m.id),
    roles: [],
    createdAt: toIso(g.createdAt),
  };
}

export function mapApiGroupSummary(g: ApiGroupSummary): Group {
  return {
    id: g.id,
    name: g.name,
    description: g.description ?? '',
    members: [],
    roles: [],
    createdAt: toIso(g.createdAt),
  };
}

export function mapRoleWithPermissions(
  r: ApiRoleRow,
  permissions: ApiPermission[],
  userCount: number,
): Role {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    permissions: permissions.map(apiPermissionToUi),
    userCount,
    createdAt: toIso(r.createdAt),
    isSystem: r.isSystem,
  };
}

export function auditEntryToActivityLog(entry: ApiAuditEntry): ActivityLog {
  const actor = entry.actorId ?? 'system';
  const upperAction = entry.action.toUpperCase();
  const severity: ActivityLog['severity'] = upperAction.includes('FAILED')
    ? 'error'
    : upperAction.startsWith('DELETE')
      ? 'warning'
      : upperAction.includes('LOGIN') ||
          upperAction.startsWith('CREATE') ||
          upperAction.startsWith('UPDATE')
        ? 'success'
        : 'info';
  return {
    id: entry.id,
    userId: actor,
    userName: actor === 'system' ? 'System' : 'User',
    action: entry.action,
    resource: entry.resource,
    resourceId: entry.resourceId || undefined,
    timestamp: toIso(entry.createdAt),
    ipAddress: entry.ipAddress ?? '—',
    userAgent: entry.userAgent ?? undefined,
    oldValue: entry.oldValue ?? null,
    newValue: entry.newValue ?? null,
    severity,
    status: upperAction.includes('FAILED') ? 'failure' : 'success',
  };
}
