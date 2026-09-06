'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, Pencil } from 'lucide-react';
import type { SupplierListResponse, SupplierListItem } from '@pharmaguard/types';
import { api, fetchSession, type SessionData } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { AppShell } from '@/components/app-shell';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { SupplierFormDialog, type SupplierFormValues } from '@/components/suppliers/supplier-form-dialog';

/**
 * Supplier register (PRD §10.13, ui-registry §10 /suppliers, reference
 * SUPPLIERS MANAGEMENT screen): table with Supplier, Contact, Supplied
 * Medicines, Last Order, Pending Returns and edit/view actions.
 */

export default function SuppliersPage() {
  const router = useRouter();

  const [session, setSession] = useState<SessionData | null>(null);
  const [checked, setChecked] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);

  const [data, setData] = useState<SupplierListResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierListItem | null>(null);
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

  const loadSuppliers = useCallback(
    (signal?: AbortSignal) => {
      if (!pharmacyId) return;
      api
        .get<SupplierListResponse>('/suppliers?archived=true', { pharmacyId, signal })
        .then((response) => {
          if (!signal?.aborted) {
            setData(response);
            setLoadError(null);
          }
        })
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          setLoadError(error instanceof Error ? error.message : 'Unable to load suppliers.');
        });
    },
    [pharmacyId],
  );

  useEffect(() => {
    if (!checked || !pharmacyId || !canRead) return;
    const controller = new AbortController();
    loadSuppliers(controller.signal);
    return () => controller.abort();
  }, [checked, pharmacyId, canRead, loadSuppliers]);

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

  async function handleSubmit(values: SupplierFormValues) {
    if (!pharmacyId) return;
    setPending(true);
    setActionError(null);
    try {
      if (editing) {
        await api.patch(
          `/suppliers/${editing.id}`,
          {
            name: values.name,
            phone: values.phone || null,
            email: values.email || null,
            address: values.address || null,
          },
          { pharmacyId },
        );
      } else {
        await api.post(
          '/suppliers',
          {
            name: values.name,
            phone: values.phone || undefined,
            email: values.email || undefined,
            address: values.address || undefined,
          },
          { pharmacyId },
        );
      }
      setFormOpen(false);
      setEditing(null);
      loadSuppliers(new AbortController().signal);
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : editing
            ? 'Could not update the supplier.'
            : 'Could not create the supplier.',
      );
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
          description="Create or select a pharmacy before managing suppliers."
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
          title="Suppliers could not load"
          description={loadError}
          onRetry={() => loadSuppliers(new AbortController().signal)}
        />
      );
    }
    if (!data || data.suppliers.length === 0) {
      return (
        <EmptyState
          title="No suppliers yet"
          description="Add the distributors you buy from to link them to purchase records."
          action={
            canWrite ? (
              <button
                type="button"
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
                onClick={() => setFormOpen(true)}
              >
                Add supplier
              </button>
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
        {/* Reference composition: dense supplier table. */}
        <div className="overflow-x-auto rounded-lg border border-border-subtle bg-bg-card">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-xs uppercase tracking-wide text-text-muted">
                <th scope="col" className="px-4 py-3 font-medium">Supplier</th>
                <th scope="col" className="px-4 py-3 font-medium">Contact</th>
                <th scope="col" className="px-4 py-3 font-medium">Supplied Medicines</th>
                <th scope="col" className="px-4 py-3 font-medium">Last Order</th>
                <th scope="col" className="px-4 py-3 font-medium">Pending Returns</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {data.suppliers.map((supplier) => (
                <tr key={supplier.id} className="transition-colors hover:bg-surface-muted">
                  <td className="px-4 py-3">
                    <Link
                      href={`/suppliers/${supplier.id}`}
                      className="font-medium text-text-primary hover:text-primary-700"
                    >
                      {supplier.name}
                    </Link>
                    {supplier.address ? (
                      <p className="mt-0.5 max-w-56 truncate text-xs text-text-muted">{supplier.address}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {supplier.phone ?? '—'}
                    {supplier.email ? (
                      <p className="mt-0.5 max-w-48 truncate text-xs">{supplier.email}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-text-primary">{supplier.medicinesSupplied}</td>
                  <td className="px-4 py-3 text-text-primary">
                    {supplier.lastOrderAt ? formatDate(supplier.lastOrderAt) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        supplier.pendingReturns > 0
                          ? 'bg-status-warning-bg text-status-warning-fg'
                          : 'bg-bg-subtle text-text-muted'
                      }`}
                    >
                      {supplier.pendingReturns}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {canWrite ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(supplier);
                            setFormOpen(true);
                          }}
                          className="rounded-md p-1.5 text-text-muted transition hover:bg-surface-muted hover:text-text-primary"
                          aria-label={`Edit ${supplier.name}`}
                        >
                          <Pencil className="size-4" aria-hidden />
                        </button>
                      ) : null}
                      <Link
                        href={`/suppliers/${supplier.id}`}
                        className="rounded-md p-1.5 text-text-muted transition hover:bg-surface-muted hover:text-text-primary"
                        aria-label={`View ${supplier.name}`}
                      >
                        <Eye className="size-4" aria-hidden />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
            <h1 className="text-xl font-semibold tracking-tight text-text-primary">Suppliers</h1>
            <p className="mt-0.5 text-sm text-text-muted">Manage your suppliers and distributors.</p>
          </div>
          {canWrite ? (
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary-600 px-4 text-sm font-medium text-white transition hover:bg-primary-700"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              + Add Supplier
            </button>
          ) : null}
        </header>
        {renderContent()}
      </div>
      <SupplierFormDialog
        open={formOpen}
        mode={editing ? 'edit' : 'create'}
        initial={
          editing
            ? { name: editing.name, phone: editing.phone ?? '', email: editing.email ?? '', address: editing.address ?? '' }
            : undefined
        }
        pending={pending}
        onSubmit={(values) => void handleSubmit(values)}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />
    </AppShell>
  );
}
