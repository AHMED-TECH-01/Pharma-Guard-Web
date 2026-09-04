import Link from 'next/link';

/**
 * SalesTabs (ui-registry §10, reference SALES MANAGEMENT screen): pill tabs
 * "New Sale" / "Sales History" - the active tab is the solid green pill.
 */
const TABS = [
  { label: 'New Sale', href: '/sales/new' },
  { label: 'Sales History', href: '/sales' },
] as const;

export function SalesTabs({ active }: { active: 'new' | 'history' }) {
  return (
    <nav aria-label="Sales sections" className="flex flex-wrap items-center gap-2">
      {TABS.map((tab) => {
        const isActive = tab.href === '/sales' ? active === 'history' : active === 'new';
        return (
          <Link
            key={tab.label}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className={`inline-flex h-9 items-center rounded-md px-4 text-sm font-medium transition-colors duration-150 ${
              isActive
                ? 'bg-primary-600 text-white'
                : 'border border-border bg-surface text-text-primary hover:bg-surface-muted'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
