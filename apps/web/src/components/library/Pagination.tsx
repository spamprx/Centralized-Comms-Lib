import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  return (
    <div className="flex justify-center items-center gap-2 p-5">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`px-3 py-2 bg-white/5 border border-white/10 rounded-md flex items-center gap-1 text-[13px] ${
          currentPage === 1 ? 'text-[#555870] cursor-not-allowed' : 'text-[#e2e4f0] cursor-pointer'
        }`}
      >
        <ChevronLeft size={16} /> Previous
      </button>
      <span className="text-[13px] text-[#555870]">
        Page {currentPage} of {totalPages}
      </span>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`px-3 py-2 bg-white/5 border border-white/10 rounded-md flex items-center gap-1 text-[13px] ${
          currentPage === totalPages ? 'text-[#555870] cursor-not-allowed' : 'text-[#e2e4f0] cursor-pointer'
        }`}
      >
        Next <ChevronRight size={16} />
      </button>
    </div>
  );
}
