import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ContentItem, Tag } from '../data/mockLibraryData';
import { useDebouncedValue } from './useDebouncedValue';
import {
  analyzeLibraryFilters,
  mergeLibraryFilters,
  parseLibrarySearchParams,
  serializeLibrarySearchParams,
  type LibraryUrlFilters,
} from '../lib/libraryUrlState';
import { staticSearchLibrary } from '../lib/staticLibrarySearch';
import { searchContent, type ContentSearchHit } from '../services/searchService';
import { contentService, type Content } from '../services/contentService';

const USE_MOCK_DATA = false;
/** When mock data is disabled, search uses the real API/Elasticsearch path. */
const USE_STATIC_LIBRARY_SEARCH = USE_MOCK_DATA;

/** Matches API max chunk size per request; broad queries stay bounded server-side (size cap 100). */
export const LIBRARY_SEARCH_PAGE_SIZE = 10;

function tagSlugFromMockName(name: string): string {
  return name.toLowerCase();
}

function itemMatchesTagFacet(itemTags: string[], selected: string[]): boolean {
  if (selected.length === 0) return true;
  const lower = itemTags.map((t) => t.toLowerCase());
  return selected.some((s) => lower.includes(s.toLowerCase()));
}

function mapApiContentToLibraryItem(c: Content): ContentItem {
  const type: ContentItem['type'] =
    c.contentType === 'VIDEO'
      ? 'video'
      : c.contentType === 'PODCAST'
        ? 'podcast'
        : c.contentType === 'DOCUMENT'
          ? 'document'
          : 'article';
  const channel = c.templateId ? 'Template' : 'Freeform';
  const status: ContentItem['status'] =
    c.lifecycleState === 'PUBLISHED'
      ? 'published'
      : c.lifecycleState === 'IN_REVIEW'
        ? 'review'
        : 'draft';

  return {
    id: c.id,
    title: c.title,
    type,
    author: c.author?.displayName || (c.authorId ? 'Unknown user' : 'Unknown'),
    channel,
    status,
    views: c.viewsCount ?? 0,
    likes: c.likesCount ?? 0,
    commentsCount: (c as any).commentsCount ?? 0,
    createdAt: c.updatedAt ?? c.createdAt,
    tags: [],
  };
}

export function useLibrary() {
  const supportsChannelFilter = USE_MOCK_DATA;
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseLibrarySearchParams(searchParams), [searchParams]);

  const [allContentItems, setAllContentItems] = useState<ContentItem[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState(() => searchParams.get('q') ?? '');
  const [remoteSearchHits, setRemoteSearchHits] = useState<ContentSearchHit[]>([]);
  const [remoteSearchTotal, setRemoteSearchTotal] = useState(0);
  const [searchPage, setSearchPage] = useState(1);
  const [remoteSearchLoading, setRemoteSearchLoading] = useState(false);
  const [remoteSearchUnavailable, setRemoteSearchUnavailable] = useState(false);
  const [remoteSearchError, setRemoteSearchError] = useState<string | null>(null);
  const prevSearchQRef = useRef<string>('');

  useEffect(() => {
    setSearchInput(filters.q);
  }, [filters.q]);

  const debouncedQ = useDebouncedValue(searchInput, 380);

  useEffect(() => {
    setSearchParams(
      (prev) => {
        const f = parseLibrarySearchParams(prev);
        const qTrim = debouncedQ.trim();
        const urlQ = f.q.trim();
        if (qTrim === urlQ) return prev;
        return mergeLibraryFilters(prev, { q: debouncedQ });
      },
      { replace: true },
    );
  }, [debouncedQ, setSearchParams]);

  useEffect(() => {
    const q = filters.q.trim();
    if (!q) {
      setSearchPage(1);
      prevSearchQRef.current = '';
    } else if (prevSearchQRef.current !== q) {
      prevSearchQRef.current = q;
      setSearchPage(1);
    }
  }, [filters.q]);

  useEffect(() => {
    if (USE_STATIC_LIBRARY_SEARCH) return;

    const q = filters.q.trim();
    if (!q) {
      setRemoteSearchHits([]);
      setRemoteSearchTotal(0);
      setRemoteSearchLoading(false);
      setRemoteSearchUnavailable(false);
      setRemoteSearchError(null);
      return;
    }

    let cancelled = false;
    setRemoteSearchLoading(true);
    setRemoteSearchHits([]);
    setRemoteSearchError(null);

    const from = (searchPage - 1) * LIBRARY_SEARCH_PAGE_SIZE;

    (async () => {
      try {
        const res = await searchContent(q, {
          from,
          size: LIBRARY_SEARCH_PAGE_SIZE,
          includeSnippets: true,
        });
        if (cancelled) return;
        if (res === null) {
          setRemoteSearchUnavailable(true);
          setRemoteSearchHits([]);
          setRemoteSearchTotal(0);
          return;
        }
        setRemoteSearchUnavailable(false);
        const list = res.hits ?? [];
        const publishedHits = list.filter((h) => {
          if (h?.source?.lifecycleState !== 'PUBLISHED') return false;
          const ch = h.source?.contentChannelId as string | null | undefined;
          if (ch != null && String(ch).length > 0) return false;
          return true;
        });
        // Search can include non-published items; library should only show PUBLISHED.
        // Since we don't have a server-side "published-only" search query yet, keep totals consistent
        // with what we actually display.
        const t = publishedHits.length;
        setRemoteSearchHits(publishedHits);
        setRemoteSearchTotal(t);
        const totalPages = Math.max(1, Math.ceil(t / LIBRARY_SEARCH_PAGE_SIZE));
        setSearchPage((p) => (p > totalPages ? totalPages : p));
      } catch (e) {
        if (cancelled) return;
        setRemoteSearchError(e instanceof Error ? e.message : 'Search failed');
        setRemoteSearchHits([]);
        setRemoteSearchTotal(0);
        setRemoteSearchUnavailable(false);
      } finally {
        if (!cancelled) setRemoteSearchLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filters.q, searchPage]);

  const staticSearchFull = useMemo(() => {
    if (!USE_STATIC_LIBRARY_SEARCH) return [];
    const q = filters.q.trim();
    if (!q || !allContentItems.length) return [];
    return staticSearchLibrary(allContentItems, q);
  }, [allContentItems, filters.q]);

  const staticSearchPage = useMemo(() => {
    if (!USE_STATIC_LIBRARY_SEARCH) return { hits: [] as ContentSearchHit[], total: 0 };
    const total = staticSearchFull.length;
    const from = (searchPage - 1) * LIBRARY_SEARCH_PAGE_SIZE;
    const hits = staticSearchFull.slice(from, from + LIBRARY_SEARCH_PAGE_SIZE);
    return { hits, total };
  }, [staticSearchFull, searchPage]);

  useEffect(() => {
    if (!USE_STATIC_LIBRARY_SEARCH) return;
    const t = staticSearchPage.total;
    const totalPages = Math.max(1, Math.ceil(t / LIBRARY_SEARCH_PAGE_SIZE));
    setSearchPage((p) => (p > totalPages ? totalPages : p));
  }, [USE_STATIC_LIBRARY_SEARCH, staticSearchPage.total]);

  useEffect(() => {
    if (USE_MOCK_DATA) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const rows = await contentService.list({
          lifecycleState: 'PUBLISHED',
          omitChannelBound: true,
          limit: 200,
          offset: 0,
        });
        if (cancelled) return;
        setAllContentItems(rows.map(mapApiContentToLibraryItem));
        // Tags are returned per-content via `/content/:id` today; keep catalog empty until
        // the API exposes a tags list endpoint.
        setTags([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const patchFilters = useCallback(
    (patch: Partial<LibraryUrlFilters>) => {
      setSearchParams((prev) => mergeLibraryFilters(prev, patch), { replace: true });
    },
    [setSearchParams],
  );

  const toggleTag = useCallback(
    (tagSlug: string) => {
      setSearchParams(
        (prev) => {
          const f = parseLibrarySearchParams(prev);
          const next = new Set(f.tags.map((t) => t.toLowerCase()));
          const key = tagSlug.toLowerCase();
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return serializeLibrarySearchParams({ ...f, tags: [...next] });
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const clearAllFilters = useCallback(() => {
    setSearchInput('');
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  const authors = useMemo(() => {
    const s = new Set<string>();
    for (const item of allContentItems) s.add(item.author);
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [allContentItems]);

  const channels = useMemo(() => {
    const s = new Set<string>();
    for (const item of allContentItems) s.add(item.channel);
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [allContentItems]);

  const tagSlugCatalog = useMemo(() => new Set(tags.map((t) => t.name.toLowerCase())), [tags]);

  const filterCatalog = useMemo(
    () => ({ authors, channels, tagSlugs: tagSlugCatalog }),
    [authors, channels, tagSlugCatalog],
  );

  const { effective: effectiveFiltersBase, issues: filterIssuesBase } = useMemo(
    () => analyzeLibraryFilters(filters, filterCatalog),
    [filters, filterCatalog],
  );

  // Now that contentType is stored in DB, the Type facet is supported in DB-backed mode again.
  // Keep tags/channel/date facets disabled until the API exposes them.
  const { effectiveFilters, filterIssues } = useMemo(() => {
    if (USE_MOCK_DATA) {
      return { effectiveFilters: effectiveFiltersBase, filterIssues: filterIssuesBase };
    }
    const extraIssues = [...filterIssuesBase];
    const next = { ...effectiveFiltersBase };

    if (next.channel.trim()) {
      extraIssues.push({
        code: 'unsupported_channel',
        message: 'Channel filter is not supported for DB-backed library yet. It was ignored.',
      });
      next.channel = '';
    }
    if (next.tags.length > 0) {
      extraIssues.push({
        code: 'unsupported_tags',
        message: 'Tag filters are not supported for DB-backed library yet. They were ignored.',
      });
      next.tags = [];
    }
    if (next.dateFrom || next.dateTo) {
      extraIssues.push({
        code: 'unsupported_dates',
        message:
          'Date range filters are not supported for DB-backed library yet. They were ignored.',
      });
      next.dateFrom = '';
      next.dateTo = '';
    }

    return { effectiveFilters: next, filterIssues: extraIssues };
  }, [effectiveFiltersBase, filterIssuesBase]);

  const filteredItems = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    return allContentItems.filter((item) => {
      if (q) {
        const inTitle = item.title.toLowerCase().includes(q);
        const inAuthor = item.author.toLowerCase().includes(q);
        if (!inTitle && !inAuthor) return false;
      }
      if (effectiveFilters.type !== 'all' && item.type !== effectiveFilters.type) return false;
      if (!itemMatchesTagFacet(item.tags, effectiveFilters.tags)) return false;
      if (effectiveFilters.author && item.author !== effectiveFilters.author) return false;
      if (effectiveFilters.channel && item.channel !== effectiveFilters.channel) return false;
      if (effectiveFilters.status !== 'all' && item.status !== effectiveFilters.status)
        return false;
      if (effectiveFilters.dateFrom && item.createdAt < effectiveFilters.dateFrom) return false;
      if (effectiveFilters.dateTo && item.createdAt > effectiveFilters.dateTo) return false;
      return true;
    });
  }, [allContentItems, searchInput, effectiveFilters]);

  const removeInvalidFilters = useCallback(() => {
    setSearchInput(effectiveFilters.q);
    setSearchParams(serializeLibrarySearchParams(effectiveFilters), { replace: true });
  }, [effectiveFilters, setSearchParams]);

  const hasActiveFilters = useMemo(() => {
    const f = filters;
    return (
      f.q.trim() !== '' ||
      f.tags.length > 0 ||
      f.author.trim() !== '' ||
      f.dateFrom !== '' ||
      f.dateTo !== '' ||
      f.channel.trim() !== '' ||
      (f.status && f.status !== 'all') ||
      (f.type && f.type !== 'all')
    );
  }, [filters]);

  return {
    contentItems: filteredItems,
    totalInLibrary: allContentItems.length,
    tags,
    tagSlugFromMockName,
    authors,
    channels,
    supportsChannelFilter,
    loading,
    filters,
    effectiveFilters,
    filterIssues,
    removeInvalidFilters,
    searchInput,
    setSearchInput,
    patchFilters,
    toggleTag,
    clearAllFilters,
    hasActiveFilters,
    searchHits: USE_STATIC_LIBRARY_SEARCH ? staticSearchPage.hits : remoteSearchHits,
    searchTotal: USE_STATIC_LIBRARY_SEARCH ? staticSearchPage.total : remoteSearchTotal,
    searchPage,
    setSearchPage,
    searchPageSize: LIBRARY_SEARCH_PAGE_SIZE,
    searchLoading: USE_STATIC_LIBRARY_SEARCH ? false : remoteSearchLoading,
    searchUnavailable: USE_STATIC_LIBRARY_SEARCH ? false : remoteSearchUnavailable,
    searchError: USE_STATIC_LIBRARY_SEARCH ? null : remoteSearchError,
  };
}
