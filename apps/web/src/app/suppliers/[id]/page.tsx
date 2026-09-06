'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { SupplierDetail } from '@pharmaguard/types';
import { api, fetchSession, type SessionData } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { PurchaseTable } from '@/components/purchases/purchase-table';
import { SupplierFormDialog, type SupplierFormValues } from '@/components/suppliers/supplier-form-dialog';
import { formatRelativeTime } from '@/lib/format';

/**
 * Supplier detail (PRD §10.13, ui-registry §10 /suppliers/:id): contact,
 * medicines supplied, last order, pending returns, recent purchases.
 */

export default function SupplierDetailPage() {
  const router = useRouter();
  const params = useParams();
  const supplierId = typeof params.id === 'string' ? params.id : '';

  const [session, setSession] = useState<SessionData | null>(null);
  const [checked, setChecked] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);

  const [supplier, setSupplier] = useState<SupplierDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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
  const canRead = session?.permissions.includes('suppliers.read') ?? false;
  const canWrite = session?.permissions.includes('suppliers.write') ?? false;

  const loadSupplier = useCallback(
    (signal?: AbortSignal) => {
      if (!pharmacyId || !supplierId) return;
      api
        .get<{ supplier: SupplierDetail }>(`/suppliers/${supplierId}`, { pharmacyId, signal })
        .then((response) => {
          if (!signal?.aborted) {
            setSupplier(response.supplier);
            setLoadError(null);
          }
        })
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          setLoadError(error instanceof Error ? error.message : 'Unable to load the supplier.');
        });
    },
    [pharmacyId, supplierId],
  );

  useEffect(() => {
    if (!checked || !pharmacyId || !canRead) return;
    const controller = new AbortController();
    loadSupplier(controller.signal);
    return () => controller.abort();
  }, [checked, pharmacyId, canRead, loadSupplier]);

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

  async function handleSave(values: SupplierFormValues) {
    if (!pharmacyId || !supplier) return;
    setPending(true);
    setActionError(null);
    try {
      const response = await api.patch<{ supplier: SupplierDetail }>(
        `/suppliers/${supplier.id}`,
        {
          name: values.name,
          phone: values.phone || undefined,
          email: values.email || undefined,
          address: values.address || undefined,
        },
        { pharmacyId },
      );
      setSupplier((current) => (current ? { ...current, ...response.supplier } : current));
      setEditOpen(false);
      loadSupplier(new AbortController().signal);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not update the supplier.');
    } finally {
      setPending(false);
    }
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
          description="Create or select a pharmacy before viewing suppliers."
        />
      );
    }
    if (!canRead) {
      return (
        <EmptyState
          title="No access to suppliers"
          description="Ask the pharmacy owner for the suppliers.read permission."
        />
      );
    }
    if (loadError) {
      return (
        <ErrorState
          title="Supplier could not load"
          description={loadError}
          onRetry={() => loadSupplier(new AbortController().signal)}
        />
      );
    }
    if (!supplier) {
      return <p className="text-sm text-text-muted" aria-busy="true">Loading supplier…</p>;
    }

    return (
      <div className="space-y-5">
        {actionError ? (
          <div className="rounded-lg border border-status-critical-fg/40 bg-status-critical-bg p-3 text-sm text-status-critical-fg">
            {actionError}
          </div>
        ) : null}

        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">{supplier.name}</h2>
              <p className="mt-0.5 text-sm text-text-secondary">
                {supplier.phone ?? 'No phone'}
                {supplier.email ? ` - ${supplier.email}` : ''}
              </p>
              {supplier.address ? (
                <p className="mt-1 text-sm text-text-muted">{supplier.address}</p>
              ) : null}
              {supplier.isArchived ? (
                <span className="mt-2 inline-flex rounded-full bg-bg-subtle px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                  Archived
                </span>
              ) : null}
            </div>
            {canWrite ? (
              <button
                type="button"
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-text-primary transition hover:bg-subtle"
                onClick={() => setEditOpen(true)}
              >
                Edit supplier
              </button>
            ) : null}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-subtle pt-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-text-muted">Medicines supplied</p>
              <p className="text-lg font-semibold text-text-primary">{supplier.medicinesSupplied}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Last order</p>
              <p className="text-lg font-semibold text-text-primary">
                {supplier.lastOrderAt ? formatRelativeTime(supplier.lastOrderAt) : 'None yet'}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Pending returns</p>
              <p className={`text-lg font-semibold ${supplier.pendingReturns > 0 ? 'text-status-warning-fg' : 'text-text-primary'}`}>
                {supplier.pendingReturns}
              </p>
            </div>
          </div>

          {supplier.medicineNames.length > 0 ? (
            <div className="mt-4">
              <p className="mb-2 text-xs text-text-muted">Medicines supplied</p>
              <div className="flex flex-wrap gap-2">
                {supplier.medicineNames.map((name) => (
                  <span
                    key={name}
                    className="rounded-full bg-bg-subtle px-3 py-1 text-xs text-text-secondary"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-text-primary">Recent purchases</h2>
            <Link href="/purchases" className="text-sm text-primary-700 hover:underline">
              View all
            </Link>
          </div>
          {supplier.recentPurchases.length === 0 ? (
            <p className="rounded-xl border border-border bg-card p-4 text-sm text-text-muted">
              No purchases from this supplier yet.
            </p>
          ) : (
            <PurchaseTable purchases={supplier.recentPurchases} />
          )}
        </section>
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
        <header>
          <Link href="/suppliers" className="text-sm text-primary-700 hover:underline">
            Suppliers
          </Link>
          <span className="mx-2 text-text-faint">/</span>
          <span className="text-sm text-text-secondary">{supplier?.name ?? 'Detail'}</span>
        </header>
        {renderContent()}
      </div>
      <SupplierFormDialog
        open={editOpen}
        mode="edit"
        initial={
          supplier
            ? { name: supplier.name, phone: supplier.phone ?? '', email: supplier.email ?? '', address: supplier.address ?? '' }
            : undefined
        }
        pending={pending}
        onSubmit={(values) => void handleSave(values)}
        onClose={() => setEditOpen(false)}
      />
    </AppShell>
  );
}
