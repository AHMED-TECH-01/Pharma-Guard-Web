'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { api, fetchSession, type SessionData } from '@/lib/api';
import { AppShell } from '@/components/app-shell';

interface SettingsPageProps {
  title: string;
  description: string;
  /** Rendered once the session is verified. */
  children: (session: SessionData) => ReactNode;
}

/**
 * Shared shell for Settings sub-pages (build-plan Phase 12): session gate,
 * back link to the settings hub, and the standard AppShell chrome. Sub-page
 * bodies stay focused on their own form state.
 */
export function SettingsPage({ title, description, children }: SettingsPageProps) {
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
          <Link
            href="/settings"
            className="inline-flex items-center gap-1 text-sm text-text-muted transition hover:text-text-primary"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Settings
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-text-primary">{title}</h1>
          <p className="mt-0.5 text-sm text-text-muted">{description}</p>
        </header>
        {!checked || !session ? (
          <div className="flex min-h-56 items-center justify-center" aria-busy="true">
            <p className="text-sm text-text-muted">Loading…</p>
          </div>
        ) : (
          children(session)
        )}
      </div>
    </AppShell>
  );
}
