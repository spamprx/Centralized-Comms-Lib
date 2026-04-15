import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const navBtn =
    'inline-flex items-center gap-1 rounded-full border border-white/10 bg-app-bg/40 px-3.5 py-2 text-[13px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md transition-[transform,background-color,border-color,box-shadow,color] duration-(--duration-app-slow) ease-(--ease-app-material) motion-reduce:transition-colors';

  return (
    <div className="flex flex-col items-center justify-center gap-3 px-2 py-5 sm:flex-row sm:gap-4">
      <div className="flex items-center gap-2 rounded-full border border-white/[0.09] bg-app-bg/45 p-1.5 shadow-app-lift backdrop-blur-xl supports-backdrop-filter:bg-app-bg/30">
        <button
          type="button"
          aria-label="Go to previous page"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`${navBtn} ${
            currentPage === 1
              ? 'cursor-not-allowed text-app-faint opacity-45'
              : 'cursor-pointer text-app-text hover:border-app-accent/35 hover:bg-white/6 hover:text-app-accent hover:shadow-[0_0_20px_-8px_rgba(147,124,248,0.45)] active:scale-[0.98]'
          }`}
        >
          <ChevronLeft size={16} strokeWidth={2.25} aria-hidden />
          <span className="hidden sm:inline">Previous</span>
        </button>
        <span className="min-w-[7.5rem] select-none px-2 text-center text-[12px] tabular-nums text-app-muted">
          <span className="font-semibold text-app-text">{currentPage}</span>
          <span className="text-app-faint"> / </span>
          <span>{totalPages}</span>
        </span>
        <button
          type="button"
          aria-label="Go to next page"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`${navBtn} ${
            currentPage === totalPages
              ? 'cursor-not-allowed text-app-faint opacity-45'
              : 'cursor-pointer text-app-text hover:border-app-accent-2/35 hover:bg-white/6 hover:text-app-accent-2 hover:shadow-[0_0_20px_-8px_rgba(45,212,191,0.35)] active:scale-[0.98]'
          }`}
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight size={16} strokeWidth={2.25} aria-hidden />
        </button>
      </div>
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-app-faint sm:hidden">
        Page {currentPage} of {totalPages}
      </span>
    </div>
  );
}
