import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandMark } from '@/components/brand-mark';

/**
 * Shared shell for the public legal pages (/terms, /privacy): a minimal top
 * bar with the brand mark, a readable single-column article, and a footer
 * that cross-links both documents. Static server components - reachable
 * while signed in or signed out (no session guard by design).
 */

export const LEGAL_UPDATED_TERMS = 'September 26, 2026';
export const LEGAL_UPDATED_PRIVACY = 'September 26, 2026';

export const LEGAL_H2_CLASS =
  'mt-10 text-lg font-semibold tracking-tight text-text first:mt-0';
export const LEGAL_P_CLASS = 'mt-3 text-sm leading-relaxed text-text-muted';
export const LEGAL_UL_CLASS = 'mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-text-muted';

interface LegalPageProps {
  title: string;
  updated: string;
  intro: ReactNode;
  children: ReactNode;
}

export function LegalPage({ title, updated, intro, children }: LegalPageProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/login" className="flex items-center gap-2.5" aria-label="PharmaGuard sign in">
            <BrandMark variant="solid" className="size-7" />
            <span className="text-lg font-semibold tracking-tight">PharmaGuard</span>
          </Link>
          <Link
            href="/login"
            className="rounded-md px-3 py-2 text-sm font-medium text-primary-700 transition-colors duration-150 hover:text-primary-800"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-10 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-text-muted">Last updated: {updated}</p>
        <p className={LEGAL_P_CLASS}>{intro}</p>
        <div className="mt-10">{children}</div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 py-6 text-xs text-text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>&copy; 2026 PharmaGuard. All rights reserved.</span>
          <span className="flex items-center gap-3">
            <Link href="/terms" className="transition-colors duration-150 hover:text-text">
              Terms &amp; Conditions
            </Link>
            <span aria-hidden>&middot;</span>
            <Link href="/privacy" className="transition-colors duration-150 hover:text-text">
              Privacy Policy
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
