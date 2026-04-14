const API_BASE = import.meta.env.VITE_API_URL;
import { getAuthToken } from './tokenStore';

export interface Channel {
  id: string;
  name: string;
  key: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Binding {
  id: string;
  channelId: string;
  channel: Channel;
  layoutConfig: Record<string, any>;
  createdAt: string;
}

export interface CreateBindingRequest {
  channelId: string;
  layoutConfig: Record<string, any>;
}

type TemplateBindingsResponse = {
  bindings?: Array<{
    id: string;
    channelId: string;
    createdAt: string;
    layoutConfig?: Record<string, any>;
  }>;
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

export const channelService = {
  listChannels: async (): Promise<Channel[]> => {
    return request<Channel[]>('/channels');
  },

  createBinding: async (templateId: string, binding: CreateBindingRequest): Promise<Binding> => {
    return request<Binding>(`/templates/${templateId}/bindings`, {
      method: 'POST',
      body: JSON.stringify(binding),
    });
  },

  deleteBinding: async (templateId: string, bindingId: string): Promise<boolean> => {
    await request<void>(`/templates/${templateId}/bindings/${bindingId}`, {
      method: 'DELETE',
    });
    return true;
  },

  // Compatibility helper: use GET /templates/{id} then enrich with channel metadata.
  getBindings: async (templateId: string): Promise<Binding[]> => {
    const [tpl, channels] = await Promise.all([
      request<TemplateBindingsResponse>(`/templates/${templateId}`, { method: 'GET' }),
      channelService.listChannels(),
    ]);
    return (tpl.bindings ?? []).map((b) => {
      const channel =
        channels.find((c) => c.id === b.channelId) ??
        ({
          id: b.channelId,
          name: b.channelId,
          key: 'channel',
          description: '',
          createdAt: b.createdAt,
          updatedAt: b.createdAt,
        } as Channel);
      return {
        id: b.id,
        channelId: b.channelId,
        channel,
        layoutConfig: b.layoutConfig ?? {},
        createdAt: b.createdAt,
      };
    });
  },
};
