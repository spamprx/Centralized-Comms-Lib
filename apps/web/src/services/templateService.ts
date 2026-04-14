import { getAuthToken } from './tokenStore';
import type { Tag } from './tagService';
import type { Binding } from './channelService';

const API_BASE = import.meta.env.VITE_API_URL;

export type TemplateStatus = 'active' | 'draft' | 'archived';

export interface Template {
  id: string;
  name: string;
  description: string;
  content: string;
  status: TemplateStatus;
  createdAt: string;
  updatedAt: string;
  tags?: Tag[];
  bindings?: Binding[];
}

export interface CreateTemplateRequest {
  name: string;
  description: string;
  content: string;
  status?: TemplateStatus;
}

export interface UpdateTemplateRequest {
  name?: string;
  description?: string;
  content?: string;
  status?: TemplateStatus;
}

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

export const templateService = {
  list: async (): Promise<Template[]> => {
    return request<Template[]>('/templates', { method: 'GET' });
  },

  getById: async (id: string): Promise<Template> => {
    return request<Template>(`/templates/${id}`, { method: 'GET' });
  },

  create: async (template: CreateTemplateRequest): Promise<Template> => {
    return request<Template>('/templates', {
      method: 'POST',
      body: JSON.stringify(template),
    });
  },

  update: async (id: string, template: UpdateTemplateRequest): Promise<Template> => {
    return request<Template>(`/templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(template),
    });
  },

  delete: async (id: string): Promise<void> => {
    await request<void>(`/templates/${id}`, { method: 'DELETE' });
  },

  clone: async (id: string): Promise<Template> => {
    return request<Template>(`/templates/${id}/clone`, { method: 'POST' });
  },
};
