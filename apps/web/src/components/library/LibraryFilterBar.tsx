import { Search } from 'lucide-react';
import type { Tag } from '../../data/mockLibraryData';
import type { LibraryUrlFilters } from '../../lib/libraryUrlState';
import { Surface, formLabelClass, formInputClass, formSelectClass } from '../ui';

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
  supportsChannelFilter?: boolean;
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
  supportsChannelFilter = true,
  enableAdvancedFacets = true,
  pageSize,
  onPageSizeChange,
}: Readonly<LibraryFilterBarProps>) {
  const selectedSlugSet = new Set(filters.tags.map((t) => t.toLowerCase()));

  return (
    <Surface
      variant="glass"
      padding="md"
      className="overflow-hidden shadow-app-lift transition-shadow duration-(--duration-app-slow) ease-app-out hover:shadow-app-soft"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-app-accent/14 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 left-1/4 h-40 w-40 rounded-full bg-app-accent-2/10 blur-3xl"
      />
      <div className="relative z-1 flex flex-col gap-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label htmlFor="library-search" className={formLabelClass}>
              Search
            </label>
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 z-1 -translate-y-1/2 text-app-accent/70"
              />
              <input
                id="library-search"
                type="text"
                placeholder="Title or author…"
                aria-label="Search library"
                value={searchInput}
                onChange={(e) => onSearchChange(e.target.value)}
                className={`${formInputClass} box-border py-2.5 pl-10 pr-3 text-[13px]`}
              />
            </div>
          </div>

          <div className="min-w-[140px]">
            <label htmlFor="library-filter-author" className={formLabelClass}>
              Author
            </label>
            <select
              id="library-filter-author"
              value={appliedFacetValues.author}
              onChange={(e) => onAuthorChange(e.target.value)}
              aria-label="Filter by author"
              className={`${formSelectClass} box-border py-2.5 text-[13px]`}
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
              <label htmlFor="library-filter-channel" className={formLabelClass}>
                Channel
              </label>
              <select
                id="library-filter-channel"
                value={appliedFacetValues.channel}
                onChange={(e) => onChannelChange(e.target.value)}
                aria-label="Filter by channel"
                title={
                  supportsChannelFilter
                    ? 'Filter by channel'
                    : 'Channel filter is not supported for DB-backed library yet'
                }
                disabled={!supportsChannelFilter}
                className={`${formSelectClass} box-border py-2.5 text-[13px]`}
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
            <label htmlFor="library-filter-status" className={formLabelClass}>
              Status
            </label>
            <select
              id="library-filter-status"
              value={appliedFacetValues.status}
              onChange={(e) => onStatusChange(e.target.value)}
              aria-label="Filter by status"
              className={`${formSelectClass} box-border py-2.5 text-[13px]`}
            >
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="review">In review</option>
              <option value="published">Published</option>
            </select>
          </div>

          <div className="min-w-[130px]">
            <label htmlFor="library-page-size" className={formLabelClass}>
              Per page
            </label>
            <select
              id="library-page-size"
              value={String(pageSize)}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Items per page"
              className={`${formSelectClass} box-border py-2.5 text-[13px]`}
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="20">20</option>
            </select>
          </div>

          {enableAdvancedFacets ? (
            <div className="min-w-[130px]">
              <label htmlFor="library-filter-type" className={formLabelClass}>
                Type
              </label>
              <select
                id="library-filter-type"
                value={appliedFacetValues.type}
                onChange={(e) => onTypeChange(e.target.value)}
                aria-label="Filter by type"
                title="Filter by type"
                className={`${formSelectClass} box-border py-2.5 text-[13px]`}
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
                <label htmlFor="library-filter-date-from" className={formLabelClass}>
                  From
                </label>
                <input
                  id="library-filter-date-from"
                  type="date"
                  value={appliedFacetValues.dateFrom}
                  onChange={(e) => onDateFromChange(e.target.value)}
                  aria-label="Filter from date"
                  title="From date"
                  className={`${formInputClass} box-border py-2 text-[13px]`}
                />
              </div>

              <div className="min-w-[130px]">
                <label htmlFor="library-filter-date-to" className={formLabelClass}>
                  To
                </label>
                <input
                  id="library-filter-date-to"
                  type="date"
                  value={appliedFacetValues.dateTo}
                  onChange={(e) => onDateToChange(e.target.value)}
                  aria-label="Filter to date"
                  title="To date"
                  className={`${formInputClass} box-border py-2 text-[13px]`}
                />
              </div>
            </>
          ) : null}
        </div>

        {enableAdvancedFacets && tags.length > 0 ? (
          <div className="border-t border-white/[0.06] pt-5">
            <span className={formLabelClass}>Tags (any match)</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {tags.map((tag) => {
                const slug = tagSlugFromMockName(tag.name);
                const on = selectedSlugSet.has(slug);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => onToggleTag(slug)}
                    className={`cursor-pointer rounded-full px-3 py-1.5 text-[11px] font-medium transition-[transform,box-shadow,background-color,border-color,color] duration-(--duration-app-slow) ease-(--ease-app-material) motion-reduce:transition-colors ${
                      on
                        ? 'text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-white/15'
                        : 'border border-white/10 bg-app-bg/35 text-app-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm hover:border-white/18 hover:bg-white/6 hover:text-app-text'
                    } active:scale-[0.97]`}
                    style={
                      on
                        ? {
                            background: `linear-gradient(135deg, ${tag.color}55, ${tag.color}28)`,
                            boxShadow: `inset 0 0 0 1px ${tag.color}66, 0 0 24px -8px ${tag.color}44`,
                          }
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
    </Surface>
  );
}
