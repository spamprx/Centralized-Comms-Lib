import { useEffect, useMemo, useState } from "react";
import { useLibrary } from "../hooks/useLibrary";
import {
  LibraryFilterBar,
  LibraryFilterChips,
  LibraryFilterInvalidBanner,
  LibraryNoResults,
  ContentGrid,
  Pagination,
  SearchResultsList,
} from "../components/library";
import { serializeLibrarySearchParams } from "../lib/libraryUrlState";
import { PageHeader, PageShell } from "../components/ui";
import type { ContentItem } from "../data/mockLibraryData";

const LIBRARY_PAGE_SIZE_STORAGE_KEY = "library.itemsPerPage";

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
  const paginatedItems = items.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

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
      <PageShell wide className="animate-pulse">
        <div className="mb-8 h-10 max-w-lg rounded-app-lg bg-app-surface" />
        <div className="mb-6 flex flex-wrap gap-3">
          <div className="h-10 flex-1 rounded-app-md bg-app-surface" />
          <div className="h-10 w-40 rounded-app-md bg-app-surface" />
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-[280px] rounded-app-lg bg-app-surface" />
          ))}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell wide>
      <PageHeader
        title="Content library"
        accentWord="library"
        description="Browse and manage all content assets."
        hint="Filters update the URL so you can copy and share the current view."
      />

      <div className="animate-fade-in space-y-6">
        <LibraryFilterInvalidBanner
          issues={filterIssues}
          onRemoveInvalid={removeInvalidFilters}
        />

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
        />

        {(hasActiveFilters || searchInput.trim() !== "") && (
          <LibraryFilterChips
            filters={filters}
            searchDisplay={searchInput.trim() || filters.q.trim()}
            tagCatalog={tags}
            enableAdvancedFacets={true}
            onRemoveSearch={() => {
              setSearchInput("");
              patchFilters({ q: "" });
            }}
            onRemoveTag={(slug) => toggleTag(slug)}
            onRemoveAuthor={() => patchFilters({ author: "" })}
            onRemoveChannel={() => patchFilters({ channel: "" })}
            onRemoveStatus={() => patchFilters({ status: "all" })}
            onRemoveType={() => patchFilters({ type: "all" })}
            onRemoveDateFrom={() => patchFilters({ dateFrom: "" })}
            onRemoveDateTo={() => patchFilters({ dateTo: "" })}
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
            setSearchInput("");
            patchFilters({ q: "" });
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
                hasActiveFilters={hasActiveFilters || searchInput.trim() !== ""}
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
