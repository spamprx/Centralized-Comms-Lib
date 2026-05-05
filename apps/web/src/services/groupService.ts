import { resolveApiV1Base } from '../lib/apiBase';
import { csrfHeader } from './tokenStore';

const API_BASE = resolveApiV1Base();

export type ApiUserGroup = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeader(method),
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

export const groupService = {
  listMine: async (): Promise<ApiUserGroup[]> => {
    return request<ApiUserGroup[]>('/groups/mine');
  },
};

