const API_BASE = import.meta.env.VITE_API_URL;

export type ReviewRequest = {
  id: string;
  status: string;
  quorumRequired: number;
  contentId: string;
  contentVersionId: string;
  requestedById: string;
  createdAt: string;
  updatedAt: string;
};

export type ReviewAssignment = {
  id: string;
  status: string;
  assignedAt: string;
  completedAt: string | null;
  reviewRequestId: string;
  reviewerId: string;
  assignedById: string;
  reviewRequest?: ReviewRequest & {
    content?: {
      id: string;
      title: string;
      slug: string;
      authorId: string;
      author?: { displayName: string; email: string };
    };
  };
};

import { getAuthToken } from './tokenStore';

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

export const reviewService = {
  createRequest: async (
    contentId: string,
    contentVersionId: string,
    quorumRequired?: number,
  ): Promise<ReviewRequest> => {
    return request<ReviewRequest>('/reviews/requests', {
      method: 'POST',
      body: JSON.stringify({ contentId, contentVersionId, quorumRequired }),
    });
  },

  assignReviewer: async (requestId: string, reviewerId: string): Promise<unknown> => {
    return request<unknown>(`/reviews/requests/${requestId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ reviewerId }),
    });
  },

  listForContent: async (contentId: string): Promise<ReviewRequest[]> => {
    return request<ReviewRequest[]>(`/reviews/content/${contentId}`);
  },

  listMyAssignments: async (): Promise<ReviewAssignment[]> => {
    return request<ReviewAssignment[]>('/reviews/my-assignments');
  },

  decide: async (
    assignmentId: string,
    verdict: 'APPROVED' | 'DENIED' | 'ROLLBACK',
    comment: string,
  ): Promise<{ message: string }> => {
    return request<{ message: string }>(`/reviews/assignments/${assignmentId}/decide`, {
      method: 'POST',
      body: JSON.stringify({ verdict, comment }),
    });
  },

  getRequestById: async (requestId: string): Promise<ReviewRequest & { assignments?: Array<ReviewAssignment & { decisions?: Array<{ verdict: string; comment: string; createdAt: string }> }> }> => {
    return request(`/reviews/requests/${requestId}`);
  },

  addComment: async (assignmentId: string, body: string): Promise<{ id: string; body: string; authorId: string; createdAt: string }> => {
    return request(`/reviews/assignments/${assignmentId}/comment`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  },

};
