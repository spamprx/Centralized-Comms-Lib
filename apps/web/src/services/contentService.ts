import { resolveApiV1Base } from '../lib/apiBase';
const API_BASE = resolveApiV1Base();
import { getAuthToken } from './tokenStore';

export type LifecycleState = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'ARCHIVED';
export type Visibility = 'PUBLIC' | 'PRIVATE_TO_GROUP';

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

/** `GET /content/workspace` — items you own or co-author. */
export type WorkspaceContent = Content & {
  author?: ContentAuthor | null;
  viewsCount: number;
  likesCount: number;
  workspaceRole: 'author' | 'co_author';
  acceptedCoAuthorCount: number;
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

/** Thrown when POST /content/:id returns 409 (another author saved a newer revision first). */
export class ContentSaveConflictError extends Error {
  readonly currentVersionNumber: number;

  constructor(currentVersionNumber: number) {
    super(
      'A newer revision was saved elsewhere. Reload to get the latest version, then re-apply your edits.',
    );
    this.name = 'ContentSaveConflictError';
    this.currentVersionNumber = currentVersionNumber;
  }
}

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

/** Recent editor presence (heartbeat); same shape as `GET /content/:id/presence`. */
export type EditorPresenceUser = {
  userId: string;
  displayName: string;
  email: string;
  lastSeenAt: string;
};

export type ContentComment = {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  contentId: string;
  parentId: string | null;
  author: { id: string; displayName: string; email: string };
  replies?: ContentComment[];
};

export type ReactionEmoji = 'LIKE' | 'LOVE' | 'CLAP' | 'INSIGHTFUL' | 'LAUGH' | 'CELEBRATE';
export type ReactionSummary = {
  counts: Array<{ emoji: ReactionEmoji; count: number }>;
  myReaction: ReactionEmoji | null;
};

export type ContentEngagement = {
  views: number;
  likes: number;
  comments: number;
  likedByMe: boolean;
};

export type ReadingProgressStatus = 'NOT_STARTED' | 'READING' | 'DONE';
export type ReadingProgress = {
  percent: number;
  status: ReadingProgressStatus;
  updatedAt: string | null;
  throttled?: boolean;
};

export type CopyAttributionPolicy = {
  enabled: boolean;
  template: string;
  footer: string | null;
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

  /** Primary + accepted co-author items for My Content. */
  listWorkspace: async (): Promise<WorkspaceContent[]> => {
    return request<WorkspaceContent[]>('/content/workspace');
  },

  createDraft: async (
    title: string,
    body?: unknown,
    options?: {
      templateId?: string | null;
      channelId?: string | null;
      aiGenerated?: boolean;
      contentType?: Content['contentType'];
    },
  ): Promise<{ content: Content; version?: ContentVersion }> => {
    return request<{ content: Content; version?: ContentVersion }>('/content', {
      method: 'POST',
      body: JSON.stringify({
        title,
        body,
        templateId: options?.templateId ?? undefined,
        channelId: options?.channelId ?? undefined,
        contentType: options?.contentType ?? undefined,
        aiGenerated: options?.aiGenerated,
      }),
    });
  },

  saveDraft: async (
    id: string,
    data: {
      title?: string;
      body?: unknown;
      contentType?: Content['contentType'];
      baseVersionNumber?: number;
      templateId?: string | null;
      channelId?: string | null;
    },
  ): Promise<ContentVersion> => {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE}/content/${id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (res.status === 409) {
      const err = (await res.json().catch(() => ({}))) as {
        currentVersionNumber?: number;
      };
      throw new ContentSaveConflictError(
        typeof err.currentVersionNumber === 'number' ? err.currentVersionNumber : 0,
      );
    }
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(
        (errBody as { error?: string; message?: string }).error ||
          (errBody as { message?: string }).message ||
          `HTTP ${res.status}`,
      );
    }
    return res.json() as Promise<ContentVersion>;
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

  updateVisibility: async (
    id: string,
    visibility: Visibility,
    visibilityGroupId?: string | null,
  ): Promise<Content> => {
    return request<Content>(`/content/${id}/visibility`, {
      method: 'PATCH',
      body: JSON.stringify({
        visibility,
        ...(visibilityGroupId !== undefined ? { visibilityGroupId } : {}),
      }),
    });
  },

  getById: async (
    id: string,
  ): Promise<{
    content: Content;
    versions: ContentVersion[];
    tags: Array<{ id: string; name: string; slug: string }>;
    coAuthors: Array<{ id: string; displayName: string; email: string }>;
    reviewPolicy?: {
      requiredQuorum: number | null;
      isSatisfied: boolean | null;
    };
    channel?: {
      id: string;
      name: string;
      key: string;
      description: string | null;
      priority: number;
      compatibility: unknown;
      createdAt: string;
      updatedAt: string;
    } | null;
  }> => {
    return request(`/content/${id}`);
  },

  getCopyPolicy: async (id: string): Promise<CopyAttributionPolicy> => {
    return request<CopyAttributionPolicy>(`/content/${id}/copy-policy`);
  },

  assignTag: async (contentId: string, tagId: string): Promise<{ message: string }> => {
    return request<{ message: string }>(`/content/${contentId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tagId }),
    });
  },

  removeTag: async (contentId: string, tagId: string): Promise<{ message: string }> => {
    return request<{ message: string }>(`/content/${contentId}/tags/${tagId}`, {
      method: 'DELETE',
    });
  },

  /** Primary author only: invite someone who already has an account (matches email). */
  requestCoAuthorByEmail: async (
    contentId: string,
    email: string,
  ): Promise<{ message: string }> => {
    return request<{ message: string }>(`/content/${contentId}/co-authors/by-email`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  /** Invitee: accept or reject a pending co-author request for this content. */
  respondToCoAuthorRequest: async (
    contentId: string,
    decision: 'APPROVE' | 'REJECT',
  ): Promise<{ message: string }> => {
    return request<{ message: string }>(`/content/${contentId}/co-authors/respond`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    });
  },

  /** Invitee: list documents where you have a pending co-author invitation. */
  listPendingCoAuthorInvitations: async (): Promise<
    Array<{
      contentId: string;
      title: string;
      requestedBy: { displayName: string; email: string };
    }>
  > => {
    return request(`/content/co-author-invitations/pending`);
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

  getReadingProgress: async (contentId: string): Promise<ReadingProgress> => {
    return request<ReadingProgress>(`/content/${contentId}/progress`);
  },

  patchReadingProgress: async (
    contentId: string,
    payload: { percent?: number; status?: ReadingProgressStatus },
  ): Promise<ReadingProgress> => {
    return request<ReadingProgress>(`/content/${contentId}/progress`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
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

  addComment: async (
    contentId: string,
    body: string,
    parentId?: string | null,
  ): Promise<ContentComment> => {
    return request<ContentComment>(`/content/${contentId}/comments`, {
      method: 'POST',
      body: JSON.stringify({
        body,
        ...(parentId ? { parentId } : {}),
      }),
    });
  },

  getReactions: async (contentId: string): Promise<ReactionSummary> => {
    return request<ReactionSummary>(`/content/${contentId}/reactions`);
  },

  toggleReaction: async (contentId: string, emoji: ReactionEmoji): Promise<ReactionSummary> => {
    return request<ReactionSummary>(`/content/${contentId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
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
  restoreVersion: async (
    contentId: string,
    versionId: string,
    opts?: { baseVersionNumber?: number },
  ): Promise<unknown> => {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE}/content/${contentId}/versions/${versionId}/restore`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify(
        typeof opts?.baseVersionNumber === 'number'
          ? { baseVersionNumber: opts.baseVersionNumber }
          : {},
      ),
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

  requestRestore: async (contentId: string): Promise<void> => {
    await request<{ ok: true }>(`/content/${contentId}/restore-request`, {
      method: 'POST',
    }).catch(() => {
      // ignore (best-effort)
    });
  },
};
