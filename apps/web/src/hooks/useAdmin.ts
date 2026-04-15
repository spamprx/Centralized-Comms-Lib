import { useState, useCallback, useEffect } from 'react';
import type {
  User,
  Role,
  Group,
  SystemMetric,
  ActivityLog,
  SystemSettings,
  UserFilters,
  PaginationParams,
} from '../types/admin';
import {
  adminUserService,
  adminRoleService,
  adminGroupService,
  adminMonitoringService,
  adminSettingsService,
} from '../services/adminService';
import {
  apiUserRowToUser,
  auditEntryToActivityLog,
  mapApiGroupDetail,
  mapRoleWithPermissions,
  uiPermissionToApiPayload,
  uiStatusToPatchStatus,
} from '../lib/adminApi';
import type { ApiAuditEntry, ApiPermission, ApiUserRow } from '../lib/adminApi';

function permKey(resource: string, action: string): string {
  return `${resource}\0${action.toLowerCase()}`;
}

async function syncRolePermissions(roleId: string, desired: Role['permissions']): Promise<void> {
  const existing = (await adminRoleService.getPermissions(roleId)).data;
  const desiredKeys = new Set(desired.map((d) => permKey(d.resource, d.action)));
  for (const e of existing) {
    if (!desiredKeys.has(permKey(e.resource, e.action))) {
      await adminRoleService.deletePermission(e.id);
    }
  }
  const existingKeys = new Set(existing.map((e) => permKey(e.resource, e.action)));
  for (const d of desired) {
    if (!existingKeys.has(permKey(d.resource, d.action))) {
      await adminRoleService.createPermission(roleId, uiPermissionToApiPayload(d));
    }
  }
}

function applyUserFilters(rows: User[], filters: Partial<UserFilters>): User[] {
  let out = [...rows];
  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    out = out.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }
  if (filters.role && filters.role !== 'all') {
    out = out.filter((u) => u.role === filters.role);
  }
  if (filters.status && filters.status !== 'all') {
    out = out.filter((u) => u.status === filters.status);
  }
  const groupFilter = filters.group;
  if (groupFilter && groupFilter !== 'all') {
    out = out.filter((u) => u.groups.includes(groupFilter));
  }
  const sortBy = filters.sortBy || 'createdAt';
  const sortOrder = filters.sortOrder || 'desc';
  out.sort((a, b) => {
    let aVal: string | number = String(a[sortBy as keyof User] ?? '');
    let bVal: string | number = String(b[sortBy as keyof User] ?? '');
    if (sortBy === 'lastActive' || sortBy === 'createdAt') {
      aVal = new Date(String(aVal)).getTime();
      bVal = new Date(String(bVal)).getTime();
    } else {
      aVal = String(aVal).toLowerCase();
      bVal = String(bVal).toLowerCase();
    }
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    }
    if (sortOrder === 'asc') return String(aVal).localeCompare(String(bVal));
    return String(bVal).localeCompare(String(aVal));
  });
  return out;
}

// ─── Users Hook ───────────────────────────────────────────────────────────────

export type UserFormPayload = {
  name: string;
  email: string;
  roleId: string;
  status: User['status'];
  groups: string[];
  avatar?: string;
  password?: string;
};

export function useAdminUsers(initialFilters?: Partial<UserFilters>) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationParams>({ page: 1, limit: 20, total: 0 });
  const [filters, setFilters] = useState<Partial<UserFilters>>(
    initialFilters ?? { sortBy: 'createdAt', sortOrder: 'desc' },
  );

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminUserService.getUsers();
      const rows = (res.data as unknown as ApiUserRow[]).map(apiUserRowToUser);
      const filtered = applyUserFilters(rows, filters);
      const total = filtered.length;
      const { page, limit } = pagination;
      const start = (page - 1) * limit;
      setUsers(filtered.slice(start, start + limit));
      setPagination((p) => ({ ...p, total }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const syncUserGroups = async (userId: string, desiredGroupIds: string[]) => {
    const detail = (await adminUserService.getUserById(userId)).data as unknown as ApiUserRow;
    const prev = new Set((detail.groups ?? []).map((g) => g.id));
    const next = new Set(desiredGroupIds);
    for (const gid of next) {
      if (!prev.has(gid)) await adminGroupService.addMember(gid, userId);
    }
    for (const gid of prev) {
      if (!next.has(gid)) await adminGroupService.removeMember(gid, userId);
    }
  };

  const createUser = async (data: UserFormPayload) => {
    if (!data.password?.trim()) throw new Error('Password is required');
    const rid = data.roleId?.trim();
    const res = await adminUserService.createUser({
      email: data.email.trim(),
      displayName: data.name.trim(),
      password: data.password,
      roleId: rid || null,
    });
    const created = res.data as unknown as ApiUserRow;
    await syncUserGroups(created.id, data.groups);
    await fetchUsers();
    return apiUserRowToUser(
      (await adminUserService.getUserById(created.id)).data as unknown as ApiUserRow,
    );
  };

  const updateUser = async (id: string, data: UserFormPayload) => {
    const isActive = data.status === 'active';
    await adminUserService.updateUser(id, {
      displayName: data.name.trim(),
      email: data.email.trim(),
      isActive,
      avatarUrl: data.avatar?.trim() || null,
      ...(data.roleId?.trim() ? { roleId: data.roleId.trim() } : {}),
    });
    await syncUserGroups(id, data.groups);
    await fetchUsers();
    return apiUserRowToUser((await adminUserService.getUserById(id)).data as unknown as ApiUserRow);
  };

  const deleteUser = async (id: string) => {
    await adminUserService.deleteUser(id);
    await fetchUsers();
  };

  const bulkDelete = async (ids: string[]) => {
    await adminUserService.bulkDeleteUsers(ids);
    await fetchUsers();
  };

  const updateStatus = async (id: string, status: User['status']) => {
    await adminUserService.updateUserStatus(id, uiStatusToPatchStatus(status));
    await fetchUsers();
  };

  return {
    users,
    loading,
    error,
    pagination,
    filters,
    setFilters,
    setPagination,
    refetch: fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    bulkDelete,
    updateStatus,
  };
}

// ─── Roles & Groups Hook ──────────────────────────────────────────────────────

export function useAdminRolesAndGroups() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rolesRes, groupsSummaries, usersRes] = await Promise.all([
        adminRoleService.getRoles(),
        adminGroupService.getGroups(),
        adminUserService.getUsers(),
      ]);
      const users = (usersRes.data as unknown as ApiUserRow[]).map(apiUserRowToUser);

      const rolesWithPerms: Role[] = await Promise.all(
        rolesRes.data.map(async (r) => {
          const perms = (await adminRoleService.getPermissions(r.id)).data as ApiPermission[];
          const count = users.filter((u) => u.primaryRoleId === r.id).length;
          return mapRoleWithPermissions(r, perms, count);
        }),
      );

      const groupDetails = await Promise.all(
        groupsSummaries.data.map(async (g) => (await adminGroupService.getGroupById(g.id)).data),
      );
      const mappedGroups = groupDetails.map((g) => mapApiGroupDetail(g));

      setRoles(rolesWithPerms);
      setGroups(mappedGroups);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load roles/groups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const createRole = async (data: Omit<Role, 'id' | 'userCount' | 'createdAt'>) => {
    const res = await adminRoleService.createRole({
      name: data.name,
      description: data.description || null,
    });
    await syncRolePermissions(res.data.id, data.permissions);
    await fetchAll();
    const perms = (await adminRoleService.getPermissions(res.data.id)).data as ApiPermission[];
    return mapRoleWithPermissions(res.data, perms, 0);
  };

  const updateRole = async (id: string, data: Partial<Role>) => {
    const patch: { name?: string; description?: string | null } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (Object.keys(patch).length > 0) {
      await adminRoleService.updateRole(id, patch);
    }
    if (data.permissions) await syncRolePermissions(id, data.permissions);
    await fetchAll();
    const perms = (await adminRoleService.getPermissions(id)).data as ApiPermission[];
    const row = (await adminRoleService.getRoles()).data.find((r) => r.id === id)!;
    const usersRes = await adminUserService.getUsers();
    const users = (usersRes.data as unknown as ApiUserRow[]).map(apiUserRowToUser);
    const count = users.filter((u) => u.primaryRoleId === id).length;
    return mapRoleWithPermissions(row, perms, count);
  };

  const deleteRole = async (id: string) => {
    await adminRoleService.deleteRole(id);
    await fetchAll();
  };

  const createGroup = async (data: Omit<Group, 'id' | 'createdAt'>) => {
    const res = await adminGroupService.createGroup({
      name: data.name,
      description: data.description || null,
    });
    const gid = res.data.id;
    for (const userId of data.members) {
      await adminGroupService.addMember(gid, userId);
    }
    await fetchAll();
    return mapApiGroupDetail((await adminGroupService.getGroupById(gid)).data);
  };

  const updateGroup = async (id: string, data: Partial<Group>) => {
    await adminGroupService.updateGroup(id, {
      name: data.name,
      description: data.description !== undefined ? data.description : undefined,
    });
    const current = (await adminGroupService.getGroupById(id)).data;
    const prev = new Set((current.members ?? []).map((m) => m.id));
    const next = new Set(data.members ?? (current.members ?? []).map((m) => m.id));
    for (const userId of next) {
      if (!prev.has(userId)) await adminGroupService.addMember(id, userId);
    }
    for (const userId of prev) {
      if (!next.has(userId)) await adminGroupService.removeMember(id, userId);
    }
    await fetchAll();
    return mapApiGroupDetail((await adminGroupService.getGroupById(id)).data);
  };

  const deleteGroup = async (id: string) => {
    await adminGroupService.deleteGroup(id);
    await fetchAll();
  };

  return {
    roles,
    groups,
    loading,
    error,
    refetch: fetchAll,
    createRole,
    updateRole,
    deleteRole,
    createGroup,
    updateGroup,
    deleteGroup,
  };
}

// ─── Monitoring Hook ──────────────────────────────────────────────────────────

export function useAdminMonitoring() {
  const [metrics, setMetrics] = useState<SystemMetric[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [metricsRes, logsRes] = await Promise.all([
        adminMonitoringService.getMetrics(),
        adminMonitoringService.getActivityLogs({}, { page: 1, limit: 50 }),
      ]);
      setMetrics(metricsRes.data);
      setLogs((logsRes.data as ApiAuditEntry[]).map(auditEntryToActivityLog));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { metrics, logs, loading, error, refetch: fetchData };
}

// ─── Settings Hook ────────────────────────────────────────────────────────────

export function useAdminSettings() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminSettingsService.getSettings();
      setSettings(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSection = async <K extends keyof SystemSettings>(
    section: K,
    data: Partial<SystemSettings[K]>,
  ) => {
    setSaving(true);
    try {
      const res = await adminSettingsService.updateSettings(section, data);
      setSettings(res.data);
    } finally {
      setSaving(false);
    }
  };

  return { settings, loading, saving, error, updateSection, refetch: fetchSettings };
}
