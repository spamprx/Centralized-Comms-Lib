import { getAuthToken } from './tokenStore';
import { resolveApiV1Base } from '../lib/apiBase';

const API_BASE = resolveApiV1Base();

export type ProfileMe = {
  id: string;
  displayName: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  location: string | null;
  bio: string | null;
  stats: {
    contentCreated: number;
    totalViews: number;
    following: number;
  };
};

export type ProfileActivityItem = {
  id: string;
  type: 'PUBLISHED' | 'COMMENTED' | 'CREATED';
  contentId: string;
  contentTitle: string;
  timestamp: string;
};

export type ProfileBookmarkItem = {
  id: string;
  contentId: string;
  title: string;
  contentType: 'ARTICLE' | 'VIDEO' | 'PODCAST' | 'DOCUMENT';
  savedAt: string;
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

export const profileService = {
  me: async (): Promise<ProfileMe> => request<ProfileMe>('/profile/me'),

  updateMe: async (input: {
    displayName?: string;
    email?: string;
  }): Promise<{ id: string; displayName: string; email: string }> =>
    request('/profile/me', {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  listActivity: async (): Promise<ProfileActivityItem[]> => {
    const data = await request<{ items: ProfileActivityItem[] }>('/profile/me/activity');
    return data.items;
  },

  listBookmarks: async (query?: string): Promise<ProfileBookmarkItem[]> => {
    const qs = query?.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
    const data = await request<{ items: ProfileBookmarkItem[] }>(`/profile/me/bookmarks${qs}`);
    return data.items;
  },
};
