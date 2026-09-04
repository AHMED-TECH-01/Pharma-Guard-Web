'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, fetchSession, type SessionData } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { EmptyState } from '@/components/ui/states';
import { NewSaleForm } from '@/components/sales/new-sale-form';
import { SalesTabs } from '@/components/sales/sales-tabs';

/**
 * New sale (PRD §10.10, ui-registry §10 /sales/new). Gated by sales.create
 * (OWNER/MANAGER/PHARMACIST/STAFF); the history view is separate.
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
  const canCreate = session?.permissions.includes('sales.create') ?? false;

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
          description="Create or select a pharmacy before recording sales."
        />
      );
    }
    if (!canCreate) {
      return (
        <EmptyState
          title="No access to record sales"
          description="Ask the pharmacy owner for the sales.create permission."
          action={
            <Link
              href="/sales"
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-text-primary transition hover:bg-subtle"
            >
              Back to sales
            </Link>
          }
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
