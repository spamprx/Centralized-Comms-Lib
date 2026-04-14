import type { ContentSearchHit } from '../services/searchService';

export function plainTitleFromHit(hit: ContentSearchHit): string {
  const t = hit.source.title ?? hit.source.name;
  if (typeof t === 'string' && t.trim()) return t.trim();
  return 'Untitled';
}

/** Highlight HTML from the index (already restricted to safe tags server-side). */
export function titleHtmlFromHit(hit: ContentSearchHit): string | null {
  const fr = hit.highlight?.title?.[0];
  return fr?.trim() ? fr : null;
}

/**
 * Prefer server-built snippet; otherwise stitch highlight fragments (truncation is applied server-side).
 */
export function snippetHtmlFromHit(hit: ContentSearchHit): string | null {
  if (hit.snippetHtml?.trim()) return hit.snippetHtml.trim();
  const h = hit.highlight;
  if (!h) return null;
  const order = ['summary', 'bodyPlain', 'body', 'tags'] as const;
  for (const key of order) {
    const parts = h[key];
    if (parts?.length) return parts.slice(0, 2).join(' … ');
  }
  return null;
}

/**
 * Map blended relevance scores on the current page to 0–100 for display (ordering unchanged).
 */
export function relevancePercentForHit(hits: ContentSearchHit[], index: number): number {
  const scores = hits.map((h) => (Number.isFinite(h.score) ? h.score : 0));
  if (!scores.length) return 0;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const raw = scores[index] ?? 0;
  if (max <= min) return 100;
  const t = (raw - min) / (max - min);
  return Math.max(0, Math.min(100, Math.round(t * 100)));
}
