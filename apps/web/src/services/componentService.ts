import { resolveApiV1Base } from '../lib/apiBase';
import { getAuthToken } from './tokenStore';

const API_BASE = resolveApiV1Base();

type CreateComponentPayload = {
  key: string;
  name: string;
  description?: string | null;
};

type CreateComponentResponse = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
};

export type ComponentRecord = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

type CreateComponentVersionPayload = {
  version: string;
  linkRefs?: unknown;
  propSchema?: unknown;
};

function joinApiUrl(endpoint: string): string {
  const base = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const url = joinApiUrl(endpoint);
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
    const baseMsg = typeof err.error === 'string' ? err.error : typeof err.message === 'string' ? err.message : `HTTP ${res.status}`;
    const method = (options.method ?? 'GET').toUpperCase();
    const withUrl =
      baseMsg === 'Route not found' || import.meta.env.DEV
        ? `${baseMsg} — ${method} ${url}`
        : baseMsg;
    throw new Error(withUrl);
  }

  return res.json();
}

export const componentService = {
  create: async (payload: CreateComponentPayload): Promise<CreateComponentResponse> => {
    return request<CreateComponentResponse>('/components', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  list: async (): Promise<ComponentRecord[]> => {
    return request<ComponentRecord[]>('/components');
  },

  /** Server-side filter on key, name, and description (substring). Empty query returns all. */
  search: async (q: string): Promise<ComponentRecord[]> => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    const suffix = params.toString();
    return request<ComponentRecord[]>(suffix ? `/components/search?${suffix}` : '/components/search');
  },

  createVersion: async (
    componentId: string,
    payload: CreateComponentVersionPayload,
  ): Promise<unknown> => {
    return request(`/components/${componentId}/versions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

