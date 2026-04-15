import { FilterX } from 'lucide-react';
import { Button } from '../ui/Button';

export type LibraryNoResultsProps = {
  onClearFilters: () => void;
  hasActiveFilters: boolean;
};

export function LibraryNoResults({ onClearFilters, hasActiveFilters }: LibraryNoResultsProps) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-app-xl border border-dashed border-app-border/90 bg-app-surface/40 px-6 py-16 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-app-elevated ring-1 ring-app-border/80">
        <FilterX size={28} className="text-app-faint" aria-hidden />
      </div>
      <h2 className="text-[16px] font-semibold text-app-text tracking-tight">
        No content matches these filters
      </h2>
      <p className="mt-2 max-w-md text-[13px] leading-relaxed text-app-muted">
        Try removing a tag or loosening the date range. You can reset everything and browse the full
        library in one step.
      </p>
      {hasActiveFilters && (
        <Button
          type="button"
          variant="primary"
          className="mt-6 text-[13px] py-2.5"
          onClick={onClearFilters}
        >
          Clear all filters
        </Button>
      )}
    </div>
  );
}
