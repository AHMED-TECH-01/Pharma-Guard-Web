'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { BrandMark } from '@/components/brand-mark';

/**
 * 500 - Something Went Wrong (PRD §10.23, reference ERROR PAGES
 * composition): clear message, Try Again, Go Home. Raw errors are never
 * rendered (ui-rules §13); they are only logged to the console.
 */

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('unhandled_route_error', error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark variant="outline" className="size-8 text-primary-800" />
            <span className="text-lg font-semibold tracking-tight">PharmaGuard</span>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-md text-center">
          <p className="text-7xl font-semibold tracking-tight text-status-critical-fg">500</p>
          <h1 className="mt-4 text-xl font-semibold">Something went wrong!</h1>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            We&apos;re having trouble processing your request. Please try again later.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="flex h-10 items-center justify-center rounded-md bg-status-critical-fg px-6 text-sm font-medium text-white transition-colors duration-150 hover:opacity-90"
            >
              Try Again
            </button>
            <Link
              href="/"
              className="flex h-10 items-center justify-center rounded-md border border-border bg-surface px-6 text-sm font-medium transition-colors duration-150 hover:bg-surface-muted"
            >
              Go Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
