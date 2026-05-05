import { resolveApiV1Base } from '../lib/apiBase';
import { csrfHeader } from './tokenStore';

const API_BASE = resolveApiV1Base();

export interface WaRecipient {
  user_id: string;
  wa_number: string;
}

export interface WaSendRequest {
  event_type: string;
  recipients: WaRecipient[];
  blocks: unknown[];
  field_values?: Record<string, string>;
  client_id?: string;
  attachments?: unknown[];
}

export interface WaSendResponse {
  id: string;
  notify_payload: unknown;
  notify_response?: { ok: boolean; status: number; body: unknown };
  message?: string;
}

export type PriorSentRecipient = {
  userId: string;
  waNumber: string;
  lastSentAt: string;
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
    const err = (await res.json().catch(() => ({ message: 'Request failed' }))) as {
      error?: string;
      message?: string;
      notify_response?: { body?: unknown };
      details?: unknown;
    };
    const notifyBody = err.notify_response?.body as
      | { detail?: unknown; error?: unknown; message?: unknown }
      | undefined;
    const detailText =
      (typeof notifyBody?.detail === 'string' && notifyBody.detail) ||
      (typeof notifyBody?.error === 'string' && notifyBody.error) ||
      (typeof notifyBody?.message === 'string' && notifyBody.message) ||
      undefined;
    throw new Error(
      err.error ||
        err.message ||
        detailText ||
        (typeof err.details === 'string' ? err.details : '') ||
        `HTTP ${res.status}`,
    );
  }

  return res.json();
}

export const whatsappSendService = {
  send: async (payload: WaSendRequest): Promise<WaSendResponse> => {
    return request<WaSendResponse>('/whatsapp-send/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  listPriorRecipients: async (contentId: string): Promise<{ items: PriorSentRecipient[] }> => {
    const q = new URLSearchParams({ contentId });
    return request<{ items: PriorSentRecipient[] }>(
      `/whatsapp-send/prior-recipients?${q.toString()}`,
    );
  },
};
