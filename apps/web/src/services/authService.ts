const API_BASE = import.meta.env.VITE_API_URL;

export type LoginResponse = {
  user: {
    id: string;
    email: string;
    displayName?: string | null;
    createdAt?: string;
    updatedAt?: string;
    /** Present when the API includes it; otherwise derive from JWT after login. */
    role?: string;
  };
  token: string;
};

import { getAuthToken } from './tokenStore';

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
  me: async (): Promise<LoginResponse> => {
    return request<LoginResponse>('/auth/me');
  },
};
