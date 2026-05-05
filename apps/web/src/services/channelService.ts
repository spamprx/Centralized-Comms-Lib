import { resolveApiV1Base } from '../lib/apiBase';
const API_BASE = resolveApiV1Base();
import { csrfHeader } from './tokenStore';

export type ChannelCompatibility = {
  fieldTypes?: string[];
  restrictions?: Record<string, unknown>;
};

export interface Channel {
  id: string;
  name: string;
  key: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  /** Present when channels are loaded from the API (drives layout editor toolbar). */
  compatibility?: ChannelCompatibility;
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

// API availability cache
const API_AVAILABILITY_KEY = 'channel_api_available';

// Fallback static channels data
const FALLBACK_CHANNELS: Channel[] = [
  {
    id: 'dbb11a78-f158-4e26-b375-f2893c3ef868',
    name: 'Email',
    key: 'email',
    description: 'Email clients',
    createdAt: '2026-04-06T07:12:12.161Z',
    updatedAt: '2026-04-06T07:12:12.161Z',
  },
  {
    id: '90eac80c-e23b-438d-ad3f-f1086929c4c8',
    name: 'WhatsApp',
    key: 'whatsapp',
    description: 'WhatsApp messages',
    createdAt: '2026-04-06T07:12:12.165Z',
    updatedAt: '2026-04-06T07:12:12.165Z',
  },
  {
    id: '3c9e4b1e-fe88-41a1-8211-f752c0320d3d',
    name: 'SMS',
    key: 'sms',
    description: 'SMS text messages',
    createdAt: '2026-04-06T07:12:12.153Z',
    updatedAt: '2026-04-06T07:12:12.153Z',
  },
  {
    id: '8f35b2f4-2d07-42cd-a0c4-f6d28f77f6d5',
    name: 'Push Notification',
    key: 'push',
    description: 'Mobile and browser push notifications',
    createdAt: '2026-04-06T07:12:12.171Z',
    updatedAt: '2026-04-06T07:12:12.171Z',
  },
];

async function isApiAvailable(): Promise<boolean> {
  const cached = localStorage.getItem(API_AVAILABILITY_KEY);
  if (cached !== null) return cached === 'true';

  try {
    await request<Channel[]>('/channels', { method: 'GET' });
    localStorage.setItem(API_AVAILABILITY_KEY, 'true');
    return true;
  } catch (error) {
    localStorage.setItem(API_AVAILABILITY_KEY, 'false');
    return false;
  }
}

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

// localStorage fallback functions
function getBindingsFromStorage(templateId: string): Binding[] {
  try {
    const saved = localStorage.getItem(`template_bindings_${templateId}`);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('Error parsing bindings from localStorage:', error);
    return [];
  }
}

function saveBindingsToStorage(templateId: string, bindings: Binding[]): void {
  try {
    localStorage.setItem(`template_bindings_${templateId}`, JSON.stringify(bindings));
  } catch (error) {
    console.error('Error saving bindings to localStorage:', error);
    // Handle localStorage errors silently
  }
}

// API methods
async function apiListChannels(): Promise<Channel[]> {
  return request<Channel[]>('/channels');
}

async function apiCreateBinding(
  templateId: string,
  binding: CreateBindingRequest,
): Promise<Binding> {
  return request<Binding>(`/templates/${templateId}/bindings`, {
    method: 'POST',
    body: JSON.stringify(binding),
  });
}

async function apiDeleteBinding(templateId: string, bindingId: string): Promise<void> {
  return request<void>(`/templates/${templateId}/bindings/${bindingId}`, {
    method: 'DELETE',
  });
}

// localStorage methods
function localStorageListChannels(): Channel[] {
  return FALLBACK_CHANNELS;
}

function localStorageCreateBinding(templateId: string, binding: CreateBindingRequest): Binding {
  const bindings = getBindingsFromStorage(templateId);
  const channel = FALLBACK_CHANNELS.find((c) => c.id === binding.channelId);

  if (!channel) {
    throw new Error('Channel not found');
  }

  const newBinding: Binding = {
    id: `binding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    channelId: binding.channelId,
    channel,
    layoutConfig: binding.layoutConfig,
    createdAt: new Date().toISOString(),
  };

  const updated = [...bindings, newBinding];
  saveBindingsToStorage(templateId, updated);
  return newBinding;
}

function localStorageDeleteBinding(templateId: string, bindingId: string): boolean {
  const bindings = getBindingsFromStorage(templateId);
  const filtered = bindings.filter((b) => b.id !== bindingId);

  if (filtered.length === bindings.length) return false;

  saveBindingsToStorage(templateId, filtered);
  return true;
}

// Main service with hybrid strategy
export const channelService = {
  listChannels: async (): Promise<Channel[]> => {
    if (await isApiAvailable()) {
      try {
        return await apiListChannels();
      } catch (error) {
        // Fallback to localStorage
        return localStorageListChannels();
      }
    }
    return localStorageListChannels();
  },

  createBinding: async (templateId: string, binding: CreateBindingRequest): Promise<Binding> => {
    if (await isApiAvailable()) {
      try {
        return await apiCreateBinding(templateId, binding);
      } catch (error) {
        // Fallback to localStorage
        return localStorageCreateBinding(templateId, binding);
      }
    }
    return localStorageCreateBinding(templateId, binding);
  },

  deleteBinding: async (templateId: string, bindingId: string): Promise<boolean> => {
    if (await isApiAvailable()) {
      try {
        await apiDeleteBinding(templateId, bindingId);
        return true;
      } catch (error) {
        // Fallback to localStorage
        return localStorageDeleteBinding(templateId, bindingId);
      }
    }
    return localStorageDeleteBinding(templateId, bindingId);
  },

  getBindings: async (templateId: string): Promise<Binding[]> => {
    // For now, get from localStorage. In a real implementation, this would
    // be part of the template data from GET /templates/{id} (API is mounted under /api/v1)
    return getBindingsFromStorage(templateId);
  },

  // Utility method to reset API availability cache (for testing)
  resetApiCache: (): void => {
    localStorage.removeItem(API_AVAILABILITY_KEY);
  },
};
