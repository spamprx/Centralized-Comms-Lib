import { joinApiV1Path } from '../lib/apiBase';
import { csrfHeader } from './tokenStore';

export type ContentCheckHit = {
  contentId: string;
  score: number;
  source: Record<string, unknown>;
};

export type ContentCheckResponse = {
  total: number;
  hits: ContentCheckHit[];
};

export type ContentSearchHit = {
  contentId: string;
  score: number;
  source: Record<string, unknown>;
  snippetHtml?: string;
  highlight?: Record<string, string[]>;
};

export type ContentSearchResponse = {
  total: number;
  hits: ContentSearchHit[];
  facets?: Record<string, Array<{ key: string | number | boolean; doc_count: number }>>;
};

/**
 * Duplicate-style similarity check backed by search index (requires persisted content id).
 * Returns null when search is unavailable (503) so callers can fall back to local heuristics.
 */
export async function fetchSimilarByContentId(
  contentId: string,
  opts?: { size?: number; minScore?: number },
): Promise<ContentCheckResponse | null> {
  const params = new URLSearchParams({ contentId });
  if (opts?.size != null) params.set('size', String(opts.size));
  if (opts?.minScore != null) params.set('minScore', String(opts.minScore));

  const res = await fetch(joinApiV1Path(`/search/content-check?${params}`), {
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeader('GET'),
    },
    credentials: 'include',
  });

  if (res.status === 503) return null;

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || err.message || `HTTP ${res.status}`);
  }

  return res.json();
}

/**
 * Full-text search with ranking + optional highlight snippets.
 * Returns null when search is unavailable (503).
 */
export async function searchContent(
  q: string,
  opts?: { from?: number; size?: number; includeSnippets?: boolean },
): Promise<ContentSearchResponse | null> {
  const params = new URLSearchParams();
  params.set('q', q);
  if (opts?.from != null) params.set('from', String(opts.from));
  if (opts?.size != null) params.set('size', String(opts.size));
  if (opts?.includeSnippets) params.set('includeSnippets', 'true');
  params.set('includeFacets', 'false');

  const res = await fetch(joinApiV1Path(`/search/content?${params}`), {
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeader('GET'),
    },
    credentials: 'include',
  });

  // Treat "not available" cases as null so UI can fall back gracefully.
  if (res.status === 503) return null;
  if (res.status === 404) return null;

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || err.message || `HTTP ${res.status}`);
  }

  return res.json();
}
