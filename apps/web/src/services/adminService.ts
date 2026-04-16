import { joinApiV1Path } from '../lib/apiBase';
import type {
  User,
  SystemMetric,
  SystemSettings,
  ApiResponse,
  UserFilters,
  PaginationParams,
} from '../types/admin';
import type {
  ApiAuditEntry,
  ApiGroupDetail,
  ApiGroupSummary,
  ApiPermission,
  ApiRoleRow,
  ApiUserRow,
} from '../lib/adminApi';
import { getAuthToken } from './tokenStore';

export type AdminUserActivityEvent = {
  type: 'user_last_active';
  userId: string;
  lastActiveAt?: string;
  presencePingAt?: string | null;
};

/**
 * Long-lived fetch to the admin SSE endpoint. Call the returned function to abort.
 * No-op if there is no auth token.
 */
export function subscribeAdminUsersActivity(
  onEvent: (e: AdminUserActivityEvent) => void,
): () => void {
  const token = getAuthToken();
  if (!token) return () => {};

  const url = joinApiV1Path('/admin/users/activity-stream');
  const ac = new AbortController();

  void (async () => {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: ac.signal,
      });
      if (!res.ok || !res.body) return;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let sep: number;
        while ((sep = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, sep);
          buf = buf.slice(sep + 2);
          for (const line of block.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6)) as AdminUserActivityEvent;
              if (data.type === 'user_last_active') onEvent(data);
            } catch {
              /* ignore malformed */
            }
          }
        }
      }
    } catch {
      /* aborted or network */
    }
  })();

  return () => ac.abort();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const url = joinApiV1Path(path);
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    credentials: 'include',
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(
      (err as { error?: string }).error ||
        (err as { message?: string }).message ||
        `HTTP ${res.status}`,
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function wrap<T>(data: T): ApiResponse<T> {
  return { data };
}

export type CreateUserPayload = {
  email: string;
  displayName: string;
  password: string;
  roleId?: string | null;
};

// ─── Users ────────────────────────────────────────────────────────────────────

export const adminUserService = {
  getUsers: async (
    filters?: Partial<UserFilters>,
    pagination?: Partial<PaginationParams>,
  ): Promise<ApiResponse<User[]>> => {
    const params = new URLSearchParams();
    if (filters?.search) params.set('search', filters.search);
    if (filters?.role && filters.role !== 'all') params.set('role', filters.role);
    if (filters?.sortBy) params.set('sortBy', filters.sortBy);
    if (filters?.sortOrder) params.set('sortOrder', filters.sortOrder);
    if (pagination?.page) params.set('page', String(pagination.page));
    if (pagination?.limit) params.set('limit', String(pagination.limit));
    const query = params.toString();
    const data = await request<ApiUserRow[]>(query ? `/admin/users?${query}` : '/admin/users');
    return wrap(data as unknown as User[]);
  },

  getUserById: async (id: string): Promise<ApiResponse<ApiUserRow>> => {
    const data = await request<ApiUserRow>(`/admin/users/${id}`);
    return wrap(data);
  },

  createUser: async (body: CreateUserPayload): Promise<ApiResponse<ApiUserRow>> => {
    const data = await request<ApiUserRow>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return wrap(data);
  },

  updateUser: async (
    id: string,
    body: {
      displayName?: string;
      email?: string;
      isActive?: boolean;
      avatarUrl?: string | null;
      roleId?: string | null;
    },
  ): Promise<ApiResponse<ApiUserRow>> => {
    const data = await request<ApiUserRow>(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    return wrap(data);
  },

  deleteUser: async (id: string): Promise<ApiResponse<{ deactivated: boolean }>> => {
    await request<{ deactivated?: boolean }>(`/admin/users/${id}`, { method: 'DELETE' });
    return wrap({ deactivated: true });
  },

  bulkDeleteUsers: async (ids: string[]): Promise<ApiResponse<{ deleted: number }>> => {
    const out = await request<{ count: number }>('/admin/users/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
    return wrap({ deleted: out.count });
  },

  bulkSetUsersActive: async (
    ids: string[],
    isActive: boolean,
  ): Promise<ApiResponse<{ count: number }>> => {
    const out = await request<{ count: number }>('/admin/users/bulk-status', {
      method: 'POST',
      body: JSON.stringify({ ids, isActive }),
    });
    return wrap({ count: out.count });
  },

  assignUserRole: async (userId: string, roleId: string): Promise<void> => {
    await request(`/admin/users/${userId}/roles`, {
      method: 'POST',
      body: JSON.stringify({ roleId }),
    });
  },

  resetUserPassword: async (
    id: string,
  ): Promise<ApiResponse<{ emailSent: boolean; message?: string }>> => {
    const data = await request<{ emailSent: boolean; message?: string }>(
      `/admin/users/${id}/reset-password`,
      {
        method: 'POST',
      },
    );
    return wrap(data);
  },
};

// ─── Roles & permissions ─────────────────────────────────────────────────────

export const adminRoleService = {
  getRoles: async (): Promise<ApiResponse<ApiRoleRow[]>> => {
    const data = await request<ApiRoleRow[]>('/admin/roles');
    return wrap(data);
  },

  getPermissions: async (roleId: string): Promise<ApiResponse<ApiPermission[]>> => {
    const data = await request<ApiPermission[]>(`/admin/roles/${roleId}/permissions`);
    return wrap(data);
  },

  createRole: async (body: {
    name: string;
    description?: string | null;
  }): Promise<ApiResponse<ApiRoleRow>> => {
    const data = await request<ApiRoleRow>('/admin/roles', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return wrap(data);
  },

  updateRole: async (
    id: string,
    body: { name?: string; description?: string | null },
  ): Promise<ApiResponse<ApiRoleRow>> => {
    const data = await request<ApiRoleRow>(`/admin/roles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    return wrap(data);
  },

  deleteRole: async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    await request(`/admin/roles/${id}`, { method: 'DELETE' });
    return wrap({ deleted: true });
  },

  createPermission: async (
    roleId: string,
    body: { action: string; resource: string },
  ): Promise<ApiResponse<ApiPermission>> => {
    const data = await request<ApiPermission>(`/admin/roles/${roleId}/permissions`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return wrap(data);
  },

  deletePermission: async (permissionId: string): Promise<void> => {
    await request(`/admin/permissions/${permissionId}`, { method: 'DELETE' });
  },
};

// ─── Groups ───────────────────────────────────────────────────────────────────

export const adminGroupService = {
  getGroups: async (): Promise<ApiResponse<ApiGroupSummary[]>> => {
    const data = await request<ApiGroupSummary[]>('/admin/groups');
    return wrap(data);
  },

  getGroupById: async (id: string): Promise<ApiResponse<ApiGroupDetail>> => {
    const data = await request<ApiGroupDetail>(`/admin/groups/${id}`);
    return wrap(data);
  },

  createGroup: async (body: {
    name: string;
    description?: string | null;
  }): Promise<ApiResponse<ApiGroupDetail>> => {
    const created = await request<ApiGroupSummary>('/admin/groups', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const full = await request<ApiGroupDetail>(`/admin/groups/${created.id}`);
    return wrap(full);
  },

  updateGroup: async (
    id: string,
    body: { name?: string; description?: string | null },
  ): Promise<ApiResponse<ApiGroupDetail>> => {
    await request(`/admin/groups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    const full = await request<ApiGroupDetail>(`/admin/groups/${id}`);
    return wrap(full);
  },

  deleteGroup: async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    await request(`/admin/groups/${id}`, { method: 'DELETE' });
    return wrap({ deleted: true });
  },

  addMember: async (groupId: string, userId: string): Promise<void> => {
    await request(`/admin/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  removeMember: async (groupId: string, userId: string): Promise<void> => {
    await request(`/admin/groups/${groupId}/members/${userId}`, { method: 'DELETE' });
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
    pagination?: Partial<PaginationParams>,
  ): Promise<ApiResponse<ApiAuditEntry[]>> => {
    const params = new URLSearchParams();
    if (filters?.userId) params.set('actorId', filters.userId);
    if (filters?.action) params.set('action', filters.action);
    if (filters?.from) params.set('from', filters.from);
    if (filters?.to) params.set('to', filters.to);
    const limit = pagination?.limit ?? 50;
    const page = pagination?.page ?? 1;
    params.set('offset', String((page - 1) * limit));
    params.set('limit', String(limit));
    const data = await request<ApiAuditEntry[]>(`/admin/logs?${params.toString()}`);
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
    body: Partial<SystemSettings[keyof SystemSettings]>,
  ): Promise<ApiResponse<SystemSettings>> => {
    const data = await request<SystemSettings>(`/admin/settings/${section}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    return wrap(data);
  },

  testEmailConfig: async (): Promise<ApiResponse<{ success: boolean; message?: string }>> => {
    const data = await request<{ success: boolean; message?: string }>(
      '/admin/settings/test-email',
      {
        method: 'POST',
      },
    );
    return wrap(data);
  },
};

// ─── Review policies (F-ADM-004) ─────────────────────────────────────────────

export type ApiReviewPolicy = {
  id: string;
  contentType: 'ARTICLE' | 'VIDEO' | 'PODCAST' | 'DOCUMENT';
  channelId: string | null;
  userGroupId: string | null;
  quorumRequired: number;
  isActive: boolean;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
};

export const adminReviewPolicyService = {
  list: async (): Promise<ApiResponse<ApiReviewPolicy[]>> => {
    const data = await request<ApiReviewPolicy[]>('/admin/review-policies', {
      method: 'GET',
    });
    return wrap(data);
  },

  create: async (body: {
    contentType: ApiReviewPolicy['contentType'];
    channelId?: string | null;
    userGroupId?: string | null;
    quorumRequired: number;
    isActive?: boolean;
  }): Promise<ApiResponse<ApiReviewPolicy>> => {
    const data = await request<ApiReviewPolicy>('/admin/review-policies', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return wrap(data);
  },

  update: async (
    id: string,
    body: Partial<{
      contentType: ApiReviewPolicy['contentType'];
      channelId: string | null;
      userGroupId: string | null;
      quorumRequired: number;
      isActive: boolean;
    }>,
  ): Promise<ApiResponse<ApiReviewPolicy>> => {
    const data = await request<ApiReviewPolicy>(`/admin/review-policies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    return wrap(data);
  },

  delete: async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    const data = await request<{ deleted: boolean }>(`/admin/review-policies/${id}`, {
      method: 'DELETE',
    });
    return wrap(data);
  },
};

export type {
  ApiUserRow,
  ApiPermission,
  ApiRoleRow,
  ApiGroupDetail,
  ApiGroupSummary,
  ApiAuditEntry,
};
