import { resolveApiV1Base } from '../lib/apiBase';
import { csrfHeader } from './tokenStore';

const API_BASE = resolveApiV1Base();

export interface EmailRecipient {
  user_id: string;
  email: string;
}

export interface EmailSendRequest {
  event_type: string;
  recipients: EmailRecipient[];
  blocks: unknown[];
  field_values?: Record<string, string>;
  client_id?: string;
  attachments?: unknown[];
  subject?: string;
}

export interface EmailSendResponse {
  notify_payload: unknown;
  notify_response?: { ok: boolean; status: number; body: unknown };
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
    throw new Error(
      (err as { error?: string; message?: string }).error ||
        (err as { message?: string }).message ||
        `HTTP ${res.status}`,
    );
  }

  return res.json();
}

export const emailSendService = {
  send: async (payload: EmailSendRequest): Promise<EmailSendResponse> => {
    return request<EmailSendResponse>('/email-send/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  preview: async (payload: EmailSendRequest): Promise<{ notify_payload: unknown }> => {
    return request<{ notify_payload: unknown }>('/email-send/preview', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
