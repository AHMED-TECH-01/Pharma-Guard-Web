'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BellRing, Building2, ChevronRight, Palette, ShieldCheck, User } from 'lucide-react';
import { api, fetchSession, type SessionData } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { EmptyState } from '@/components/ui/states';

/**
 * Settings hub (PRD §10.21): cards for profile, pharmacy information,
 * notifications, security and appearance. Appearance is device-local; the
 * rest are per-account or owner-managed.
 */

const SECTIONS = [
  {
    href: '/settings/profile',
    icon: User,
    title: 'Profile',
    description: 'Your name, phone and contact details',
  },
  {
    href: '/settings/pharmacy',
    icon: Building2,
    title: 'Pharmacy information',
    description: 'Name, address and contact info shown across the app',
  },
  {
    href: '/settings/notifications',
    icon: BellRing,
    title: 'Notifications',
    description: 'Choose which alert emails you receive',
  },
  {
    href: '/settings/security',
    icon: ShieldCheck,
    title: 'Security',
    description: 'Change your password',
  },
  {
    href: '/settings/appearance',
    icon: Palette,
    title: 'Appearance',
    description: 'Display preferences saved on this device',
  },
] as const;

export default function SettingsHubPage() {
  const router = useRouter();

  const [session, setSession] = useState<SessionData | null>(null);
  const [checked, setChecked] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchSession(controller.signal).then((sessionData) => {
      if (controller.signal.aborted) return;
      if (!sessionData) {
        router.replace('/login');
        return;
      }
      setSession(sessionData);
      setChecked(true);
    });
    return () => controller.abort();
  }, [router]);

  async function handleLogout() {
    setLogoutPending(true);
    try {
      await api.post('/auth/logout');
    } catch {
      // Redirect still ends the visible session.
    }
    router.replace('/login');
    router.refresh();
  }

  const activePharmacy = session?.activePharmacy ?? null;

  return (
    <AppShell
      userName={session?.user.fullName ?? ''}
      userRole={activePharmacy?.role ?? null}
      pharmacyName={activePharmacy?.pharmacyName ?? null}
      onLogout={handleLogout}
      logoutPending={logoutPending}
    >
      <div className="space-y-5">
        <header>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">Settings</h1>
          <p className="mt-0.5 text-sm text-text-muted">Account, workspace and display preferences</p>
        </header>
        {!checked || !session ? (
          <div className="flex min-h-56 items-center justify-center" aria-busy="true">
            <p className="text-sm text-text-muted">Loading…</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const needsPharmacy = section.href === '/settings/pharmacy';
              return (
                <Link
                  key={section.href}
                  href={section.href}
                  className="group flex items-start gap-3 rounded-lg border border-border bg-bg-card p-4 transition hover:border-primary-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-700">
                    <Icon className="size-4.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-text-primary">{section.title}</span>
                    <span className="mt-0.5 block text-xs text-text-muted">
                      {needsPharmacy && !activePharmacy
                        ? 'Available after pharmacy onboarding'
                        : section.description}
                    </span>
                  </span>
                  <ChevronRight
                    className="size-4 shrink-0 text-text-faint transition group-hover:text-text-secondary"
                    aria-hidden
                  />
                </Link>
              );
            })}
          </div>
        )}
        {checked && session && !activePharmacy ? (
          <EmptyState
            title="No pharmacy selected"
            description="Pharmacy information becomes available once you complete onboarding."
          />
        ) : null}
      </div>
    </AppShell>
  );
}
