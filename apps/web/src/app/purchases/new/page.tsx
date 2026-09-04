'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, fetchSession, type SessionData } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { EmptyState } from '@/components/ui/states';
import { NewPurchaseForm } from '@/components/purchases/new-purchase-form';

/**
 * Receive stock (PRD §10.11, ui-registry §10 /purchases/new). Gated by
 * purchases.write (OWNER/MANAGER).
 */

export default function NewPurchasePage() {
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

  const activePharmacy = session?.activePharmacy ?? null;
  const pharmacyId = activePharmacy?.pharmacyId ?? null;
  const canWrite = session?.permissions.includes('purchases.write') ?? false;

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

  function renderContent() {
    if (!checked || !session) {
      return (
        <div className="flex min-h-dvh" aria-busy="true" aria-label="Loading session">
          <div className="hidden w-[230px] shrink-0 bg-primary-950 lg:block" />
          <div className="flex-1" />
        </div>
      );
    }
    if (!activePharmacy || !pharmacyId) {
      return (
        <EmptyState
          title="No pharmacy selected"
          description="Create or select a pharmacy before receiving stock."
        />
      );
    }
    if (!canWrite) {
      return (
        <EmptyState
          title="No access to receive stock"
          description="Ask the pharmacy owner for the purchases.write permission."
          action={
            <Link
              href="/purchases"
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-text-primary transition hover:bg-subtle"
            >
              Back to purchases
            </Link>
          }
        />
      );
    }
    return <NewPurchaseForm pharmacyId={pharmacyId} />;
  }

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
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">Receive stock</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            Add to an existing batch or create a new one; the whole receive is atomic.
          </p>
        </header>
        {renderContent()}
      </div>
    </AppShell>
  );
}
