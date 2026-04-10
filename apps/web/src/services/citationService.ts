import { getAuthToken } from './tokenStore';
import { searchContent, type ContentSearchHit } from './searchService';

const API_BASE = import.meta.env.VITE_API_URL;

export type CitationStyle = 'APA' | 'IEEE' | 'MLA';

export type CitationWork = {
  title: string;
  authors?: string[];
  container?: string;
  year?: string | number;
  doi?: string;
  url?: string;
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

export function toCitationWork(hit: ContentSearchHit): CitationWork {
  const s = hit.source;
  const titleRaw = s.title ?? s.name;
  const title = typeof titleRaw === 'string' && titleRaw.trim() ? titleRaw.trim() : 'Untitled';
  const authorsRaw = s.authors;
  const authors = Array.isArray(authorsRaw)
    ? authorsRaw.map((a) => String(a)).filter(Boolean)
    : (typeof s.authorName === 'string' ? [s.authorName] : undefined);
  const container = typeof s.container === 'string' ? s.container : undefined;
  const year = typeof s.year === 'number' || typeof s.year === 'string' ? s.year : undefined;
  const doi = typeof s.doi === 'string' ? s.doi : undefined;
  const url = typeof s.url === 'string' ? s.url : undefined;
  return { title, authors, container, year, doi, url };
}

export async function searchReferences(query: string): Promise<ContentSearchHit[]> {
  const res = await searchContent(query, { size: 12, includeSnippets: true });
  return res?.hits ?? [];
}

export async function renderCitation(style: CitationStyle, work: CitationWork): Promise<string> {
  const res = await request<{ text: string }>('/citations/render', {
    method: 'POST',
    body: JSON.stringify({ style, work }),
  });
  return res.text;
}

