import type { Tag } from '../../data/mockLibraryData';
import type { LibraryUrlFilters } from '../../lib/libraryUrlState';

function tagLabelForSlug(slug: string, catalog: Tag[]): string {
  const found = catalog.find((t) => t.name.toLowerCase() === slug.toLowerCase());
  return found?.name ?? slug;
}

const chipBase =
  'inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-2xl text-[11px] font-medium max-w-full';

export type LibraryFilterChipsProps = {
  filters: LibraryUrlFilters;
  /** Reflects the search box (may be ahead of debounced URL `q`). */
  searchDisplay: string;
  tagCatalog: Tag[];
  onRemoveSearch: () => void;
  onRemoveTag: (slug: string) => void;
  onRemoveAuthor: () => void;
  onRemoveChannel: () => void;
  onRemoveStatus: () => void;
  onRemoveType: () => void;
  onRemoveDateFrom: () => void;
  onRemoveDateTo: () => void;
  onClearAll: () => void;
};

export function LibraryFilterChips({
  filters,
  searchDisplay,
  tagCatalog,
  onRemoveSearch,
  onRemoveTag,
  onRemoveAuthor,
  onRemoveChannel,
  onRemoveStatus,
  onRemoveType,
  onRemoveDateFrom,
  onRemoveDateTo,
  onClearAll,
}: LibraryFilterChipsProps) {
  const chips: { key: string; label: string; className: string; onRemove: () => void }[] = [];

  if (searchDisplay.trim()) {
    chips.push({
      key: 'q',
      label: `Search: "${searchDisplay.trim()}"`,
      className: 'bg-violet-500/15 text-violet-300 border border-violet-500/25',
      onRemove: onRemoveSearch,
    });
  }

  for (const slug of filters.tags) {
    chips.push({
      key: `tag:${slug}`,
      label: `Tag: ${tagLabelForSlug(slug, tagCatalog)}`,
      className: 'bg-fuchsia-500/12 text-fuchsia-300 border border-fuchsia-500/22',
      onRemove: () => onRemoveTag(slug),
    });
  }

  if (filters.author.trim()) {
    chips.push({
      key: 'author',
      label: `Author: ${filters.author}`,
      className: 'bg-sky-500/12 text-sky-300 border border-sky-500/22',
      onRemove: onRemoveAuthor,
    });
  }

  if (filters.channel.trim()) {
    chips.push({
      key: 'channel',
      label: `Channel: ${filters.channel}`,
      className: 'bg-teal-500/12 text-teal-300 border border-teal-500/22',
      onRemove: onRemoveChannel,
    });
  }

  if (filters.status !== 'all') {
    chips.push({
      key: 'status',
      label: `Status: ${filters.status}`,
      className: 'bg-amber-500/12 text-amber-300 border border-amber-500/22',
      onRemove: onRemoveStatus,
    });
  }

  if (filters.type !== 'all') {
    chips.push({
      key: 'type',
      label: `Type: ${filters.type}`,
      className: 'bg-cyan-500/12 text-cyan-300 border border-cyan-500/22',
      onRemove: onRemoveType,
    });
  }

  if (filters.dateFrom) {
    chips.push({
      key: 'from',
      label: `From: ${filters.dateFrom}`,
      className: 'bg-white/[0.06] text-[#c4c8dc] border border-white/10',
      onRemove: onRemoveDateFrom,
    });
  }

  if (filters.dateTo) {
    chips.push({
      key: 'to',
      label: `To: ${filters.dateTo}`,
      className: 'bg-white/[0.06] text-[#c4c8dc] border border-white/10',
      onRemove: onRemoveDateTo,
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      {chips.map((c) => (
        <span key={c.key} className={`${chipBase} ${c.className}`}>
          <span className="truncate max-w-[220px]">{c.label}</span>
          <button
            type="button"
            onClick={c.onRemove}
            className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-black/20 border-none cursor-pointer text-inherit hover:bg-black/35"
            aria-label={`Remove ${c.label}`}
          >
            ×
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="text-[11px] text-[#555870] hover:text-[#8b8fa8] bg-transparent border-none cursor-pointer underline-offset-2 hover:underline ml-1"
      >
        Clear all
      </button>
    </div>
  );
}
