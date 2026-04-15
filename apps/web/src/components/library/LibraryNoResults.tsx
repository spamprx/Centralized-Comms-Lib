import { FilterX } from 'lucide-react';
import { Button } from '../ui/Button';

export type LibraryNoResultsProps = {
  onClearFilters: () => void;
  hasActiveFilters: boolean;
};

export function LibraryNoResults({ onClearFilters, hasActiveFilters }: LibraryNoResultsProps) {
  return (
    <div
      className="relative flex flex-col items-center justify-center overflow-hidden rounded-app-xl border border-dashed border-white/15 bg-app-bg/35 px-6 py-16 text-center shadow-app-lift backdrop-blur-xl supports-backdrop-filter:bg-app-bg/28"
      role="status"
      aria-live="polite"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(147,124,248,0.12),transparent_65%)]"
      />
      <div className="relative z-1 mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/12 bg-gradient-to-br from-app-accent/20 to-app-accent-2/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_40px_-12px_rgba(147,124,248,0.4)] ring-1 ring-white/10 backdrop-blur-sm">
        <FilterX size={30} className="text-app-accent" aria-hidden />
      </div>
      <h2 className="relative z-1 text-[16px] font-semibold tracking-tight text-app-text">
        No content matches these filters
      </h2>
      <p className="relative z-1 mt-2 max-w-md text-[13px] leading-relaxed text-app-muted">
        Try removing a tag or loosening the date range. You can reset everything and browse the full
        library in one step.
      </p>
      {hasActiveFilters && (
        <Button
          type="button"
          variant="primary"
          className="relative z-1 mt-7 text-[13px] py-2.5 shadow-[0_0_28px_-8px_rgba(147,124,248,0.45)] transition-[transform,box-shadow] duration-(--duration-app-slow) ease-(--ease-app-material) hover:shadow-[0_0_36px_-6px_rgba(147,124,248,0.55)] active:scale-[0.98]"
          onClick={onClearFilters}
        >
          Clear all filters
        </Button>
      )}
    </div>
  );
}
