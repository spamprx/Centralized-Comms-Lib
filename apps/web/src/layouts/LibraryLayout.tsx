import { useEffect, useMemo, useState } from 'react';
import { useLibrary } from '../hooks/useLibrary';
import {
  LibraryFilterBar,
  LibraryFilterChips,
  LibraryFilterInvalidBanner,
  LibraryNoResults,
  ContentGrid,
  Pagination,
  SearchResultsList,
} from '../components/library';
import { serializeLibrarySearchParams } from '../lib/libraryUrlState';
import { PageHeader, PageShell } from '../components/ui';
import type { ContentItem } from '../data/mockLibraryData';

const LIBRARY_PAGE_SIZE_STORAGE_KEY = 'library.itemsPerPage';

function readStoredItemsPerPage(): number {
  if (!globalThis.window) return 10;
  const raw = globalThis.window.localStorage.getItem(LIBRARY_PAGE_SIZE_STORAGE_KEY);
  const n = raw ? Number(raw) : Number.NaN;
  if (n === 5 || n === 10 || n === 20) return n;
  return 10;
}

function LibraryPaginatedContent({
  items,
  itemsPerPage,
}: Readonly<{
  items: ContentItem[];
  itemsPerPage: number;
}>) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const paginatedItems = items.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage]);

  return (
    <>
      <ContentGrid items={paginatedItems} />
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </>
  );
}

export default function LibraryLayout() {
  const [itemsPerPage, setItemsPerPage] = useState(() => readStoredItemsPerPage());
  const {
    contentItems,
    totalInLibrary,
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
    searchHits,
    searchTotal,
    searchPage,
    setSearchPage,
    searchPageSize,
    searchLoading,
    searchUnavailable,
    searchError,
  } = useLibrary();

  useEffect(() => {
    try {
      globalThis.window?.localStorage.setItem(LIBRARY_PAGE_SIZE_STORAGE_KEY, String(itemsPerPage));
    } catch {
      // ignore (e.g., disabled storage)
    }
  }, [itemsPerPage]);

  const filterKey = useMemo(
    () => `${serializeLibrarySearchParams(filters).toString()}|${searchInput}`,
    [filters, searchInput],
  );

  if (loading) {
    return (
      <PageShell wide className="app-main-canvas">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
          <div className="absolute -left-24 top-20 h-64 w-64 rounded-full bg-app-accent/12 blur-[100px]" />
          <div className="absolute right-0 top-40 h-56 w-56 rounded-full bg-app-accent-2/10 blur-[90px]" />
        </div>
        <div className="space-y-8">
          <div className="space-y-3">
            <div className="app-skeleton-shimmer h-3 w-32 rounded-full" />
            <div className="app-skeleton-shimmer h-10 max-w-lg rounded-app-lg" />
            <div className="app-skeleton-shimmer h-3 max-w-xl rounded-full" />
          </div>
          <div className="relative overflow-hidden rounded-app-xl border border-white/[0.08] bg-app-bg/35 p-5 shadow-app-lift backdrop-blur-xl supports-backdrop-filter:bg-app-bg/25">
            <div className="flex flex-wrap gap-3">
              <div className="app-skeleton-shimmer h-11 min-w-[220px] flex-1 rounded-app-md" />
              <div className="app-skeleton-shimmer h-11 w-36 rounded-app-md" />
              <div className="app-skeleton-shimmer h-11 w-32 rounded-app-md" />
              <div className="app-skeleton-shimmer h-11 w-28 rounded-app-md" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="app-skeleton-shimmer h-8 w-20 rounded-full" />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(288px,1fr))] gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="relative overflow-hidden rounded-app-xl border border-white/[0.08] bg-app-bg/30 shadow-app-lift backdrop-blur-xl supports-backdrop-filter:bg-app-bg/22"
              >
                <div className="app-skeleton-shimmer h-[148px] w-full" />
                <div className="space-y-3 p-4">
                  <div className="app-skeleton-shimmer h-3 w-16 rounded-full" />
                  <div className="app-skeleton-shimmer h-4 w-full rounded-app-sm" />
                  <div className="app-skeleton-shimmer h-4 w-[85%] rounded-app-sm" />
                  <div className="flex gap-2 pt-2">
                    <div className="app-skeleton-shimmer h-5 w-14 rounded-md" />
                    <div className="app-skeleton-shimmer h-5 w-14 rounded-md" />
                  </div>
                  <div className="app-skeleton-shimmer mt-2 h-10 w-full rounded-app-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell wide className="app-main-canvas">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute -left-24 top-20 h-64 w-64 rounded-full bg-app-accent/12 blur-[100px]" />
        <div className="absolute right-0 top-40 h-56 w-56 rounded-full bg-app-accent-2/10 blur-[90px]" />
        <div className="absolute bottom-0 left-1/3 h-40 w-96 max-w-[80%] rounded-full bg-app-accent-deep/15 blur-[100px]" />
      </div>

      <PageHeader
        title="Content library"
        accentWord="library"
        description="Browse and manage all content assets."
        hint="Filters update the URL so you can copy and share the current view."
      />

      <div className="animate-fade-in space-y-8">
        <LibraryFilterInvalidBanner issues={filterIssues} onRemoveInvalid={removeInvalidFilters} />

        <LibraryFilterBar
          searchInput={searchInput}
          onSearchChange={setSearchInput}
          filters={filters}
          enableAdvancedFacets={true}
          pageSize={itemsPerPage}
          onPageSizeChange={setItemsPerPage}
          appliedFacetValues={{
            author: effectiveFilters.author,
            channel: effectiveFilters.channel,
            status: effectiveFilters.status,
            type: effectiveFilters.type,
            dateFrom: effectiveFilters.dateFrom,
            dateTo: effectiveFilters.dateTo,
          }}
          onAuthorChange={(author) => patchFilters({ author })}
          onChannelChange={(channel) => patchFilters({ channel })}
          onStatusChange={(status) => patchFilters({ status })}
          onTypeChange={(type) => patchFilters({ type })}
          onDateFromChange={(dateFrom) => patchFilters({ dateFrom })}
          onDateToChange={(dateTo) => patchFilters({ dateTo })}
          tags={tags}
          tagSlugFromMockName={tagSlugFromMockName}
          onToggleTag={toggleTag}
          authors={authors}
          channels={channels}
          supportsChannelFilter={supportsChannelFilter}
        />

        {(hasActiveFilters || searchInput.trim() !== '') && (
          <LibraryFilterChips
            filters={filters}
            searchDisplay={searchInput.trim() || filters.q.trim()}
            tagCatalog={tags}
            enableAdvancedFacets={true}
            onRemoveSearch={() => {
              setSearchInput('');
              patchFilters({ q: '' });
            }}
            onRemoveTag={(slug) => toggleTag(slug)}
            onRemoveAuthor={() => patchFilters({ author: '' })}
            onRemoveChannel={() => patchFilters({ channel: '' })}
            onRemoveStatus={() => patchFilters({ status: 'all' })}
            onRemoveType={() => patchFilters({ type: 'all' })}
            onRemoveDateFrom={() => patchFilters({ dateFrom: '' })}
            onRemoveDateTo={() => patchFilters({ dateTo: '' })}
            onClearAll={clearAllFilters}
          />
        )}

        <SearchResultsList
          q={filters.q.trim() || searchInput.trim()}
          loading={searchLoading}
          unavailable={searchUnavailable}
          error={searchError}
          hits={searchHits}
          total={searchTotal}
          page={searchPage}
          pageSize={searchPageSize}
          onPageChange={setSearchPage}
          onClearSearch={() => {
            setSearchInput('');
            patchFilters({ q: '' });
          }}
        />

        {(() => {
          if (contentItems.length > 0) {
            return (
              <LibraryPaginatedContent
                key={filterKey}
                items={contentItems}
                itemsPerPage={itemsPerPage}
              />
            );
          }
          if (totalInLibrary > 0) {
            return (
              <LibraryNoResults
                hasActiveFilters={hasActiveFilters || searchInput.trim() !== ''}
                onClearFilters={clearAllFilters}
              />
            );
          }
          return null;
        })()}
      </div>
    </PageShell>
  );
}
