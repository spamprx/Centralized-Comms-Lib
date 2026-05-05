import { resolveApiV1Base } from '../lib/apiBase';
import { csrfHeader } from './tokenStore';

const API_BASE = resolveApiV1Base();

export type LoginResponse = {
  user: {
    id: string;
    email: string;
    displayName?: string | null;
    createdAt?: string;
    updatedAt?: string;
    role?: string;
  };
  role?: string;
  /** Legacy: API no longer returns JWT in JSON (HttpOnly cookie only). */
  token?: string;
};

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const method = options.method ?? 'GET';
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeader(method),
      ...(options.headers as Record<string, string>),
    },
    credentials: 'include',
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.error || err.message || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const authService = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    return request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  register: async (
    email: string,
    displayName: string,
    password: string,
  ): Promise<LoginResponse> => {
    return request<LoginResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, displayName, password }),
    });
  },
  logout: async (): Promise<void> => {
    await request('/auth/logout', { method: 'POST' });
  },
  me: async (): Promise<{
    user: LoginResponse['user'] | null;
    role: string | null;
  }> => {
    return request('/auth/me');
  },
};
