import { Search } from 'lucide-react';
import type { Tag } from '../../data/mockLibraryData';
import type { LibraryUrlFilters } from '../../lib/libraryUrlState';

export type LibraryFilterBarProps = {
  searchInput: string;
  onSearchChange: (value: string) => void;
  filters: LibraryUrlFilters;
  /** Facet controls use validated values so unknown URL params do not break native selects. */
  appliedFacetValues: Pick<
    LibraryUrlFilters,
    'author' | 'channel' | 'status' | 'type' | 'dateFrom' | 'dateTo'
  >;
  onAuthorChange: (author: string) => void;
  onChannelChange: (channel: string) => void;
  onStatusChange: (status: string) => void;
  onTypeChange: (type: string) => void;
  onDateFromChange: (isoDate: string) => void;
  onDateToChange: (isoDate: string) => void;
  tags: Tag[];
  tagSlugFromMockName: (name: string) => string;
  onToggleTag: (tagSlug: string) => void;
  authors: string[];
  channels: string[];
  /** When false, hide facets that aren't supported by the backend yet. */
  enableAdvancedFacets?: boolean;
  pageSize: number;
  onPageSizeChange: (pageSize: number) => void;
};

export function LibraryFilterBar({
  searchInput,
  onSearchChange,
  filters,
  appliedFacetValues,
  onAuthorChange,
  onChannelChange,
  onStatusChange,
  onTypeChange,
  onDateFromChange,
  onDateToChange,
  tags,
  tagSlugFromMockName,
  onToggleTag,
  authors,
  channels,
  enableAdvancedFacets = true,
  pageSize,
  onPageSizeChange,
}: Readonly<LibraryFilterBarProps>) {
  const selectedSlugSet = new Set(filters.tags.map((t) => t.toLowerCase()));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3 flex-wrap items-end">
        <div className="flex-1 min-w-[220px]">
          <label
            htmlFor="library-search"
            className="text-[10px] font-semibold text-app-faint uppercase tracking-wide block mb-1.5"
          >
            Search
          </label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-faint pointer-events-none" />
            <input
              id="library-search"
              type="text"
              placeholder="Title or author…"
              aria-label="Search library"
              value={searchInput}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full py-2.5 pr-3 pl-10 bg-app-surface border border-app-border rounded-lg text-app-text text-[13px] outline-none box-border"
            />
          </div>
        </div>

        <div className="min-w-[140px]">
          <label
            htmlFor="library-filter-author"
            className="text-[10px] font-semibold text-app-faint uppercase tracking-wide block mb-1.5"
          >
            Author
          </label>
          <select
            id="library-filter-author"
            value={appliedFacetValues.author}
            onChange={(e) => onAuthorChange(e.target.value)}
            aria-label="Filter by author"
            className="w-full px-3 py-2.5 bg-app-surface border border-app-border rounded-lg text-app-text text-[13px] cursor-pointer box-border"
          >
            <option value="">All authors</option>
            {authors.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        {enableAdvancedFacets && channels.length > 0 ? (
          <div className="min-w-[140px]">
            <label
              htmlFor="library-filter-channel"
              className="text-[10px] font-semibold text-app-faint uppercase tracking-wide block mb-1.5"
            >
              Channel
            </label>
            <select
              id="library-filter-channel"
              value={appliedFacetValues.channel}
              onChange={(e) => onChannelChange(e.target.value)}
            aria-label="Filter by channel"
              title="Filter by channel"
              className="w-full px-3 py-2.5 bg-app-surface border border-app-border rounded-lg text-app-text text-[13px] cursor-pointer box-border"
            >
              <option value="">All channels</option>
              {channels.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="min-w-[130px]">
          <label
            htmlFor="library-filter-status"
            className="text-[10px] font-semibold text-app-faint uppercase tracking-wide block mb-1.5"
          >
            Status
          </label>
          <select
            id="library-filter-status"
            value={appliedFacetValues.status}
            onChange={(e) => onStatusChange(e.target.value)}
            aria-label="Filter by status"
            className="w-full px-3 py-2.5 bg-app-surface border border-app-border rounded-lg text-app-text text-[13px] cursor-pointer box-border"
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="review">In review</option>
            <option value="published">Published</option>
          </select>
        </div>

        <div className="min-w-[130px]">
          <label
            htmlFor="library-page-size"
            className="text-[10px] font-semibold text-app-faint uppercase tracking-wide block mb-1.5"
          >
            Per page
          </label>
          <select
            id="library-page-size"
            value={String(pageSize)}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label="Items per page"
            className="w-full px-3 py-2.5 bg-app-surface border border-app-border rounded-lg text-app-text text-[13px] cursor-pointer box-border"
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="20">20</option>
          </select>
        </div>

        {enableAdvancedFacets ? (
          <div className="min-w-[130px]">
            <label
              htmlFor="library-filter-type"
              className="text-[10px] font-semibold text-app-faint uppercase tracking-wide block mb-1.5"
            >
              Type
            </label>
            <select
              id="library-filter-type"
              value={appliedFacetValues.type}
              onChange={(e) => onTypeChange(e.target.value)}
            aria-label="Filter by type"
              title="Filter by type"
              className="w-full px-3 py-2.5 bg-app-surface border border-app-border rounded-lg text-app-text text-[13px] cursor-pointer box-border"
            >
              <option value="all">All types</option>
              <option value="article">Article</option>
              <option value="video">Video</option>
              <option value="podcast">Podcast</option>
              <option value="document">Document</option>
            </select>
          </div>
        ) : null}

        {enableAdvancedFacets ? (
          <>
            <div className="min-w-[130px]">
              <label
                htmlFor="library-filter-date-from"
                className="text-[10px] font-semibold text-app-faint uppercase tracking-wide block mb-1.5"
              >
                From
              </label>
              <input
                id="library-filter-date-from"
                type="date"
                value={appliedFacetValues.dateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
                aria-label="Filter from date"
                title="From date"
                className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-lg text-app-text text-[13px] outline-none box-border"
              />
            </div>

            <div className="min-w-[130px]">
              <label
                htmlFor="library-filter-date-to"
                className="text-[10px] font-semibold text-app-faint uppercase tracking-wide block mb-1.5"
              >
                To
              </label>
              <input
                id="library-filter-date-to"
                type="date"
                value={appliedFacetValues.dateTo}
                onChange={(e) => onDateToChange(e.target.value)}
                aria-label="Filter to date"
                title="To date"
                className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-lg text-app-text text-[13px] outline-none box-border"
              />
            </div>
          </>
        ) : null}
      </div>

      {enableAdvancedFacets && tags.length > 0 ? (
        <div>
          <span className="text-[10px] font-semibold text-app-faint uppercase tracking-wide block mb-2">
            Tags (any match)
          </span>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const slug = tagSlugFromMockName(tag.name);
              const on = selectedSlugSet.has(slug);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => onToggleTag(slug)}
                  className={`text-[11px] px-2.5 py-1.5 rounded-full border transition-colors cursor-pointer ${
                    on
                      ? 'text-white border-transparent'
                      : 'text-app-muted border-app-border bg-app-bg/60 hover:border-white/20'
                  }`}
                  style={
                    on
                      ? { background: `${tag.color}33`, boxShadow: `inset 0 0 0 1px ${tag.color}55` }
                      : undefined
                  }
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
