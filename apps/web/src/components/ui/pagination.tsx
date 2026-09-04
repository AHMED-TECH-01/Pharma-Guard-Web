'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Pagination (ui-registry §2). Controlled by the URL query (TRD §17);
 * renders a compact window around the current page.
 */

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

function pageWindow(page: number, totalPages: number): number[] {
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  const pages: number[] = [];
  for (let current = start; current <= end; current += 1) {
    pages.push(current);
  }
  return pages;
}

export function Pagination({ page, totalPages, total, pageSize, onPageChange, disabled = false }: PaginationProps) {
  if (total === 0) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  const buttonClass =
    'inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-border px-2 text-sm transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 pt-1">
      <p className="text-xs text-text-muted">
        Showing {first}-{last} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={buttonClass}
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        {pageWindow(page, totalPages).map((candidate) => (
          <button
            key={candidate}
            type="button"
            className={`${buttonClass} ${candidate === page ? 'bg-primary-600 text-white hover:bg-primary-700' : ''}`}
            disabled={disabled || candidate === page}
            aria-current={candidate === page ? 'page' : undefined}
            onClick={() => onPageChange(candidate)}
          >
            {candidate}
          </button>
        ))}
        <button
          type="button"
          className={buttonClass}
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </nav>
  );
}
