import Link from 'next/link';
import { BrandMark } from '@/components/brand-mark';
import { BackButton } from '@/components/back-button';

/**
 * 404 - Page Not Found (PRD §10.23, reference ERROR PAGES composition):
 * clear message, Go Home, Back.
 */
export default function NotFoundPage() {
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
          <p className="text-7xl font-semibold tracking-tight text-primary-900">404</p>
          <h1 className="mt-4 text-xl font-semibold">Oops! Page not found</h1>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              href="/"
              className="flex h-10 items-center justify-center rounded-md bg-primary-700 px-6 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary-800"
            >
              Go Back Home
            </Link>
            <BackButton />
          </div>
        </div>
      </main>
    </div>
  );
}
