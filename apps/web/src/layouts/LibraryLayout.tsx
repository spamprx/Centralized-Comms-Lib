import { useMemo, useState } from "react";
import { useLibrary } from "../hooks/useLibrary";
import {
  LibraryFilterBar,
  LibraryFilterChips,
  ContentGrid,
  Pagination,
  SearchResultsList,
} from "../components/library";
import { serializeLibrarySearchParams } from "../lib/libraryUrlState";
import { PageHeader, PageShell } from "../components/ui";
import type { ContentItem } from "../data/mockLibraryData";

function LibraryPaginatedContent({ items }: { items: ContentItem[] }) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const paginatedItems = items.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

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

        {(hasActiveFilters || searchInput.trim() !== "") && (
          <LibraryFilterChips
            filters={filters}
            searchDisplay={searchInput.trim() || filters.q.trim()}
            tagCatalog={tags}
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
        />

        <LibraryPaginatedContent key={filterKey} items={contentItems} />
      </div>
    </PageShell>
  );
}
