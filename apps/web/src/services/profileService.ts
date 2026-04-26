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
  folderId: string | null;
  folderName: string | null;
};

export type ProfileBookmarkFolder = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  bookmarkCount: number;
};

export type ProfileBookmarkNotification = {
  id: string;
  contentId: string;
  contentTitle: string;
  type: 'BODY_UPDATED' | 'PUBLISHED';
  message: string;
  createdAt: string;
  readAt: string | null;
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

  listBookmarks: async (
    query?: string,
    folderId?: string | 'default',
  ): Promise<ProfileBookmarkItem[]> => {
    const params = new URLSearchParams();
    if (query?.trim()) params.set('q', query.trim());
    if (folderId) params.set('folderId', folderId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const data = await request<{ items: ProfileBookmarkItem[] }>(`/profile/me/bookmarks${qs}`);
    return data.items;
  },

  listBookmarkFolders: async (): Promise<ProfileBookmarkFolder[]> => {
    const data = await request<{ items: ProfileBookmarkFolder[] }>('/profile/bookmarks/folders');
    return data.items;
  },

  createBookmarkFolder: async (name: string): Promise<ProfileBookmarkFolder> => {
    return request<ProfileBookmarkFolder>('/profile/bookmarks/folders', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  renameBookmarkFolder: async (folderId: string, name: string): Promise<ProfileBookmarkFolder> => {
    return request<ProfileBookmarkFolder>(`/profile/bookmarks/folders/${folderId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  },

  deleteBookmarkFolder: async (folderId: string): Promise<void> => {
    await request<void>(`/profile/bookmarks/folders/${folderId}`, { method: 'DELETE' });
  },

  moveBookmarkToFolder: async (
    bookmarkId: string,
    folderId: string | null,
  ): Promise<{ id: string; folderId: string | null; folderName: string | null }> => {
    return request(`/profile/bookmarks/${bookmarkId}`, {
      method: 'PATCH',
      body: JSON.stringify({ folderId }),
    });
  },

  listBookmarkNotifications: async (
    unreadOnly = false,
  ): Promise<ProfileBookmarkNotification[]> => {
    const qs = unreadOnly ? '?unreadOnly=true' : '';
    const data = await request<{ items: ProfileBookmarkNotification[] }>(
      `/profile/bookmarks/notifications${qs}`,
    );
    return data.items;
  },

  markBookmarkNotificationRead: async (id: string): Promise<void> => {
    await request<void>(`/profile/bookmarks/notifications/${id}/read`, { method: 'PATCH' });
  },

  markAllBookmarkNotificationsRead: async (): Promise<{ updated: number }> => {
    return request<{ updated: number }>('/profile/bookmarks/notifications/read-all', {
      method: 'POST',
    });
  },

  listBookmarksLegacy: async (query?: string): Promise<ProfileBookmarkItem[]> => {
    const qs = query?.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
    const data = await request<{ items: ProfileBookmarkItem[] }>(`/profile/me/bookmarks${qs}`);
    return data.items;
  },

  /** Heartbeat while the SPA is open — updates server presence for admin “Active now”. */
  sendPresencePing: async (): Promise<void> => {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE}/profile/presence`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(err.error || err.message || `HTTP ${res.status}`);
    }
  },

  /** Call before clearing the session so admin “Active now” drops immediately. */
  clearPresence: async (): Promise<void> => {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE}/profile/presence`, {
      method: 'DELETE',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(err.error || err.message || `HTTP ${res.status}`);
    }
  },
};
