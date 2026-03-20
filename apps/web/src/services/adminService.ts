import type {
    User, Role, Group, SystemMetric, ActivityLog,
    SystemSettings, ApiResponse, UserFilters, PaginationParams,
  } from '../types/admin';
  
  const API_BASE = import.meta.env.VITE_API_URL ;
  
  async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
      ...options,
    });
  
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(err.error || err.message || `HTTP ${res.status}`);
    }
  
    return res.json();
  }
  
  // Wrap raw array responses into { data: [...] } shape the hooks expect
  function wrap<T>(data: T): ApiResponse<T> {
    return { data };
  }
  
  // ─── Users ────────────────────────────────────────────────────────────────────
  
  export const adminUserService = {
    getUsers: async (
      filters?: Partial<UserFilters>,
      pagination?: Partial<PaginationParams>
    ): Promise<ApiResponse<User[]>> => {
      const params = new URLSearchParams();
      if (filters?.search) params.set('search', filters.search);
      if (filters?.role && filters.role !== 'all') params.set('role', filters.role);
      if (filters?.status && filters.status !== 'all') params.set('status', filters.status);
      if (filters?.sortBy) params.set('sortBy', filters.sortBy);
      if (filters?.sortOrder) params.set('sortOrder', filters.sortOrder);
      if (pagination?.page) params.set('page', String(pagination.page));
      if (pagination?.limit) params.set('limit', String(pagination.limit));
      const query = params.toString();
      const data = await request<User[]>(query ? `/admin/users?${query}` : '/admin/users');
      return wrap(data);
    },
  
    getUserById: async (id: string): Promise<ApiResponse<User>> => {
      const data = await request<User>(`/admin/users/${id}`);
      return wrap(data);
    },
  
    createUser: async (body: Omit<User, 'id' | 'createdAt' | 'lastActive'>): Promise<ApiResponse<User>> => {
      const data = await request<User>('/admin/users', { method: 'POST', body: JSON.stringify(body) });
      return wrap(data);
    },
  
    updateUser: async (id: string, body: Partial<User>): Promise<ApiResponse<User>> => {
      const data = await request<User>(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      return wrap(data);
    },
  
    deleteUser: async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
      await request(`/admin/users/${id}`, { method: 'DELETE' });
      return wrap({ deleted: true });
    },
  
    bulkDeleteUsers: async (ids: string[]): Promise<ApiResponse<{ deleted: number }>> => {
      await request('/admin/users/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) });
      return wrap({ deleted: ids.length });
    },
  
    updateUserStatus: async (id: string, status: User['status']): Promise<ApiResponse<User>> => {
      const data = await request<User>(`/admin/users/${id}/status`, {
        method: 'PATCH', body: JSON.stringify({ status }),
      });
      return wrap(data);
    },
  
    assignUserRole: async (userId: string, roleId: string): Promise<ApiResponse<User>> => {
      const data = await request<User>(`/admin/users/${userId}/roles`, {
        method: 'POST', body: JSON.stringify({ roleId }),
      });
      return wrap(data);
    },
  
    resetUserPassword: async (id: string): Promise<ApiResponse<{ emailSent: boolean }>> => {
      const data = await request<{ emailSent: boolean }>(`/admin/users/${id}/reset-password`, { method: 'POST' });
      return wrap(data);
    },
  };
  
  // ─── Roles ────────────────────────────────────────────────────────────────────
  
  export const adminRoleService = {
    getRoles: async (): Promise<ApiResponse<Role[]>> => {
      const data = await request<Role[]>('/admin/roles');
      return wrap(data);
    },
  
    createRole: async (body: Omit<Role, 'id' | 'userCount' | 'createdAt'>): Promise<ApiResponse<Role>> => {
      const data = await request<Role>('/admin/roles', { method: 'POST', body: JSON.stringify(body) });
      return wrap(data);
    },
  
    updateRole: async (id: string, body: Partial<Role>): Promise<ApiResponse<Role>> => {
      const data = await request<Role>(`/admin/roles/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      return wrap(data);
    },
  
    deleteRole: async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
      await request(`/admin/roles/${id}`, { method: 'DELETE' });
      return wrap({ deleted: true });
    },
  };
  
  // ─── Groups ───────────────────────────────────────────────────────────────────
  
  export const adminGroupService = {
    getGroups: async (): Promise<ApiResponse<Group[]>> => {
      const data = await request<Group[]>('/admin/groups');
      return wrap(data);
    },
  
    createGroup: async (body: Omit<Group, 'id' | 'createdAt'>): Promise<ApiResponse<Group>> => {
      const data = await request<Group>('/admin/groups', { method: 'POST', body: JSON.stringify(body) });
      return wrap(data);
    },
  
    updateGroup: async (id: string, body: Partial<Group>): Promise<ApiResponse<Group>> => {
      const data = await request<Group>(`/admin/groups/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      return wrap(data);
    },
  
    deleteGroup: async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
      await request(`/admin/groups/${id}`, { method: 'DELETE' });
      return wrap({ deleted: true });
    },
  
    addMember: async (groupId: string, userId: string): Promise<ApiResponse<Group>> => {
      const data = await request<Group>(`/admin/groups/${groupId}/members`, {
        method: 'POST', body: JSON.stringify({ userId }),
      });
      return wrap(data);
    },
  
    removeMember: async (groupId: string, userId: string): Promise<ApiResponse<Group>> => {
      const data = await request<Group>(`/admin/groups/${groupId}/members/${userId}`, { method: 'DELETE' });
      return wrap(data);
    },
  };
  
  // ─── Monitoring ───────────────────────────────────────────────────────────────
  
  export const adminMonitoringService = {
    getMetrics: async (): Promise<ApiResponse<SystemMetric[]>> => {
      const data = await request<SystemMetric[]>('/admin/monitoring/metrics');
      return wrap(data);
    },
  
    getActivityLogs: async (
      filters?: { userId?: string; action?: string; from?: string; to?: string },
      pagination?: Partial<PaginationParams>
    ): Promise<ApiResponse<ActivityLog[]>> => {
      const params = new URLSearchParams();
      if (filters?.userId) params.set('actorId', filters.userId);
      if (filters?.action) params.set('action', filters.action);
      if (pagination?.page) params.set('offset', String(((pagination.page ?? 1) - 1) * (pagination.limit ?? 50)));
      if (pagination?.limit) params.set('limit', String(pagination.limit));
      const data = await request<ActivityLog[]>(`/admin/logs?${params}`);
      return wrap(data);
    },
  };
  
  // ─── Settings ─────────────────────────────────────────────────────────────────
  
  export const adminSettingsService = {
    getSettings: async (): Promise<ApiResponse<SystemSettings>> => {
      const data = await request<SystemSettings>('/admin/settings');
      return wrap(data);
    },
  
    updateSettings: async (
      section: keyof SystemSettings,
      body: Partial<SystemSettings[keyof SystemSettings]>
    ): Promise<ApiResponse<SystemSettings>> => {
      const data = await request<SystemSettings>(`/admin/settings/${section}`, {
        method: 'PATCH', body: JSON.stringify(body),
      });
      return wrap(data);
    },
  
    testEmailConfig: async (): Promise<ApiResponse<{ success: boolean }>> => {
      const data = await request<{ success: boolean }>('/admin/settings/test-email', { method: 'POST' });
      return wrap(data);
    },
  };