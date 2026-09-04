/**
 * DashboardSkeleton (ui-registry §4, ui-rules §2).
 * Mirrors the dashboard layout: KPI row, chart row, list row.
 */

function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-border-subtle ${className}`} aria-hidden="true" />;
}

function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-lg border border-border-subtle bg-bg-card p-5 ${className}`}>
      <div className="flex items-center justify-between">
        <SkeletonLine className="h-4 w-28" />
        <SkeletonLine className="h-8 w-8 rounded-md" />
      </div>
      <SkeletonLine className="mt-3 h-7 w-32" />
      <SkeletonLine className="mt-2 h-3 w-24" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <div className="space-y-1">
        <SkeletonLine className="h-6 w-56" />
        <SkeletonLine className="h-4 w-40" />
      </div>
      <section aria-label="Key metrics" className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </section>
      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border-subtle bg-bg-card p-5">
          <SkeletonLine className="h-4 w-32" />
          <SkeletonLine className="mt-4 h-56 w-full" />
        </div>
        <div className="rounded-lg border border-border-subtle bg-bg-card p-5">
          <SkeletonLine className="h-4 w-32" />
          <SkeletonLine className="mx-auto mt-4 h-44 w-44 rounded-full" />
        </div>
        <div className="rounded-lg border border-border-subtle bg-bg-card p-5">
          <SkeletonLine className="h-4 w-32" />
          <div className="mt-4 space-y-4">
            {Array.from({ length: 4 }).map((_, row) => (
              <SkeletonLine key={row} className="h-4 w-full" />
            ))}
          </div>
        </div>
      </section>
      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-border-subtle bg-bg-card p-5">
            <SkeletonLine className="h-4 w-28" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, row) => (
                <SkeletonLine key={row} className="h-10 w-full" />
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
