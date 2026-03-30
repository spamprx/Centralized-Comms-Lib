const API_BASE = import.meta.env.VITE_API_URL ;
import { getAuthToken } from './tokenStore';

export type LifecycleState = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'ARCHIVED';
export type Visibility = 'PUBLIC' | 'PRIVATE' | 'HIDDEN' | 'ARCHIVED' | 'PRIVATE_TO_GROUP';

export type Content = {
  id: string;
  title: string;
  slug: string;
  lifecycleState: LifecycleState;
  visibility: Visibility;
  aiGenerated: boolean;
  authorId: string;
  visibilityGroupId: string | null;
  createdAt: string;
  updatedAt: string;
};

type ListFilters = {
  authorId?: string;
  lifecycleState?: LifecycleState;
  visibility?: Visibility;
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

export const contentService = {
  list: async (filters: ListFilters = {}): Promise<Content[]> => {
    const params = new URLSearchParams();
    if (filters.authorId) params.set('authorId', filters.authorId);
    if (filters.lifecycleState) params.set('lifecycleState', filters.lifecycleState);
    if (filters.visibility) params.set('visibility', filters.visibility);
    if (typeof filters.limit === 'number') params.set('limit', String(filters.limit));
    if (typeof filters.offset === 'number') params.set('offset', String(filters.offset));
    const query = params.toString();
    return request<Content[]>(query ? `/content?${query}` : '/content');
  },

  createDraft: async (title: string, body?: unknown): Promise<{ content: Content }> => {
    return request<{ content: Content }>('/content', {
      method: 'POST',
      body: JSON.stringify({ title, body }),
    });
  },

  saveDraft: async (id: string, data: { title?: string; body?: unknown }): Promise<unknown> => {
    return request<unknown>(`/content/${id}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  transitionState: async (id: string, lifecycleState: LifecycleState): Promise<Content> => {
    return request<Content>(`/content/${id}/STATE_TRANSITION`, {
      method: 'POST',
      body: JSON.stringify({ lifecycleState }),
    });
  },

  getById: async (id: string): Promise<{
    content: Content;
    versions: Array<{ id: string; versionNumber: number; title: string; body?: unknown; createdAt: string; changeType?: string; metadataSnapshot?: unknown }>;
    tags: Array<{ id: string; name: string; slug: string }>;
    coAuthors: Array<{ id: string; displayName: string; email: string }>;
  }> => {
    return request(`/content/${id}`);
  },

  listVersions: async (id: string): Promise<Array<{
    id: string;
    versionNumber: number;
    title: string;
    changeType: string;
    metadataSnapshot: unknown;
    createdAt: string;
    contentId: string;
    authorId: string;
  }>> => {
    return request(`/content/${id}/versions`);
  },
};
