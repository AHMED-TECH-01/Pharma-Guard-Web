/**
 * Inventory skeletons (ui-registry §8: TableSkeleton, MedicineDetailSkeleton).
 * Registry shapes only - no ad-hoc skeleton geometry.
 */

function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-border-subtle ${className}`} aria-hidden="true" />;
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading inventory">
      <div className="flex flex-wrap items-center gap-3">
        <SkeletonLine className="h-9 w-full sm:w-64" />
        <SkeletonLine className="h-9 w-32" />
        <SkeletonLine className="h-9 w-36" />
      </div>
      <div className="mt-4 rounded-lg border border-border-subtle bg-bg-card">
        <div className="space-y-3 border-b border-border-subtle p-4">
          <SkeletonLine className="h-4 w-2/3" />
        </div>
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 border-b border-border-subtle px-4 py-3 last:border-b-0">
            <div className="min-w-0 flex-1 space-y-1.5">
              <SkeletonLine className="h-4 w-40" />
              <SkeletonLine className="h-3 w-24" />
            </div>
            <SkeletonLine className="h-4 w-12" />
            <SkeletonLine className="h-4 w-20" />
            <SkeletonLine className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MedicineDetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading medicine">
      <SkeletonLine className="h-5 w-24" />
      <div className="mt-4 rounded-lg border border-border-subtle bg-bg-card p-6">
        <SkeletonLine className="h-6 w-64" />
        <div className="mt-3 flex gap-4">
          <SkeletonLine className="h-4 w-28" />
          <SkeletonLine className="h-4 w-28" />
          <SkeletonLine className="h-4 w-28" />
        </div>
      </div>
      <div className="mt-6 rounded-lg border border-border-subtle bg-bg-card">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 border-b border-border-subtle px-4 py-3 last:border-b-0">
            <div className="min-w-0 flex-1 space-y-1.5">
              <SkeletonLine className="h-4 w-32" />
              <SkeletonLine className="h-3 w-20" />
            </div>
            <SkeletonLine className="h-4 w-14" />
            <SkeletonLine className="h-4 w-20" />
            <SkeletonLine className="h-8 w-20 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
