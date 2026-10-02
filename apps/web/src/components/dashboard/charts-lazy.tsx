'use client';

import dynamic from 'next/dynamic';

/**
 * Lazy chart loading (subscriptions spec §16 - slow page load fix). Recharts
 * is by far the heaviest dependency, so the dashboard and analytics pages
 * load it as a separate async chunk after first paint instead of blocking
 * hydration with it. Each chart shows a skeleton placeholder while its chunk
 * streams in.
 */

function ChartSkeleton() {
  return <div aria-busy="true" className="h-64 animate-pulse rounded-lg bg-border-subtle" />;
}

export const ExpiryOverview = dynamic(
  () => import('@/components/dashboard/charts').then((mod) => mod.ExpiryOverview),
  { ssr: false, loading: ChartSkeleton },
);

export const SalesOverview = dynamic(
  () => import('@/components/dashboard/charts').then((mod) => mod.SalesOverview),
  { ssr: false, loading: ChartSkeleton },
);
