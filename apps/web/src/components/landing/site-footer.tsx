import Link from 'next/link';
import { Cross } from 'lucide-react';

/**
 * Public marketing footer. Feature links point to routes that ship in later
 * build-plan phases; they intentionally stay plain anchors until then.
 */

const PRODUCT_LINKS = [
  { label: 'Features', href: '/#features' },
  { label: 'AI Scan', href: '/#ai-ocr' },
  { label: 'Expiry Protection', href: '/#expiry-protection' },
  { label: 'Pricing', href: '/pricing' },
];

const COMPANY_LINKS = [
  { label: 'Sign in', href: '/login' },
  { label: 'Create account', href: '/signup' },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary-700">
              <Cross className="size-4 text-white" aria-hidden />
            </span>
            <span className="text-lg font-semibold tracking-tight">PharmaGuard</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-text-muted">
            Expiry &amp; compliance tracker for independent pharmacies. Inventory data
            turned into clear, timely actions.
          </p>
        </div>

        <nav aria-label="Product">
          <h3 className="text-sm font-semibold">Product</h3>
          <ul className="mt-3 space-y-2">
            {PRODUCT_LINKS.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="text-sm text-text-muted transition-colors duration-150 hover:text-text">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Account">
          <h3 className="text-sm font-semibold">Account</h3>
          <ul className="mt-3 space-y-2">
            {COMPANY_LINKS.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="text-sm text-text-muted transition-colors duration-150 hover:text-text">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-6 py-4 text-xs text-text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 PharmaGuard. All rights reserved.</p>
          <p>
            Compliance support tooling - not a substitute for official DRAP certification.
          </p>
        </div>
      </div>
    </footer>
  );
}
