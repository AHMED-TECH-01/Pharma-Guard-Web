'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { SaleListItem, SaleListResponse } from '@pharmaguard/types';
import { api, fetchSession, type SessionData } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Pagination } from '@/components/ui/pagination';
import { ConfirmSaleDialog } from '@/components/sales/confirm-sale-dialog';
import { SalesTabs } from '@/components/sales/sales-tabs';
import { SalesTable } from '@/components/sales/sales-table';

/**
 * Sales history (PRD §10.10, ui-registry §10 /sales). Page position is
 * URL-driven (TRD §17); reversal reuses ConfirmSaleDialog in `reverse`
 * mode and is only offered to holders of sales.reverse (OWNER/MANAGER).
 */

export function SalesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [session, setSession] = useState<SessionData | null>(null);
  const [checked, setChecked] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);

  const [data, setData] = useState<SaleListResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reversePending, setReversePending] = useState(false);

  const [reverseTarget, setReverseTarget] = useState<SaleListItem | null>(null);

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
  const canRead = session?.permissions.includes('sales.read') ?? false;
  const canCreate = session?.permissions.includes('sales.create') ?? false;
  const canReverse = session?.permissions.includes('sales.reverse') ?? false;

  const loadSales = useCallback(
    (targetPage: number, signal?: AbortSignal) => {
      if (!pharmacyId) return;
      const params = new URLSearchParams();
      params.set('page', String(targetPage));
      params.set('pageSize', '20');
      api
        .get<SaleListResponse>(`/sales?${params.toString()}`, { pharmacyId, signal })
        .then((response) => {
          if (!signal?.aborted) {
            setData(response);
            setLoadError(null);
          }
        })
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          setLoadError(error instanceof Error ? error.message : 'Unable to load sales.');
        });
    },
    [pharmacyId],
  );

  useEffect(() => {
    if (!checked || !pharmacyId || !canRead) return;
    const controller = new AbortController();
    loadSales(page, controller.signal);
    return () => controller.abort();
  }, [checked, pharmacyId, canRead, page, loadSales]);

  function patchPage(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage <= 1) params.delete('page');
    else params.set('page', String(nextPage));
    router.replace(params.size > 0 ? `/sales?${params.toString()}` : '/sales');
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

  async function confirmReverse() {
    if (!pharmacyId || !reverseTarget) return;
    setReversePending(true);
    try {
      await api.post(`/sales/${reverseTarget.id}/reverse`, undefined, { pharmacyId });
      setReverseTarget(null);
      loadSales(page, new AbortController().signal);
    } catch (cause) {
      setReverseTarget(null);
      setActionError(cause instanceof Error ? cause.message : 'Could not reverse the sale.');
    } finally {
      setReversePending(false);
    }
  }

  const reverseSummary = reverseTarget
    ? [
        {
          label: 'Medicine',
          value: `${reverseTarget.medicineName}${reverseTarget.medicineStrength ? ` ${reverseTarget.medicineStrength}` : ''}`,
        },
        { label: 'Batch', value: reverseTarget.batchNo },
        { label: 'Quantity', value: String(reverseTarget.quantity) },
        { label: 'Total', value: `PKR ${reverseTarget.totalAmount.toLocaleString('en-PK')}` },
      ]
    : [];

  function renderContent() {
    if (!checked || !session) {
      return (
        <div className="flex min-h-dvh" aria-busy="true" aria-label="Loading session">
          <div className="hidden w-[230px] shrink-0 bg-primary-950 lg:block" />
          <div className="flex-1" />
        </div>
      );
    }
    if (!activePharmacy) {
      return (
        <EmptyState
          title="No pharmacy selected"
          description="Create or select a pharmacy before viewing sales."
        />
      );
    }
    if (!canRead) {
      return (
        <EmptyState
          title="No access to sales history"
          description="Recording sales is allowed for your role, but viewing history needs the sales.read permission."
          action={
            canCreate ? (
              <Link
                href="/sales/new"
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
              >
                Record a sale
              </Link>
            ) : null
          }
        />
      );
    }
    if (loadError) {
      return (
        <ErrorState
          title="Sales could not load"
          description={loadError}
          onRetry={() => loadSales(page, new AbortController().signal)}
        />
      );
    }
    if (!data || data.sales.length === 0) {
      return (
        <EmptyState
          title="No sales recorded yet"
          description="Recorded sales appear here with stock movements and reversals."
          action={
            canCreate ? (
              <Link
                href="/sales/new"
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
              >
                Record a sale
              </Link>
            ) : null
          }
        />
      );
    }
    return (
      <div className="space-y-4">
        {actionError ? (
          <div className="rounded-lg border border-status-critical-fg/40 bg-status-critical-bg p-3 text-sm text-status-critical-fg">
            {actionError}
          </div>
        ) : null}
        <SalesTable sales={data.sales} canReverse={canReverse} busyId={reversePending ? reverseTarget?.id ?? null : null} onReverse={setReverseTarget} />
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
        {/* Reference composition: pill tabs, no page title above them. */}
        <SalesTabs active="history" />
        {renderContent()}
      </div>
      <ConfirmSaleDialog
        open={reverseTarget !== null}
        mode="reverse"
        pending={reversePending}
        summary={reverseSummary}
        onConfirm={() => void confirmReverse()}
        onClose={() => setReverseTarget(null)}
      />
    </AppShell>
  );
}
