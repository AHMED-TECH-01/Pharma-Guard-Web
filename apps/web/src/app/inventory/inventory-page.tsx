'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type {
  InventoryBatchListResponse,
  InventoryBatchSortKey,
  InventoryBatchStatusFilter,
} from '@pharmaguard/types';
import { api, fetchSession, type SessionData } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Pagination } from '@/components/ui/pagination';
import { InventoryToolbar } from '@/components/inventory/inventory-toolbar';
import { InventoryMobileCard, InventoryTable } from '@/components/inventory/inventory-table';
import { MedicineFormModal } from '@/components/inventory/medicine-form-modal';
import { TableSkeleton } from '@/components/inventory/inventory-skeletons';

/**
 * Inventory list (PRD §10.7, ui-registry §10 /inventory, reference
 * INVENTORY - ALL MEDICINES screen). Batch-level rows come from
 * GET /batches; search/filters/sort/page live in the URL (TRD §17) so
 * views are shareable and back/forward behaves.
 */
export function InventoryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [session, setSession] = useState<SessionData | null>(null);
  const [checked, setChecked] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);

  const [data, setData] = useState<InventoryBatchListResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Opens the add-medicine modal when arriving from the AI Scan manual-entry
  // fallback (/inventory?add=1).
  const [addOpen, setAddOpen] = useState(() => searchParams.get('add') === '1');

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

  const query = useMemo(() => {
    const status = (searchParams.get('status') ?? 'all') as InventoryBatchStatusFilter;
    const sort = (searchParams.get('sort') ?? 'expiry') as InventoryBatchSortKey;
    const order: 'asc' | 'desc' = searchParams.get('order') === 'desc' ? 'desc' : 'asc';
    const page = Number(searchParams.get('page') ?? '1') || 1;
    return {
      search: searchParams.get('q') ?? '',
      status,
      sort,
      order,
      page,
    };
  }, [searchParams]);

  const activePharmacy = session?.activePharmacy ?? null;
  const pharmacyId = activePharmacy?.pharmacyId ?? null;

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (query.search) params.set('q', query.search);
    if (query.status !== 'all') params.set('status', query.status);
    if (query.sort !== 'expiry') params.set('sort', query.sort);
    if (query.order !== 'asc') params.set('order', query.order);
    if (query.page > 1) params.set('page', String(query.page));
    return params.toString();
  }, [query]);

  const loadList = useCallback(
    (signal?: AbortSignal) => {
      if (!pharmacyId) return;
      const params = new URLSearchParams();
      if (query.search) params.set('search', query.search);
      params.set('status', query.status);
      params.set('sort', query.sort);
      params.set('order', query.order);
      params.set('page', String(query.page));
      params.set('pageSize', '20');
      api
        .get<InventoryBatchListResponse>(`/batches?${params.toString()}`, { pharmacyId, signal })
        .then((response) => {
          if (signal?.aborted) return;
          setData(response);
        })
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          setLoadError(error instanceof Error ? error.message : 'Unable to load inventory.');
        });
    },
    [pharmacyId, query.search, query.status, query.sort, query.order, query.page],
  );

  useEffect(() => {
    if (!checked || !pharmacyId) return;
    const controller = new AbortController();
    loadList(controller.signal);
    return () => controller.abort();
  }, [checked, pharmacyId, loadList]);

  const patchParams = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(queryString);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '') params.delete(key);
        else params.set(key, value);
      }
      router.replace(`/inventory${params.size > 0 ? `?${params.toString()}` : ''}`, {
        scroll: false,
      });
    },
    [queryString, router],
  );

  const handleSearchChange = useCallback(
    (search: string) => patchParams({ q: search, page: null }),
    [patchParams],
  );
  const handleStatusChange = useCallback(
    (status: InventoryBatchStatusFilter) => patchParams({ status: status === 'all' ? null : status, page: null }),
    [patchParams],
  );
  const handleSortChange = useCallback(
    (sort: InventoryBatchSortKey) => patchParams({ sort: sort === 'expiry' ? null : sort, page: null }),
    [patchParams],
  );
  const handleOrderToggle = useCallback(
    () => patchParams({ order: query.order === 'asc' ? 'desc' : null, page: null }),
    [patchParams, query.order],
  );

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
          title="No pharmacy yet"
          description="Create your pharmacy profile first - inventory is scoped to it."
          action={
            <button
              type="button"
              onClick={() => router.push('/onboarding')}
              className="inline-flex h-9 items-center rounded-md bg-primary-600 px-4 text-sm font-medium text-white transition hover:bg-primary-700"
            >
              Set up my pharmacy
            </button>
          }
        />
      );
    }
    if (loadError && !data) {
      return (
        <ErrorState
          title="Could not load inventory"
          description={loadError}
          onRetry={() => {
            setLoadError(null);
            loadList();
          }}
        />
      );
    }
    if (!data) {
      return <TableSkeleton />;
    }
    if (data.items.length === 0) {
      return (
        <EmptyState
          title={query.search || query.status !== 'all' ? 'No batches match your filters' : 'No stock yet'}
          description={
            query.search || query.status !== 'all'
              ? 'Try a different search or clear the filters.'
              : 'Add a medicine with its first batch, or let AI Scan create one from a photo.'
          }
          action={
            query.search || query.status !== 'all' ? (
              <button
                type="button"
                onClick={() => router.replace('/inventory', { scroll: false })}
                className="h-9 rounded-md border border-border bg-surface px-4 text-sm font-medium transition hover:bg-surface-muted"
              >
                Clear filters
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="inline-flex h-9 items-center rounded-md bg-primary-600 px-4 text-sm font-medium text-white transition hover:bg-primary-700"
              >
                Add Medicine
              </button>
            )
          }
        />
      );
    }

    return (
      <div className="space-y-3">
        <div className="hidden md:block">
          <InventoryTable items={data.items} />
        </div>
        <div className="md:hidden">
          <InventoryMobileCard items={data.items} />
        </div>
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          pageSize={data.pageSize}
          disabled={loadError !== null}
          onPageChange={(page) => patchParams({ page: page > 1 ? String(page) : null })}
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
        <header>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">All Medicines</h1>
          <p className="mt-0.5 text-sm text-text-muted">Manage your medicine inventory and batches.</p>
        </header>

        {checked && session && activePharmacy ? (
          <InventoryToolbar
            search={query.search}
            status={query.status}
            sort={query.sort}
            order={query.order}
            onSearchChange={handleSearchChange}
            onStatusChange={handleStatusChange}
            onSortChange={handleSortChange}
            onOrderToggle={handleOrderToggle}
            onAddMedicine={() => setAddOpen(true)}
          />
        ) : null}

        {renderContent()}
      </div>

      {activePharmacy ? (
        <MedicineFormModal
          open={addOpen}
          onClose={() => {
            setAddOpen(false);
            // Drop the AI Scan manual-entry deep link (?add=1) once used.
            if (searchParams.get('add')) {
              const params = new URLSearchParams(searchParams.toString());
              params.delete('add');
              const query = params.toString();
              router.replace(query ? `/inventory?${query}` : '/inventory');
            }
          }}
          onSaved={() => {
            setAddOpen(false);
            loadList();
          }}
        />
      ) : null}
    </AppShell>
  );
}
