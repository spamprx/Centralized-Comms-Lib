import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { mockContentItems, mockTags } from '../data/mockLibraryData';
import type { ContentItem, Tag } from '../data/mockLibraryData';
import { useDebouncedValue } from './useDebouncedValue';
import {
  analyzeLibraryFilters,
  mergeLibraryFilters,
  parseLibrarySearchParams,
  serializeLibrarySearchParams,
  type LibraryUrlFilters,
} from '../lib/libraryUrlState';
import { searchContent, type ContentSearchHit } from '../services/searchService';

const USE_MOCK_DATA = true;

function tagSlugFromMockName(name: string): string {
  return name.toLowerCase();
}

function itemMatchesTagFacet(itemTags: string[], selected: string[]): boolean {
  if (selected.length === 0) return true;
  const lower = itemTags.map((t) => t.toLowerCase());
  return selected.some((s) => lower.includes(s.toLowerCase()));
}

export function useLibrary() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseLibrarySearchParams(searchParams), [searchParams]);

  const [allContentItems, setAllContentItems] = useState<ContentItem[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState(() => searchParams.get('q') ?? '');
  const [searchHits, setSearchHits] = useState<ContentSearchHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchUnavailable, setSearchUnavailable] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    setSearchInput(filters.q);
  }, [filters.q]);

  const debouncedQ = useDebouncedValue(searchInput, 380);

  useEffect(() => {
    setSearchParams((prev) => {
      const f = parseLibrarySearchParams(prev);
      const qTrim = debouncedQ.trim();
      const urlQ = f.q.trim();
      if (qTrim === urlQ) return prev;
      return mergeLibraryFilters(prev, { q: debouncedQ });
    }, { replace: true });
  }, [debouncedQ, setSearchParams]);

  useEffect(() => {
    const q = filters.q.trim();
    if (!q) {
      setSearchHits([]);
      setSearchLoading(false);
      setSearchUnavailable(false);
      setSearchError(null);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);
    setSearchError(null);

    (async () => {
      try {
        const res = await searchContent(q, { size: 12, includeSnippets: true });
        if (cancelled) return;
        if (res === null) {
          setSearchUnavailable(true);
          setSearchHits([]);
          return;
        }
        setSearchUnavailable(false);
        setSearchHits(res.hits ?? []);
      } catch (e) {
        if (cancelled) return;
        setSearchError(e instanceof Error ? e.message : 'Search failed');
        setSearchHits([]);
        setSearchUnavailable(false);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filters.q]);

  useEffect(() => {
    if (USE_MOCK_DATA) {
      setTimeout(() => {
        setAllContentItems(mockContentItems);
        setTags(mockTags);
        setLoading(false);
      }, 200);
    }
  }, []);

  const patchFilters = useCallback(
    (patch: Partial<LibraryUrlFilters>) => {
      setSearchParams((prev) => mergeLibraryFilters(prev, patch), { replace: true });
    },
    [setSearchParams],
  );

  const toggleTag = useCallback(
    (tagSlug: string) => {
      setSearchParams((prev) => {
        const f = parseLibrarySearchParams(prev);
        const next = new Set(f.tags.map((t) => t.toLowerCase()));
        const key = tagSlug.toLowerCase();
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return serializeLibrarySearchParams({ ...f, tags: [...next] });
      }, { replace: true });
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

  const tagSlugCatalog = useMemo(
    () => new Set(tags.map((t) => t.name.toLowerCase())),
    [tags],
  );

  const filterCatalog = useMemo(
    () => ({ authors, channels, tagSlugs: tagSlugCatalog }),
    [authors, channels, tagSlugCatalog],
  );

  const { effective: effectiveFilters, issues: filterIssues } = useMemo(
    () => analyzeLibraryFilters(filters, filterCatalog),
    [filters, filterCatalog],
  );

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
      if (effectiveFilters.status !== 'all' && item.status !== effectiveFilters.status) return false;
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
    searchHits,
    searchLoading,
    searchUnavailable,
    searchError,
  };
}
