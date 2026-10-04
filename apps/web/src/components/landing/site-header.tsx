'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Cross, Menu, X } from 'lucide-react';

/**
 * Public marketing header shared by the landing and pricing pages. Desktop
 * keeps the established row unchanged; below `sm` the links collapse into a
 * mobile menu with 44px touch targets that closes on navigation, on Escape
 * and via the toggle button.
 */

const MOBILE_LINKS = [
  { label: 'Pricing', href: '/pricing' },
  { label: 'Sign in', href: '/login' },
];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // The menu never stays open across pages (browser back included):
  // closing during render on a pathname change is the React-recommended
  // reset pattern and avoids a cascading effect render.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setMenuOpen(false);
  }

  // Escape closes the open menu.
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary-700">
            <Cross className="size-4 text-white" aria-hidden />
          </span>
          <span className="text-lg font-semibold tracking-tight">PharmaGuard</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-2 sm:flex sm:gap-4">
          <Link
            href="/pricing"
            className="rounded-md px-3 py-2 text-sm font-medium text-text-muted transition-colors duration-150 hover:text-text"
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

        <button
          type="button"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-11 w-11 items-center justify-center rounded-md transition-colors duration-150 hover:bg-surface-muted sm:hidden"
        >
          {menuOpen ? (
            <X className="size-5" aria-hidden />
          ) : (
            <Menu className="size-5" aria-hidden />
          )}
        </button>
      </div>

      {/* Height-animated disclosure: grid-rows 0fr→1fr expands the panel to
          its natural height inside the sticky header without max-height
          guesses, and collapses fully when closed. */}
      <div
        id="mobile-menu"
        className={`grid transition-[grid-template-rows] duration-200 ease-out sm:hidden ${
          menuOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <nav aria-label="Mobile" className="mx-auto max-w-6xl space-y-1 px-4 pb-4 pt-2 sm:px-6">
            {MOBILE_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors duration-150 hover:bg-surface-muted"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/signup"
              onClick={() => setMenuOpen(false)}
              className="flex min-h-11 items-center justify-center rounded-md bg-primary-700 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary-800"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
