'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { PurchaseListResponse } from '@pharmaguard/types';
import { api, fetchSession, type SessionData } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Pagination } from '@/components/ui/pagination';
import { PurchaseTable } from '@/components/purchases/purchase-table';

/**
 * Purchase history (PRD §10.11, ui-registry §10 /purchases). Page position
 * is URL-driven (TRD §17); receiving form is linked for purchases.write.
 */

export function PurchasesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [session, setSession] = useState<SessionData | null>(null);
  const [checked, setChecked] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);

  const [data, setData] = useState<PurchaseListResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);

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
  const canRead = session?.permissions.includes('purchases.read') ?? false;
  const canWrite = session?.permissions.includes('purchases.write') ?? false;

  const loadPurchases = useCallback(
    (targetPage: number, signal?: AbortSignal) => {
      if (!pharmacyId) return;
      api
        .get<PurchaseListResponse>(`/purchases?page=${targetPage}&pageSize=20`, { pharmacyId, signal })
        .then((response) => {
          if (!signal?.aborted) {
            setData(response);
            setLoadError(null);
          }
        })
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          setLoadError(error instanceof Error ? error.message : 'Unable to load purchases.');
        });
    },
    [pharmacyId],
  );

  useEffect(() => {
    if (!checked || !pharmacyId || !canRead) return;
    const controller = new AbortController();
    loadPurchases(page, controller.signal);
    return () => controller.abort();
  }, [checked, pharmacyId, canRead, page, loadPurchases]);

  function patchPage(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage <= 1) params.delete('page');
    else params.set('page', String(nextPage));
    router.replace(params.size > 0 ? `/purchases?${params.toString()}` : '/purchases');
  }

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
    if (!activePharmacy) {
      return (
        <EmptyState
          title="No pharmacy selected"
          description="Create or select a pharmacy before viewing purchases."
        />
      );
    }
    if (!canRead) {
      return (
        <EmptyState
          title="No access to purchase history"
          description="Ask the pharmacy owner for the purchases.read permission."
        />
      );
    }
    if (loadError) {
      return (
        <ErrorState
          title="Purchases could not load"
          description={loadError}
          onRetry={() => loadPurchases(page, new AbortController().signal)}
        />
      );
    }
    if (!data || data.purchases.length === 0) {
      return (
        <EmptyState
          title="No purchases recorded"
          description="Receive stock to build the purchase history."
          action={
            canWrite ? (
              <Link
                href="/purchases/new"
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
              >
                Receive stock
              </Link>
            ) : null
          }
        />
      );
    }
    return (
      <div className="space-y-4">
        <PurchaseTable purchases={data.purchases} />
        <Pagination
          page={data.page}
          totalPages={Math.max(1, Math.ceil(data.total / data.pageSize))}
          total={data.total}
          pageSize={data.pageSize}
          onPageChange={patchPage}
        />
      </div>
    );
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
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-text-primary">Purchases</h1>
            <p className="mt-0.5 text-sm text-text-muted">
              {canRead && data ? `${data.total} purchase${data.total === 1 ? '' : 's'} received` : 'Receiving history and stock increments'}
            </p>
          </div>
          {canWrite ? (
            <Link
              href="/purchases/new"
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
            >
              Receive stock
            </Link>
          ) : null}
        </header>
        {renderContent()}
      </div>
    </AppShell>
  );
}
