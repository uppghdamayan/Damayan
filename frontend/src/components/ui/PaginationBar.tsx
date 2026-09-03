'use client';

import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationBarProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/** Builds a compact page list with ellipsis markers, e.g. [1, '…', 4, 5, 6, '…', 12] */
function getPageRange(page: number, totalPages: number): (number | '…')[] {
  const siblingCount = 1;
  const totalNumbers = siblingCount * 2 + 5; // first + last + current + 2 siblings + 2 ellipses

  if (totalPages <= totalNumbers) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(page - siblingCount, 1);
  const rightSibling = Math.min(page + siblingCount, totalPages);

  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < totalPages - 1;

  const range: (number | '…')[] = [1];

  if (showLeftEllipsis) {
    range.push('…');
  } else if (leftSibling > 1) {
    range.push(2);
  }

  for (let p = Math.max(leftSibling, 2); p <= Math.min(rightSibling, totalPages - 1); p++) {
    range.push(p);
  }

  if (showRightEllipsis) {
    range.push('…');
  } else if (rightSibling < totalPages) {
    range.push(totalPages - 1);
  }

  range.push(totalPages);

  return Array.from(new Set(range.filter((v) => v !== '…') as number[]))
    .sort((a, b) => a - b)
    .reduce<(number | '…')[]>((acc, p, idx, arr) => {
      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('…');
      acc.push(p);
      return acc;
    }, []);
}

export function PaginationBar({ page, totalPages, onPageChange }: PaginationBarProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 py-2">
      {/* Prev arrow */}
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
        className="w-10 h-10 rounded-xl border border-border bg-surface text-text-secondary flex items-center justify-center transition-all duration-150 cursor-pointer hover:bg-surface-2 hover:border-border-strong hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface disabled:hover:border-border"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Page numbers with ellipsis */}
      {getPageRange(page, totalPages).map((p, idx) =>
        p === '…' ? (
          <span
            key={`ellipsis-${idx}`}
            className="w-10 h-10 flex items-center justify-center text-text-muted"
          >
            <MoreHorizontal className="w-4 h-4" />
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(
              'w-10 h-10 rounded-xl text-[13px] font-bold cursor-pointer border flex items-center justify-center transition-all duration-150',
              p === page
                ? 'bg-accent text-white border-accent-hover shadow-btn-primary'
                : 'bg-surface text-text-secondary border-border hover:bg-surface-2 hover:border-border-strong hover:text-text-primary'
            )}
          >
            {p}
          </button>
        )
      )}

      {/* Next arrow */}
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
        className="w-10 h-10 rounded-xl border border-border bg-surface text-text-secondary flex items-center justify-center transition-all duration-150 cursor-pointer hover:bg-surface-2 hover:border-border-strong hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface disabled:hover:border-border"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
