'use client';

/**
 * Analytics loading skeleton (reference REPORTS & ANALYTICS layout): mirrors
 * the final composition - 3 KPI cards, Sales Trend + Top Selling Medicines
 * row, export button row - instead of a generic spinner (ui-rules skeleton
 * fidelity requirement).
 */

const BLOCK = 'animate-pulse rounded bg-bg-subtle';

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading analytics">
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="rounded-lg border border-border-subtle bg-bg-card p-4">
            <div className={`h-3 w-20 ${BLOCK}`} />
            <div className={`mt-2 h-6 w-28 ${BLOCK}`} />
            <div className={`mt-2 h-3 w-24 ${BLOCK}`} />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border-subtle bg-bg-card p-5 lg:col-span-2">
          <div className={`h-4 w-28 ${BLOCK}`} />
          <div className={`mt-6 h-48 ${BLOCK}`} />
        </div>
        <div className="rounded-lg border border-border-subtle bg-bg-card p-5">
          <div className={`h-4 w-36 ${BLOCK}`} />
          <div className="mt-4 space-y-4">
            {[0, 1, 2, 3].map((index) => (
              <div key={index}>
                <div className={`h-3 w-32 ${BLOCK}`} />
                <div className={`mt-2 h-2 w-full ${BLOCK}`} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <div className={`h-9 w-32 ${BLOCK}`} />
        <div className={`h-9 w-32 ${BLOCK}`} />
        <div className={`h-9 w-28 ${BLOCK}`} />
      </div>
    </div>
  );
}
