import { csrfHeader } from './tokenStore';
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

export type ProfilePushNotification = {
  id: string;
  type: 'PUSH_SENT';
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

export type FirebaseClientConfig = {
  config: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId?: string;
  };
  vapidKey: string;
};

export type PushRecipientCandidate = {
  id: string;
  displayName: string;
  email: string;
  isActive: boolean;
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
  const raw = await res.text();
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    if (raw.trim()) {
      try {
        const err = JSON.parse(raw) as { error?: string; message?: string };
        message = err.error || err.message || message;
      } catch {
        message = raw.length > 280 ? `${raw.slice(0, 280)}…` : raw;
      }
    }
    throw new Error(message);
  }
  // 204 / empty body: void endpoints (e.g. PATCH …/read) must not call JSON.parse on ""
  if (!raw.trim()) {
    return undefined as T;
  }
  return JSON.parse(raw) as T;
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

  listPushNotifications: async (unreadOnly = false): Promise<ProfilePushNotification[]> => {
    const qs = unreadOnly ? '?unreadOnly=true' : '';
    const data = await request<{ items: ProfilePushNotification[] }>(
      `/profile/me/push-notifications${qs}`,
    );
    return data.items;
  },

  markPushNotificationRead: async (id: string): Promise<void> => {
    await request<void>(`/profile/me/push-notifications/${id}/read`, { method: 'PATCH' });
  },

  markAllPushNotificationsRead: async (): Promise<{ updated: number }> => {
    return request<{ updated: number }>('/profile/me/push-notifications/read-all', {
      method: 'POST',
    });
  },

  getFirebaseClientConfig: async (): Promise<FirebaseClientConfig> =>
    request<FirebaseClientConfig>('/firebase-config'),

  registerDeviceFcmToken: async (input: {
    token: string;
    deviceId: string;
  }): Promise<{ id: string; deviceId: string; updatedAt: string }> =>
    request('/profile/me/fcm-token', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  listPushRecipientCandidates: async (): Promise<PushRecipientCandidate[]> => {
    const data = await request<{ items: PushRecipientCandidate[] }>('/profile/push-recipients');
    return data.items;
  },

  unregisterDeviceFcmToken: async (deviceId: string): Promise<void> => {
    await request<void>(`/profile/me/fcm-token/${encodeURIComponent(deviceId)}`, {
      method: 'DELETE',
    });
  },

  listBookmarksLegacy: async (query?: string): Promise<ProfileBookmarkItem[]> => {
    const qs = query?.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
    const data = await request<{ items: ProfileBookmarkItem[] }>(`/profile/me/bookmarks${qs}`);
    return data.items;
  },

  /** Heartbeat while the SPA is open — updates server presence for admin “Active now”. */
  sendPresencePing: async (): Promise<void> => {
    const res = await fetch(`${API_BASE}/profile/presence`, {
      method: 'POST',
      headers: {
        ...csrfHeader('POST'),
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
    const res = await fetch(`${API_BASE}/profile/presence`, {
      method: 'DELETE',
      headers: {
        ...csrfHeader('DELETE'),
      },
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(err.error || err.message || `HTTP ${res.status}`);
    }
  },
};
