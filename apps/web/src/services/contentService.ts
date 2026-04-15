const API_BASE = String(import.meta.env.VITE_API_URL ?? '').trim();
import { getAuthToken } from './tokenStore';

export type LifecycleState = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'ARCHIVED';
export type Visibility = 'PUBLIC' | 'PRIVATE' | 'HIDDEN' | 'ARCHIVED' | 'PRIVATE_TO_GROUP';

export type ContentAuthor = {
  id: string;
  displayName: string;
  email: string;
};

export type Content = {
  id: string;
  title: string;
  slug: string;
  lifecycleState: LifecycleState;
  visibility: Visibility;
  contentType: 'ARTICLE' | 'VIDEO' | 'PODCAST' | 'DOCUMENT';
  aiGenerated: boolean;
  authorId: string;
  author?: ContentAuthor | null;
  visibilityGroupId: string | null;
  templateId?: string | null;
  /** Aggregated engagement counts (present in list responses). */
  viewsCount?: number;
  likesCount?: number;
  createdAt: string;
  updatedAt: string;
};

/** Mirrors API `ContentVersion` payloads used by the web app. */
export type ContentVersion = {
  id: string;
  versionNumber: number;
  title: string;
  changeType: string;
  body?: unknown | null;
  metadataSnapshot: unknown | null;
  createdAt: string;
  contentId: string;
  authorId: string;
};

export type ContentAnnotation = {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  contentId: string;
  author: { id: string; displayName: string; email: string };
  selectionFrom: number | null;
  selectionTo: number | null;
  selectionText: string | null;
};

export type ContentComment = {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  contentId: string;
  author: { id: string; displayName: string; email: string };
};

export type ContentEngagement = {
  views: number;
  likes: number;
  comments: number;
  likedByMe: boolean;
};

type ListFilters = {
  authorId?: string;
  lifecycleState?: LifecycleState;
  visibility?: Visibility;
  contentType?: Content['contentType'];
  limit?: number;
  offset?: number;
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

async function fetchOptionalJson<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
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
  if (res.status === 404) return { ok: false, status: 404 };
  if (!res.ok) return { ok: false, status: res.status };
  const data = (await res.json()) as T;
  return { ok: true, data };
}

/** Supports plain arrays or paginated envelopes once the API adds them. */
export function normalizeVersionListPayload(data: unknown): {
  items: ContentVersion[];
  total: number | null;
} {
  if (Array.isArray(data)) {
    return { items: data as ContentVersion[], total: data.length };
  }
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.items)) {
      return {
        items: o.items as ContentVersion[],
        total: typeof o.total === 'number' ? o.total : null,
      };
    }
    if (Array.isArray(o.versions)) {
      return {
        items: o.versions as ContentVersion[],
        total: typeof o.total === 'number' ? o.total : null,
      };
    }
  }
  return { items: [], total: 0 };
}

export const contentService = {
  list: async (filters: ListFilters = {}): Promise<Content[]> => {
    const params = new URLSearchParams();
    if (filters.authorId) params.set('authorId', filters.authorId);
    if (filters.lifecycleState) params.set('lifecycleState', filters.lifecycleState);
    if (filters.visibility) params.set('visibility', filters.visibility);
    if (filters.contentType) params.set('contentType', filters.contentType);
    if (typeof filters.limit === 'number') params.set('limit', String(filters.limit));
    if (typeof filters.offset === 'number') params.set('offset', String(filters.offset));
    const query = params.toString();
    return request<Content[]>(query ? `/content?${query}` : '/content');
  },

  createDraft: async (
    title: string,
    body?: unknown,
    options?: {
      templateId?: string | null;
      aiGenerated?: boolean;
      contentType?: Content['contentType'];
    },
  ): Promise<{ content: Content }> => {
    return request<{ content: Content }>('/content', {
      method: 'POST',
      body: JSON.stringify({
        title,
        body,
        templateId: options?.templateId ?? undefined,
        contentType: options?.contentType ?? undefined,
        aiGenerated: options?.aiGenerated,
      }),
    });
  },

  saveDraft: async (
    id: string,
    data: { title?: string; body?: unknown; contentType?: Content['contentType'] },
  ): Promise<unknown> => {
    return request<unknown>(`/content/${id}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string): Promise<void> => {
    await request<void>(`/content/${id}`, { method: 'DELETE' });
  },

  transitionState: async (id: string, lifecycleState: LifecycleState): Promise<Content> => {
    return request<Content>(`/content/${id}/STATE_TRANSITION`, {
      method: 'POST',
      body: JSON.stringify({ lifecycleState }),
    });
  },

  getById: async (
    id: string,
  ): Promise<{
    content: Content;
    versions: ContentVersion[];
    tags: Array<{ id: string; name: string; slug: string }>;
    coAuthors: Array<{ id: string; displayName: string; email: string }>;
  }> => {
    return request(`/content/${id}`);
  },

  listAnnotations: async (contentId: string): Promise<ContentAnnotation[]> => {
    return request<ContentAnnotation[]>(`/content/${contentId}/annotations`);
  },

  addAnnotation: async (
    contentId: string,
    data: { body: string; selectionFrom?: number; selectionTo?: number; selectionText?: string },
  ): Promise<ContentAnnotation> => {
    return request<ContentAnnotation>(`/content/${contentId}/annotations`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getBookmarkState: async (contentId: string): Promise<{ bookmarked: boolean }> => {
    return request<{ bookmarked: boolean }>(`/content/${contentId}/bookmark`);
  },

  bookmark: async (contentId: string): Promise<{ bookmarked: boolean }> => {
    return request<{ bookmarked: boolean }>(`/content/${contentId}/bookmark`, { method: 'POST' });
  },

  unbookmark: async (contentId: string): Promise<void> => {
    await request<void>(`/content/${contentId}/bookmark`, { method: 'DELETE' });
  },

  getEngagement: async (contentId: string): Promise<ContentEngagement> => {
    return request<ContentEngagement>(`/content/${contentId}/engagement`);
  },

  recordView: async (contentId: string, sessionId: string): Promise<{ views: number }> => {
    return request<{ views: number }>(`/content/${contentId}/view`, {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  },

  like: async (contentId: string): Promise<{ liked: true; likes: number }> => {
    return request<{ liked: true; likes: number }>(`/content/${contentId}/like`, {
      method: 'POST',
    });
  },

  unlike: async (contentId: string): Promise<{ liked: false; likes: number }> => {
    return request<{ liked: false; likes: number }>(`/content/${contentId}/like`, {
      method: 'DELETE',
    });
  },

  listComments: async (contentId: string): Promise<ContentComment[]> => {
    return request<ContentComment[]>(`/content/${contentId}/comments`);
  },

  addComment: async (contentId: string, body: string): Promise<ContentComment> => {
    return request<ContentComment>(`/content/${contentId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  },

  /**
   * Optional `limit` / `offset` for server-side pagination when supported.
   * Response may be a bare array or `{ items, total }`.
   */
  listVersions: async (
    id: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<unknown> => {
    const params = new URLSearchParams();
    if (typeof opts?.limit === 'number') params.set('limit', String(opts.limit));
    if (typeof opts?.offset === 'number') params.set('offset', String(opts.offset));
    const q = params.toString();
    return request<unknown>(`/content/${id}/versions${q ? `?${q}` : ''}`);
  },

  /**
   * F-AUT-004: active real-time co-author session. If the route is not deployed yet, returns false.
   */
  getCollaborationActive: async (contentId: string): Promise<boolean> => {
    const r = await fetchOptionalJson<{ active?: boolean; activeSession?: boolean }>(
      `/content/${contentId}/collaboration/active`,
    );
    if (!r.ok) return false;
    if (typeof r.data.active === 'boolean') return r.data.active;
    if (typeof r.data.activeSession === 'boolean') return r.data.activeSession;
    return false;
  },

  /**
   * Server-computed word diff between two version snapshots. Returns null when the endpoint is unavailable.
   */
  getVersionsDiff: async (
    contentId: string,
    fromVersionId: string,
    toVersionId: string,
  ): Promise<Array<{ type: 'equal' | 'insert' | 'delete'; text: string }> | null> => {
    const qs = new URLSearchParams({ from: fromVersionId, to: toVersionId });
    const r = await fetchOptionalJson<{ segments?: Array<{ type: string; text: string }> }>(
      `/content/${contentId}/versions/diff?${qs}`,
    );
    if (!r.ok || !Array.isArray(r.data.segments)) return null;
    return r.data.segments.map((s) => ({
      type: s.type === 'insert' || s.type === 'delete' || s.type === 'equal' ? s.type : 'equal',
      text: typeof s.text === 'string' ? s.text : String(s.text ?? ''),
    }));
  },

  /**
   * Restore a snapshot as the new head revision. Backend must return 409 when a co-author session is active.
   */
  restoreVersion: async (contentId: string, versionId: string): Promise<unknown> => {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE}/content/${contentId}/versions/${versionId}/restore`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
    });
    if (res.status === 409) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        typeof err === 'object' &&
          err &&
          'error' in err &&
          typeof (err as { error: string }).error === 'string'
          ? (err as { error: string }).error
          : 'Restore blocked while a co-author session is active.',
      );
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(err.error || err.message || `HTTP ${res.status}`);
    }
    return res.json().catch(() => ({}));
  },
};
