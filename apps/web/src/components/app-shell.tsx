'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { UserRole } from '@pharmaguard/types';
import {
  BarChart3,
  Bell,
  CalendarClock,
  ClipboardList,
  FileCheck2,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Package,
  PackageX,
  RefreshCw,
  RotateCcw,
  ScanLine,
  Search,
  Settings,
  ShieldAlert,
  ShieldPlus,
  ShoppingCart,
  Truck,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';

/**
 * Application shell (build-plan Phase 1 + Phase 3, ui-rules §2/§3, ui-tokens §9,
 * reference DASHBOARD + LOGOUT PAGE screens): fixed sidebar (230px) with
 * active-item pill and a pinned "Need Help? Contact Support" footer; topbar
 * with hamburger, search, notification bell and user identity; content capped
 * at 1440px with 24px desktop page padding. Every nav route is a real link.
 * Log-out is triggered from the user identity and confirmed through the
 * LogoutDialog (reference LOGOUT PAGE, ui-rules §16).
 */

interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Inventory', icon: Package, href: '/inventory' },
  { label: 'AI Scan (OCR)', icon: ScanLine, href: '/ai-scan' },
  { label: 'Expiry Center', icon: CalendarClock, href: '/expiry' },
  { label: 'Sales', icon: ShoppingCart, href: '/sales' },
  { label: 'Purchases', icon: ClipboardList, href: '/purchases' },
  { label: 'Reorders', icon: RefreshCw, href: '/reorders' },
  { label: 'Suppliers', icon: Truck, href: '/suppliers' },
  { label: 'Returns', icon: RotateCcw, href: '/returns' },
  { label: 'Quarantine', icon: ShieldAlert, href: '/quarantine' },
  { label: 'Recalls', icon: PackageX, href: '/recalls' },
  { label: 'Analytics', icon: BarChart3, href: '/analytics' },
  { label: 'Alerts', icon: Bell, href: '/alerts' },
  { label: 'Compliance', icon: FileCheck2, href: '/compliance' },
  { label: 'Users', icon: Users, href: '/users' },
  { label: 'Settings', icon: Settings, href: '/settings' },
];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]![0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]![0] ?? '' : '';
  return (first + last).toUpperCase();
}

function LogoutDialog({
  open,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, pending, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-dialog-title"
        className="w-full max-w-sm rounded-lg bg-bg-card p-8 text-center shadow-lg"
      >
        <span
          aria-hidden
          className="mx-auto flex size-14 items-center justify-center rounded-full bg-status-critical-fg/10"
        >
          <LogOut className="size-7 text-status-critical-fg" />
        </span>
        <h2 id="logout-dialog-title" className="mt-4 text-lg font-semibold text-text-primary">
          Logout
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          Are you sure you want to log out from PharmaGuard?
        </p>
        <div className="mt-6 space-y-2.5">
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="h-10 w-full rounded-md bg-status-critical-fg text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? 'Logging out…' : 'Yes, Logout'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="h-10 w-full rounded-md border border-border bg-surface text-sm font-medium transition hover:bg-surface-muted disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

interface AppShellProps {
  userName: string;
  userRole: UserRole | null;
  /** Kept for callers, displayed by pages themselves (reference has no
   *  pharmacy label in the topbar). */
  pharmacyName?: string | null;
  unreadAlertsCount?: number;
  onLogout: () => void;
  logoutPending?: boolean;
  children: ReactNode;
}

export function AppShell({
  userName,
  userRole,
  unreadAlertsCount = 0,
  onLogout,
  logoutPending = false,
  children,
}: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const pathname = usePathname();

  const isItemActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const navList = (onNavigate?: () => void) => (
    <ul className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isItemActive(item.href);
        return (
          <li key={item.label}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                active
                  ? 'bg-primary-600 text-white'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="size-4" aria-hidden />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  const supportLink = (
    <a
      href="mailto:support@pharmaguard.app"
      className="flex items-center gap-2.5 px-5 py-4 text-white/70 transition hover:text-white"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10">
        <LifeBuoy className="size-4" aria-hidden />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-medium">Need Help?</span>
        <span className="text-xs text-white/60">Contact Support</span>
      </span>
    </a>
  );

  const brand = (
    <div className="flex items-center gap-2.5 px-5 py-5">
      <ShieldPlus className="size-7" aria-hidden />
      <span className="text-lg font-semibold tracking-tight">PharmaGuard</span>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-primary-600 focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>
      <aside className="hidden w-[230px] shrink-0 flex-col bg-primary-950 text-white lg:flex">
        {brand}
        <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label="Main navigation">
          {navList()}
        </nav>
        {supportLink}
      </aside>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="presentation">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileNavOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
            className="absolute inset-y-0 left-0 flex w-[260px] flex-col bg-primary-950 text-white"
          >
            <div className="flex items-center justify-between pr-4">
              {brand}
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setMobileNavOpen(false)}
                className="rounded-md p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Mobile navigation">
              {navList(() => setMobileNavOpen(false))}
            </nav>
            {supportLink}
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-border bg-surface px-4 sm:px-6">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen(true)}
            className="rounded-md border border-border p-2 transition hover:bg-surface-muted"
          >
            <Menu className="size-5" aria-hidden />
          </button>

          <div
            className="relative hidden max-w-md flex-1 sm:block"
            title="Global search arrives in a later phase"
          >
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-faint"
              aria-hidden
            />
            <input
              type="search"
              placeholder="Search medicines, batches, invoices…"
              disabled
              className="h-9 w-full rounded-md border border-border bg-surface-muted pl-9 pr-3 text-sm text-text-muted placeholder:text-text-faint"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/alerts"
              aria-label={
                unreadAlertsCount > 0
                  ? `${unreadAlertsCount} new alerts`
                  : 'No new alerts'
              }
              className="relative rounded-md p-2 transition hover:bg-surface-muted"
            >
              <Bell className="size-5" aria-hidden />
              {unreadAlertsCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-critical-fg px-1 text-[10px] font-semibold text-white">
                  {unreadAlertsCount > 9 ? '9+' : unreadAlertsCount}
                </span>
              ) : null}
            </Link>

            <button
              type="button"
              onClick={() => setLogoutOpen(true)}
              aria-haspopup="dialog"
              title="Log out"
              className="flex items-center gap-2.5 rounded-md p-1 pr-2 transition hover:bg-surface-muted"
            >
              <span className="hidden min-w-0 flex-col items-end sm:flex">
                <span className="max-w-32 truncate text-sm font-medium">{userName}</span>
                <span className="text-xs text-text-muted">{userRole ?? 'NO ROLE'}</span>
              </span>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-800">
                {initialsOf(userName)}
              </span>
            </button>
          </div>
        </header>

        <main id="main-content" className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1440px] p-4 sm:p-6">{children}</div>
        </main>
      </div>

      <LogoutDialog
        open={logoutOpen}
        pending={logoutPending}
        onCancel={() => setLogoutOpen(false)}
        onConfirm={() => {
          setLogoutOpen(false);
          onLogout();
        }}
      />
    </div>
  );
}
