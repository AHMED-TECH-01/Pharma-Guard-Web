'use client';

import { useRouter } from 'next/navigation';

/** Browser-back button for error pages (PRD §10.23: 404 includes "Back"). */

export function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="flex h-10 items-center justify-center rounded-md border border-border bg-surface px-6 text-sm font-medium transition-colors duration-150 hover:bg-surface-muted"
    >
      Go back
    </button>
  );
}
