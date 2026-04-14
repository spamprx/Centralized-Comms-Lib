/**
 * Serialize / parse library filters for shareable `/library?...` URLs.
 * All filtering is applied client-side; this is UI state only (no backend changes).
 */

export const LIBRARY_STATUS_OPTIONS = ['all', 'draft', 'review', 'published'] as const;
export const LIBRARY_TYPE_OPTIONS = ['all', 'article', 'video', 'podcast', 'document'] as const;

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

export type LibraryFilterIssue = {
  code: string;
  message: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDatePart(value: string): boolean {
  if (!ISO_DATE.test(value.trim())) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export type LibraryFilterCatalog = {
  authors: string[];
  channels: string[];
  tagSlugs: Set<string>;
};

function resolveCatalogValue(raw: string, catalog: string[]): string | null {
  const t = raw.trim();
  if (!t) return null;
  const found = catalog.find((c) => c.toLowerCase() === t.toLowerCase());
  return found ?? null;
}

/**
 * Builds facet values that actually apply to filtering. Unknown URL params are dropped
 * so shared links do not silently yield zero rows; pair with UI callouts listing issues.
 */
export function analyzeLibraryFilters(
  f: LibraryUrlFilters,
  catalog: LibraryFilterCatalog,
): { effective: LibraryUrlFilters; issues: LibraryFilterIssue[] } {
  const issues: LibraryFilterIssue[] = [];

  let status = f.status || 'all';
  if (!LIBRARY_STATUS_OPTIONS.includes(status as (typeof LIBRARY_STATUS_OPTIONS)[number])) {
    issues.push({
      code: 'invalid_status',
      message: `Status “${status}” is not valid. It was ignored.`,
    });
    status = 'all';
  }

  let type = f.type || 'all';
  if (!LIBRARY_TYPE_OPTIONS.includes(type as (typeof LIBRARY_TYPE_OPTIONS)[number])) {
    issues.push({
      code: 'invalid_type',
      message: `Type “${type}” is not valid. It was ignored.`,
    });
    type = 'all';
  }

  let author = '';
  const authorRaw = f.author.trim();
  if (authorRaw) {
    const resolved = resolveCatalogValue(authorRaw, catalog.authors);
    if (resolved === null) {
      issues.push({
        code: 'unknown_author',
        message: `Author “${authorRaw}” is not in this library.`,
      });
    } else {
      author = resolved;
    }
  }

  let channel = '';
  const channelRaw = f.channel.trim();
  if (channelRaw) {
    const resolved = resolveCatalogValue(channelRaw, catalog.channels);
    if (resolved === null) {
      issues.push({
        code: 'unknown_channel',
        message: `Channel “${channelRaw}” is not in this library.`,
      });
    } else {
      channel = resolved;
    }
  }

  const tags: string[] = [];
  for (const raw of f.tags) {
    const slug = raw.trim().toLowerCase();
    if (!slug) continue;
    if (catalog.tagSlugs.has(slug)) {
      if (!tags.includes(slug)) tags.push(slug);
    } else {
      issues.push({
        code: 'unknown_tag',
        message: `Tag “${raw}” does not exist.`,
      });
    }
  }

  let dateFrom = f.dateFrom.trim();
  let dateTo = f.dateTo.trim();

  if (dateFrom && !isValidIsoDatePart(dateFrom)) {
    issues.push({ code: 'invalid_date_from', message: '“From” date is not a valid date.' });
    dateFrom = '';
  }
  if (dateTo && !isValidIsoDatePart(dateTo)) {
    issues.push({ code: 'invalid_date_to', message: '“To” date is not a valid date.' });
    dateTo = '';
  }
  if (dateFrom && dateTo && dateFrom > dateTo) {
    issues.push({
      code: 'date_range_inverted',
      message: 'Start date is after end date; the date range was ignored.',
    });
    dateFrom = '';
    dateTo = '';
  }

  return {
    effective: {
      ...f,
      status,
      type,
      author,
      channel,
      tags,
      dateFrom,
      dateTo,
    },
    issues,
  };
}

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
