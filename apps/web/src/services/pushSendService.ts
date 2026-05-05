import { resolveApiV1Base } from '../lib/apiBase';
import { csrfHeader } from './tokenStore';

const API_BASE = resolveApiV1Base();

export interface PushRecipient {
  user_id: string;
}

export interface PushSendRequest {
  event_type: string;
  recipients: PushRecipient[];
  blocks: unknown[];
  field_values?: Record<string, string>;
  title?: string;
}

export interface PushSendResponse {
  title: string;
  body: string;
  recipientCount: number;
  tokenCount: number;
  deliveredCount: number;
  failedCount: number;
  results: Array<{
    userId: string;
    deviceId: string;
    ok: boolean;
    status: number;
    responseBody: unknown;
  }>;
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

export const pushSendService = {
  send: async (payload: PushSendRequest): Promise<PushSendResponse> =>
    request<PushSendResponse>('/push-send/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
