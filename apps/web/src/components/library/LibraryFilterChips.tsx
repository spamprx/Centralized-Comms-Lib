import type { Tag } from '../../data/mockLibraryData';
import type { LibraryUrlFilters } from '../../lib/libraryUrlState';

function tagLabelForSlug(slug: string, catalog: Tag[]): string {
  const found = catalog.find((t) => t.name.toLowerCase() === slug.toLowerCase());
  return found?.name ?? slug;
}

const chipBase =
  'inline-flex max-w-full items-center gap-1.5 rounded-full py-1 pl-3 pr-1 text-[11px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md transition-[transform,box-shadow,border-color] duration-(--duration-app-slow) ease-(--ease-app-material) hover:-translate-y-px motion-reduce:transition-none motion-reduce:hover:transform-none';

export type LibraryFilterChipsProps = {
  filters: LibraryUrlFilters;
  /** Reflects the search box (may be ahead of debounced URL `q`). */
  searchDisplay: string;
  tagCatalog: Tag[];
  /** When false, hide chips for facets that aren't supported by the backend yet. */
  enableAdvancedFacets?: boolean;
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
  enableAdvancedFacets = true,
  onRemoveSearch,
  onRemoveTag,
  onRemoveAuthor,
  onRemoveChannel,
  onRemoveStatus,
  onRemoveType,
  onRemoveDateFrom,
  onRemoveDateTo,
  onClearAll,
}: Readonly<LibraryFilterChipsProps>) {
  const chips: { key: string; label: string; className: string; onRemove: () => void }[] = [];

  if (searchDisplay.trim()) {
    chips.push({
      key: 'q',
      label: `Search: "${searchDisplay.trim()}"`,
      className:
        'border border-app-accent/35 bg-gradient-to-br from-app-accent/25 to-app-accent-muted text-app-accent ring-1 ring-app-accent/20',
      onRemove: onRemoveSearch,
    });
  }

  if (enableAdvancedFacets) {
    for (const slug of filters.tags) {
      chips.push({
        key: `tag:${slug}`,
        label: `Tag: ${tagLabelForSlug(slug, tagCatalog)}`,
        className:
          'border border-fuchsia-400/25 bg-fuchsia-500/15 text-fuchsia-100 ring-1 ring-fuchsia-500/15',
        onRemove: () => onRemoveTag(slug),
      });
    }
  }

  if (filters.author.trim()) {
    chips.push({
      key: 'author',
      label: `Author: ${filters.author}`,
      className: 'border border-sky-400/25 bg-sky-500/15 text-sky-100 ring-1 ring-sky-400/15',
      onRemove: onRemoveAuthor,
    });
  }

  if (enableAdvancedFacets && filters.channel.trim()) {
    chips.push({
      key: 'channel',
      label: `Channel: ${filters.channel}`,
      className:
        'border border-app-accent-2/30 bg-app-accent-2/12 text-teal-100 ring-1 ring-app-accent-2/20',
      onRemove: onRemoveChannel,
    });
  }

  if (filters.status !== 'all') {
    chips.push({
      key: 'status',
      label: `Status: ${filters.status}`,
      className:
        'border border-amber-400/25 bg-amber-500/14 text-amber-100 ring-1 ring-amber-400/15',
      onRemove: onRemoveStatus,
    });
  }

  if (enableAdvancedFacets && filters.type !== 'all') {
    chips.push({
      key: 'type',
      label: `Type: ${filters.type}`,
      className: 'border border-cyan-400/25 bg-cyan-500/14 text-cyan-100 ring-1 ring-cyan-400/15',
      onRemove: onRemoveType,
    });
  }

  if (enableAdvancedFacets && filters.dateFrom) {
    chips.push({
      key: 'from',
      label: `From: ${filters.dateFrom}`,
      className: 'border border-white/10 bg-app-bg/50 text-app-muted ring-1 ring-white/8',
      onRemove: onRemoveDateFrom,
    });
  }

  if (enableAdvancedFacets && filters.dateTo) {
    chips.push({
      key: 'to',
      label: `To: ${filters.dateTo}`,
      className: 'border border-white/10 bg-app-bg/50 text-app-muted ring-1 ring-white/8',
      onRemove: onRemoveDateTo,
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <span key={c.key} className={`${chipBase} ${c.className}`}>
          <span className="max-w-[220px] truncate">{c.label}</span>
          <button
            type="button"
            onClick={c.onRemove}
            className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-black/25 text-[13px] leading-none text-inherit transition-[background-color,transform,border-color] duration-(--duration-app) ease-app-out hover:border-white/18 hover:bg-white/12 active:scale-95"
            aria-label={`Remove ${c.label}`}
          >
            ×
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="ml-1 cursor-pointer border-none bg-transparent text-[11px] text-app-faint underline-offset-4 transition-[color,transform] duration-(--duration-app) ease-app-out hover:text-app-accent hover:underline active:scale-[0.98]"
      >
        Clear all
      </button>
    </div>
  );
}
