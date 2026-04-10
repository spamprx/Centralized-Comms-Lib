import { Search } from 'lucide-react';
import type { Tag } from '../../data/mockLibraryData';
import type { LibraryUrlFilters } from '../../lib/libraryUrlState';

export type LibraryFilterBarProps = {
  searchInput: string;
  onSearchChange: (value: string) => void;
  filters: LibraryUrlFilters;
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
};

export function LibraryFilterBar({
  searchInput,
  onSearchChange,
  filters,
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
}: LibraryFilterBarProps) {
  const selectedSlugSet = new Set(filters.tags.map((t) => t.toLowerCase()));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3 flex-wrap items-end">
        <div className="flex-1 min-w-[220px]">
          <label className="text-[10px] font-semibold text-[#555870] uppercase tracking-wide block mb-1.5">
            Search
          </label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555870] pointer-events-none" />
            <input
              type="text"
              placeholder="Title or author…"
              value={searchInput}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full py-2.5 pr-3 pl-10 bg-white/5 border border-white/10 rounded-lg text-[#e2e4f0] text-[13px] outline-none box-border"
            />
          </div>
        </div>

        <div className="min-w-[140px]">
          <label className="text-[10px] font-semibold text-[#555870] uppercase tracking-wide block mb-1.5">
            Author
          </label>
          <select
            value={filters.author}
            onChange={(e) => onAuthorChange(e.target.value)}
            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#e2e4f0] text-[13px] cursor-pointer box-border"
          >
            <option value="">All authors</option>
            {authors.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[140px]">
          <label className="text-[10px] font-semibold text-[#555870] uppercase tracking-wide block mb-1.5">
            Channel
          </label>
          <select
            value={filters.channel}
            onChange={(e) => onChannelChange(e.target.value)}
            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#e2e4f0] text-[13px] cursor-pointer box-border"
          >
            <option value="">All channels</option>
            {channels.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[130px]">
          <label className="text-[10px] font-semibold text-[#555870] uppercase tracking-wide block mb-1.5">
            Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#e2e4f0] text-[13px] cursor-pointer box-border"
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="review">In review</option>
            <option value="published">Published</option>
          </select>
        </div>

        <div className="min-w-[130px]">
          <label className="text-[10px] font-semibold text-[#555870] uppercase tracking-wide block mb-1.5">
            Type
          </label>
          <select
            value={filters.type}
            onChange={(e) => onTypeChange(e.target.value)}
            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#e2e4f0] text-[13px] cursor-pointer box-border"
          >
            <option value="all">All types</option>
            <option value="article">Article</option>
            <option value="video">Video</option>
            <option value="podcast">Podcast</option>
            <option value="document">Document</option>
          </select>
        </div>

        <div className="min-w-[130px]">
          <label className="text-[10px] font-semibold text-[#555870] uppercase tracking-wide block mb-1.5">
            From
          </label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[#e2e4f0] text-[13px] outline-none box-border"
          />
        </div>

        <div className="min-w-[130px]">
          <label className="text-[10px] font-semibold text-[#555870] uppercase tracking-wide block mb-1.5">
            To
          </label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[#e2e4f0] text-[13px] outline-none box-border"
          />
        </div>
      </div>

      <div>
        <span className="text-[10px] font-semibold text-[#555870] uppercase tracking-wide block mb-2">
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
                    : 'text-[#8b8fa8] border-white/10 bg-white/[0.02] hover:border-white/20'
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
    </div>
  );
}
