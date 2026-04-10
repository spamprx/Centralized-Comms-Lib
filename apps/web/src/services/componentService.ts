import { getAuthToken } from './tokenStore';

const API_BASE = import.meta.env.VITE_API_URL;

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

type CreateComponentVersionPayload = {
  version: string;
  linkRefs?: unknown;
  propSchema?: unknown;
};

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}${endpoint}`, {
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
    throw new Error(err.error || err.message || `HTTP ${res.status}`);
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

