import type { ContentSearchHit } from '../services/searchService';

/**
 * Static search results for the citation dialog (`ContentSearchHit` shape).
 * Replace with `VITE_CITATION_SEARCH_MODE=live` to use the real index.
 */
export const mockCitationSearchHits: ContentSearchHit[] = [
  {
    contentId: 'mock-cite-001',
    score: 0.94,
    source: {
      title: 'Designing resilient internal communication platforms',
      authors: ['M. Chen', 'J. Okonkwo'],
      container: 'Journal of Org. Communication',
      year: 2024,
      doi: '10.1000/mock.001',
    },
    snippetHtml:
      '…<em>resilient</em> messaging layers and <em>search</em>-first discovery for distributed teams…',
  },
  {
    contentId: 'mock-cite-002',
    score: 0.88,
    source: {
      title: 'Citation practices in technical documentation',
      authorName: 'A. Rivera',
      container: 'Tech Comm Quarterly',
      year: 2023,
      url: 'https://example.org/papers/rivera-2023',
    },
    snippetHtml: 'Structured metadata improves <em>attribution</em> and reuse across channels.',
  },
  {
    contentId: 'mock-cite-003',
    score: 0.81,
    source: {
      title: 'Search and retrieval patterns for knowledge bases',
      authors: ['S. Patel', 'L. Müller', 'K. Jones'],
      year: 2022,
    },
    snippetHtml: 'Hybrid lexical and semantic <em>search</em> for author workflows.',
  },
  {
    contentId: 'mock-cite-004',
    score: 0.76,
    source: {
      name: 'API versioning handbook',
      authors: ['DevRel Collective'],
      container: 'Internal handbook',
      year: 2025,
    },
    snippetHtml: 'Covers lifecycle states, <em>review</em> gates, and publication checks.',
  },
  {
    contentId: 'mock-cite-005',
    score: 0.71,
    source: {
      title: 'Accessibility in rich text editors',
      authors: ['R. Kim'],
      container: 'UX Research Notes',
      year: 2024,
    },
  },
];

function haystackForHit(hit: ContentSearchHit): string {
  const s = hit.source;
  const bits: string[] = [];
  const t = s.title ?? s.name;
  if (typeof t === 'string') bits.push(t);
  if (typeof s.authorName === 'string') bits.push(s.authorName);
  if (Array.isArray(s.authors)) bits.push(...s.authors.map(String));
  if (typeof s.container === 'string') bits.push(s.container);
  if (s.year != null) bits.push(String(s.year));
  if (typeof s.doi === 'string') bits.push(s.doi);
  if (hit.snippetHtml) bits.push(hit.snippetHtml.replace(/<[^>]+>/g, ' '));
  return bits.join(' ').toLowerCase();
}

/** Client-side filter for static mode (substring match). */
export function filterMockCitationHits(query: string): ContentSearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return mockCitationSearchHits.filter((h) => haystackForHit(h).includes(q));
}
