import { useState, useCallback, useEffect } from 'react';
import type { User, Role, Group, SystemMetric, ActivityLog, SystemSettings, UserFilters, PaginationParams } from '../types/admin';
import {
  adminUserService,
  adminRoleService,
  adminGroupService,
  adminMonitoringService,
  adminSettingsService,
} from '../services/adminService';
import {
  mockUsers,
  mockRoles,
  mockGroups,
  mockMetrics,
  mockActivityLogs,
  mockSettings,
} from '../data/mockAdminData';

// Enable mock data mode (set to false when backend is ready)
const USE_MOCK_DATA = true;

// ─── Users Hook ───────────────────────────────────────────────────────────────

export function useAdminUsers(initialFilters?: Partial<UserFilters>) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationParams>({ page: 1, limit: 20, total: mockUsers.length });
  const [filters, setFilters] = useState<Partial<UserFilters>>(
    initialFilters ?? { sortBy: 'createdAt', sortOrder: 'desc' }
  );

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (USE_MOCK_DATA) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 300));
        // Apply filters to mock data
        let filtered = [...mockUsers];
        if (filters.search) {
          const search = filters.search.toLowerCase();
          filtered = filtered.filter(u => u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search));
        }
        if (filters.role && filters.role !== 'all') {
          filtered = filtered.filter(u => u.role === filters.role);
        }
        if (filters.status && filters.status !== 'all') {
          filtered = filtered.filter(u => u.status === filters.status);
        }
        // Apply sorting
        const sortBy = filters.sortBy || 'createdAt';
        const sortOrder = filters.sortOrder || 'desc';
        filtered.sort((a, b) => {
          let aVal = a[sortBy as keyof User] as string;
          let bVal = b[sortBy as keyof User] as string;
          if (sortBy === 'lastActive' || sortBy === 'createdAt') {
            aVal = new Date(aVal).toISOString();
            bVal = new Date(bVal).toISOString();
          }
          if (sortOrder === 'asc') return aVal.localeCompare(bVal);
          return bVal.localeCompare(aVal);
        });
        setUsers(filtered);
        setPagination(p => ({ ...p, total: filtered.length }));
      } else {
        const res = await adminUserService.getUsers(filters, pagination);
        setUsers(res.data);
        if (res.pagination) setPagination(res.pagination);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const createUser = async (data: Omit<User, 'id' | 'createdAt' | 'lastActive'>) => {
    if (USE_MOCK_DATA) {
      const newUser: User = {
        ...data,
        id: String(Date.now()),
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      };
      setUsers(prev => [newUser, ...prev]);
      return newUser;
    }
    const res = await adminUserService.createUser(data);
    setUsers(prev => [res.data, ...prev]);
    return res.data;
  };

  const updateUser = async (id: string, data: Partial<User>) => {
    if (USE_MOCK_DATA) {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...data } : u));
      return { id, ...data } as User;
    }
    const res = await adminUserService.updateUser(id, data);
    setUsers(prev => prev.map(u => u.id === id ? res.data : u));
    return res.data;
  };

  const deleteUser = async (id: string) => {
    if (USE_MOCK_DATA) {
      setUsers(prev => prev.filter(u => u.id !== id));
      return;
    }
    await adminUserService.deleteUser(id);
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  const bulkDelete = async (ids: string[]) => {
    if (USE_MOCK_DATA) {
      setUsers(prev => prev.filter(u => !ids.includes(u.id)));
      return;
    }
    await adminUserService.bulkDeleteUsers(ids);
    setUsers(prev => prev.filter(u => !ids.includes(u.id)));
  };

  const updateStatus = async (id: string, status: User['status']) => {
    if (USE_MOCK_DATA) {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, status } : u));
      return { id, status } as User;
    }
    const res = await adminUserService.updateUserStatus(id, status);
    setUsers(prev => prev.map(u => u.id === id ? res.data : u));
  };

  return {
    users, loading, error, pagination, filters,
    setFilters, setPagination, refetch: fetchUsers,
    createUser, updateUser, deleteUser, bulkDelete, updateStatus,
  };
}

// ─── Roles & Groups Hook ──────────────────────────────────────────────────────

const MOCK_ROLES: Role[] = mockRoles;
const MOCK_GROUPS: Group[] = mockGroups;

export function useAdminRolesAndGroups() {
  const [roles, setRoles] = useState<Role[]>(MOCK_ROLES);
  const [groups, setGroups] = useState<Group[]>(MOCK_GROUPS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (USE_MOCK_DATA) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setRoles(MOCK_ROLES);
        setGroups(MOCK_GROUPS);
      } else {
        const [rolesRes, groupsRes] = await Promise.all([
          adminRoleService.getRoles(),
          adminGroupService.getGroups(),
        ]);
        setRoles(rolesRes.data);
        setGroups(groupsRes.data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load roles/groups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const createRole = async (data: Omit<Role, 'id' | 'userCount' | 'createdAt'>) => {
    if (USE_MOCK_DATA) {
      const newRole: Role = {
        ...data,
        id: String(Date.now()),
        userCount: 0,
        createdAt: new Date().toISOString(),
      };
      setRoles(prev => [...prev, newRole]);
      return newRole;
    }
    const res = await adminRoleService.createRole(data);
    setRoles(prev => [...prev, res.data]);
    return res.data;
  };

  const updateRole = async (id: string, data: Partial<Role>) => {
    if (USE_MOCK_DATA) {
      setRoles(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
      return { id, ...data } as Role;
    }
    const res = await adminRoleService.updateRole(id, data);
    setRoles(prev => prev.map(r => r.id === id ? res.data : r));
    return res.data;
  };

  const deleteRole = async (id: string) => {
    if (USE_MOCK_DATA) {
      setRoles(prev => prev.filter(r => r.id !== id));
      return;
    }
    await adminRoleService.deleteRole(id);
    setRoles(prev => prev.filter(r => r.id !== id));
  };

  const createGroup = async (data: Omit<Group, 'id' | 'createdAt'>) => {
    if (USE_MOCK_DATA) {
      const newGroup: Group = {
        ...data,
        id: String(Date.now()),
        createdAt: new Date().toISOString(),
      };
      setGroups(prev => [...prev, newGroup]);
      return newGroup;
    }
    const res = await adminGroupService.createGroup(data);
    setGroups(prev => [...prev, res.data]);
    return res.data;
  };

  const updateGroup = async (id: string, data: Partial<Group>) => {
    if (USE_MOCK_DATA) {
      setGroups(prev => prev.map(g => g.id === id ? { ...g, ...data } : g));
      return { id, ...data } as Group;
    }
    const res = await adminGroupService.updateGroup(id, data);
    setGroups(prev => prev.map(g => g.id === id ? res.data : g));
    return res.data;
  };

  const deleteGroup = async (id: string) => {
    if (USE_MOCK_DATA) {
      setGroups(prev => prev.filter(g => g.id !== id));
      return;
    }
    await adminGroupService.deleteGroup(id);
    setGroups(prev => prev.filter(g => g.id !== id));
  };

  return {
    roles, groups, loading, error, refetch: fetchAll,
    createRole, updateRole, deleteRole,
    createGroup, updateGroup, deleteGroup,
  };
}

// ─── Monitoring Hook ──────────────────────────────────────────────────────────

export function useAdminMonitoring() {
  const [metrics, setMetrics] = useState<SystemMetric[]>(MOCK_METRICS);
  const [logs, setLogs] = useState<ActivityLog[]>(MOCK_LOGS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (USE_MOCK_DATA) {
        await new Promise(resolve => setTimeout(resolve, 250));
        // Add some variation to metrics on each fetch
        setMetrics(MOCK_METRICS.map(m => ({
          ...m,
          value: typeof m.value === 'number' ? m.value + Math.floor(Math.random() * 5) - 2 : m.value,
          changePercent: m.changePercent !== undefined ? m.changePercent + (Math.random() * 2 - 1) : undefined,
        })));
        setLogs(MOCK_LOGS);
      } else {
        const [metricsRes, logsRes] = await Promise.all([
          adminMonitoringService.getMetrics(),
          adminMonitoringService.getActivityLogs({}, { page: 1, limit: 50 }),
        ]);
        setMetrics(metricsRes.data);
        setLogs(logsRes.data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { metrics, logs, loading, error, refetch: fetchData };
}

const MOCK_METRICS: SystemMetric[] = mockMetrics;
const MOCK_LOGS: ActivityLog[] = mockActivityLogs;

// ─── Settings Hook ────────────────────────────────────────────────────────────

export function useAdminSettings() {
  const [settings, setSettings] = useState<SystemSettings | null>(MOCK_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (USE_MOCK_DATA) {
        await new Promise(resolve => setTimeout(resolve, 150));
        setSettings(MOCK_SETTINGS);
      } else {
        const res = await adminSettingsService.getSettings();
        setSettings(res.data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const updateSection = async <K extends keyof SystemSettings>(
    section: K,
    data: Partial<SystemSettings[K]>
  ) => {
    setSaving(true);
    try {
      if (USE_MOCK_DATA) {
        await new Promise(resolve => setTimeout(resolve, 300));
        setSettings(prev => prev ? {
          ...prev,
          [section]: { ...prev[section], ...data },
        } : null);
      } else {
        const res = await adminSettingsService.updateSettings(section, data);
        setSettings(res.data);
      }
    } finally {
      setSaving(false);
    }
  };

  return { settings, loading, saving, error, updateSection, refetch: fetchSettings };
}

const MOCK_SETTINGS: SystemSettings = mockSettings;