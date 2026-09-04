/**
 * Safety skeletons (ui-registry §8). The Expiry Center reuses the registry's
 * table-plus-cards shape; alerts get the registered AlertSkeleton.
 */

function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-border-subtle ${className}`} aria-hidden="true" />;
}

export function ExpiryCenterSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading expiry center">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-border-subtle bg-bg-card p-4">
            <SkeletonLine className="h-3 w-20" />
            <SkeletonLine className="mt-3 h-7 w-16" />
            <SkeletonLine className="mt-2 h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-lg border border-border-subtle bg-bg-card">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 border-b border-border-subtle px-4 py-3 last:border-b-0">
            <SkeletonLine className="h-4 w-4" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <SkeletonLine className="h-4 w-44" />
              <SkeletonLine className="h-3 w-24" />
            </div>
            <SkeletonLine className="h-4 w-16" />
            <SkeletonLine className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AlertSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading alerts" className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="rounded-lg border border-border-subtle bg-bg-card p-4">
          <div className="flex items-start gap-3">
            <SkeletonLine className="h-16 w-1 rounded" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex gap-2">
                <SkeletonLine className="h-4 w-20 rounded-full" />
                <SkeletonLine className="h-4 w-24" />
              </div>
              <SkeletonLine className="h-4 w-1/3" />
              <SkeletonLine className="h-3 w-2/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
