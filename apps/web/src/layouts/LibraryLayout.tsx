import { useEffect, useMemo, useState } from 'react';
import { useLibrary } from '../hooks/useLibrary';
import { LibraryFilterBar, LibraryFilterChips, ContentGrid, Pagination, SearchResultsList } from '../components/library';
import { serializeLibrarySearchParams } from '../lib/libraryUrlState';

export default function LibraryLayout() {
  const {
    contentItems,
    tags,
    tagSlugFromMockName,
    authors,
    channels,
    loading,
    filters,
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
  } = useLibrary();

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;
  const totalPages = Math.ceil(contentItems.length / itemsPerPage);
  const paginatedItems = contentItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const filterKey = useMemo(
    () => `${serializeLibrarySearchParams(filters).toString()}|${searchInput}`,
    [filters, searchInput],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filterKey]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-12 bg-white/[0.03] rounded-[10px] mb-6" />
        <div className="flex gap-3 mb-6">
          <div className="h-10 flex-1 bg-white/[0.03] rounded-lg" />
          <div className="h-10 w-[150px] bg-white/[0.03] rounded-lg" />
        </div>
        <div className="grid grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <div key={i} className="h-[280px] bg-white/[0.03] rounded-[10px] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#e2e4f0] mb-1">Content Library</h1>
        <p className="text-[13px] text-[#555870] m-0">Browse and manage all content assets</p>
        <p className="text-[11px] text-[#555870] m-0 mt-2 opacity-90">
          Filters update the URL so you can copy and share the current view.
        </p>
      </div>

      <LibraryFilterBar
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        filters={filters}
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
      />

      {(hasActiveFilters || searchInput.trim() !== '') && (
        <LibraryFilterChips
          filters={filters}
          searchDisplay={searchInput.trim() || filters.q.trim()}
          tagCatalog={tags}
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
      />

      <div className="mt-6">
        <ContentGrid items={paginatedItems} />
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}
