import { memo, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  totalItems: number;
}

export const Pagination = memo(function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  totalItems,
}: PaginationProps) {
  const startItem = useMemo(() => (currentPage - 1) * pageSize + 1, [currentPage, pageSize]);
  const endItem = useMemo(() => Math.min(currentPage * pageSize, totalItems), [currentPage, pageSize, totalItems]);

  const handlePrev = useCallback(() => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  }, [currentPage, onPageChange]);

  const handleNext = useCallback(() => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  }, [currentPage, totalPages, onPageChange]);

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800">
      <span className="text-sm text-text-muted">
        Showing {startItem}-{endItem} of {totalItems}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={handlePrev}
          disabled={currentPage === 1}
          className="p-1.5 rounded-lg hover:bg-bg-card-hover disabled:opacity-50 disabled:cursor-not-allowed text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm text-text-primary min-w-[80px] text-center">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={handleNext}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-lg hover:bg-bg-card-hover disabled:opacity-50 disabled:cursor-not-allowed text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
});
