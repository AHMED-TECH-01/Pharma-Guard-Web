'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, fetchSession, type SessionData } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { EmptyState } from '@/components/ui/states';
import { NewSaleForm } from '@/components/sales/new-sale-form';
import { SalesTabs } from '@/components/sales/sales-tabs';

/**
 * New sale (PRD §10.10, ui-registry §10 /sales/new). Available to every
 * authenticated member; the history view is separate.
 */

export default function NewSalePage() {
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
        <div
          aria-busy="true"
          aria-label="Loading session"
          className="h-64 animate-pulse rounded-lg bg-border-subtle"
        />
      );
    }
    if (!activePharmacy || !pharmacyId) {
      return (
        <EmptyState
          title="No pharmacy selected"
          description="Create or select a pharmacy before recording sales."
        />
      );
    }
    return <NewSaleForm pharmacyId={pharmacyId} />;
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
        {/* Reference composition: pill tabs, no page title above them. */}
        <SalesTabs active="new" />
        {renderContent()}
      </div>
    </AppShell>
  );
}
