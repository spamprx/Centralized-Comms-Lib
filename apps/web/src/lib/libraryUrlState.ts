/**
 * Serialize / parse library filters for shareable `/library?...` URLs.
 * All filtering is applied client-side; this is UI state only (no backend changes).
 */

export type LibraryUrlFilters = {
  q: string;
  tags: string[];
  author: string;
  dateFrom: string;
  dateTo: string;
  channel: string;
  status: string;
  type: string;
};

export const defaultLibraryUrlFilters = (): LibraryUrlFilters => ({
  q: '',
  tags: [],
  author: '',
  dateFrom: '',
  dateTo: '',
  channel: '',
  status: 'all',
  type: 'all',
});

export function parseLibrarySearchParams(sp: URLSearchParams): LibraryUrlFilters {
  return {
    q: sp.get('q') ?? '',
    tags: sp.getAll('tags').filter(Boolean),
    author: sp.get('author') ?? '',
    dateFrom: sp.get('from') ?? '',
    dateTo: sp.get('to') ?? '',
    channel: sp.get('channel') ?? '',
    status: sp.get('status') ?? 'all',
    type: sp.get('type') ?? 'all',
  };
}

export function serializeLibrarySearchParams(f: LibraryUrlFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q.trim());
  for (const t of f.tags) {
    const s = t.trim();
    if (s) p.append('tags', s);
  }
  if (f.author.trim()) p.set('author', f.author.trim());
  if (f.dateFrom) p.set('from', f.dateFrom);
  if (f.dateTo) p.set('to', f.dateTo);
  if (f.channel.trim()) p.set('channel', f.channel.trim());
  if (f.status && f.status !== 'all') p.set('status', f.status);
  if (f.type && f.type !== 'all') p.set('type', f.type);
  return p;
}

export function mergeLibraryFilters(
  sp: URLSearchParams,
  patch: Partial<LibraryUrlFilters>,
): URLSearchParams {
  const current = parseLibrarySearchParams(sp);
  return serializeLibrarySearchParams({ ...current, ...patch });
}
