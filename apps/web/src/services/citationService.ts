import { isLiveCitationSearchMode } from '../config/citationSearch';
import { filterMockCitationHits } from '../data/mockCitationSearchHits';
import { joinApiV1Path } from '../lib/apiBase';
import { getAuthToken } from './tokenStore';
import { searchContent, type ContentSearchHit } from './searchService';

export type CitationStyle = 'APA' | 'IEEE' | 'MLA';

export type CitationWork = {
  title: string;
  authors?: string[];
  container?: string;
  year?: string | number;
  doi?: string;
  url?: string;
};

export type ReferenceSearchResult = {
  hits: ContentSearchHit[];
  total: number;
  /** Search index unreachable (e.g. 503) — UI can show a soft message. */
  unavailable: boolean;
};

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const url = joinApiV1Path(endpoint);
  const res = await fetch(url, {
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
    : typeof s.authorDisplayName === 'string' && s.authorDisplayName.trim()
      ? [s.authorDisplayName.trim()]
      : typeof s.authorName === 'string' && s.authorName.trim()
        ? [s.authorName.trim()]
        : typeof s.createdByName === 'string' && s.createdByName.trim()
          ? [s.createdByName.trim()]
      : undefined;
  const container =
    typeof s.container === 'string' && s.container.trim()
      ? s.container.trim()
      : typeof s.channelName === 'string' && s.channelName.trim()
        ? `Channel: ${s.channelName.trim()}`
        : typeof s.channelKey === 'string' && s.channelKey.trim()
          ? `Channel: ${s.channelKey.trim()}`
          : typeof s.workspaceName === 'string' && s.workspaceName.trim()
            ? s.workspaceName.trim()
            : 'Comms Platform';
  const year =
    typeof s.year === 'number' || typeof s.year === 'string'
      ? s.year
      : (() => {
          const candidates = [
            (s as any).publishedAt,
            (s as any).createdAt,
            (s as any).updatedAt,
            (s as any).lastModified,
          ];
          for (const c of candidates) {
            if (!c) continue;
            const d = new Date(String(c));
            if (!Number.isNaN(+d)) return d.getUTCFullYear();
          }
          return undefined;
        })();
  const doi = typeof s.doi === 'string' ? s.doi : undefined;
  const url = typeof s.url === 'string' ? s.url : undefined;
  return { title, authors, container, year, doi, url };
}

/**
 * Reference picker: bundled mock hits by default; set `VITE_CITATION_SEARCH_MODE=live`
 * to query Search & Retrieval (`GET /search/content`).
 */
export async function searchReferences(query: string): Promise<ReferenceSearchResult> {
  const trimmed = query.trim();
  if (!trimmed) return { hits: [], total: 0, unavailable: false };

  if (!isLiveCitationSearchMode()) {
    const hits = filterMockCitationHits(trimmed);
    return { hits, total: hits.length, unavailable: false };
  }

  const res = await searchContent(trimmed, { size: 16, includeSnippets: true });
  if (res == null) return { hits: [], total: 0, unavailable: true };
  return { hits: res.hits, total: res.total, unavailable: false };
}

export async function renderCitation(style: CitationStyle, work: CitationWork): Promise<string> {
  const json = await request<{ text: string }>('/citations/render', {
    method: 'POST',
    body: JSON.stringify({ style, work }),
  });
  return json.text;
}

function formatYear(y?: string | number): string {
  if (y === undefined || y === null || (typeof y === 'string' && !y.trim())) return 'n.d.';
  return String(y);
}

function formatAuthors(work: CitationWork): string {
  const a = work.authors?.filter(Boolean) ?? [];
  if (a.length === 0) return '[Author unknown]';
  if (a.length === 1) return a[0];
  if (a.length === 2) return `${a[0]} & ${a[1]}`;
  return `${a[0]} et al.`;
}

function linkTail(work: CitationWork): string {
  if (work.doi?.trim()) {
    const d = work.doi.replace(/^https?:\/\/doi\.org\//i, '').replace(/^doi:\s*/i, '');
    return `https://doi.org/${d}`;
  }
  return work.url?.trim() ?? '';
}

/**
 * Best-effort citation string when metadata is incomplete or `/citations/render` fails.
 */
export function formatCitationLocal(style: CitationStyle, work: CitationWork): string {
  const title = work.title?.trim() || '[Title unknown]';
  const y = formatYear(work.year);
  const authors = formatAuthors(work);
  const container = work.container?.trim() || 'Comms Platform';
  const tail = linkTail(work);

  switch (style) {
    case 'APA':
      return `${authors} (${y}). ${title}. ${container}${tail ? ` ${tail}` : ''}`.trim();
    case 'IEEE':
      return `${authors}, "${title}," ${container}, ${y}${tail ? `, ${tail}` : ''}`.trim();
    case 'MLA':
      return `${authors}. "${title}." ${container}, ${y}${tail ? `, ${tail}` : ''}`.trim();
    default:
      return `${title} (${y}).`;
  }
}

export async function renderCitationWithFallback(
  style: CitationStyle,
  work: CitationWork,
): Promise<string> {
  try {
    return await renderCitation(style, work);
  } catch {
    return formatCitationLocal(style, work);
  }
}
