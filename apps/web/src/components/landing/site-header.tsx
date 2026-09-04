import Link from 'next/link';
import { Cross } from 'lucide-react';

/** Public marketing header shared by the landing and pricing pages. */

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary-700">
            <Cross className="size-4 text-white" aria-hidden />
          </span>
          <span className="text-lg font-semibold tracking-tight">PharmaGuard</span>
        </Link>

        <nav aria-label="Primary" className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/pricing"
            className="hidden rounded-md px-3 py-2 text-sm font-medium text-text-muted transition-colors duration-150 hover:text-text sm:block"
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className="rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 hover:bg-surface-muted"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-primary-700 px-3.5 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary-800"
          >
            Get Started
          </Link>
        </nav>
      </div>
    </header>
  );
}
