'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ReturnListResponse, ReturnListItem, ReturnStatus, SupplierListItem } from '@pharmaguard/types';
import { api, fetchSession, type SessionData } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Pagination } from '@/components/ui/pagination';
import { Modal } from '@/components/ui/modal';
import { ReturnTable } from '@/components/returns/return-table';
import { ConfirmReturnDialog, type ReturnFormPayload } from '@/components/returns/return-form-dialog';

/**
 * Returns register (PRD §10.14, ui-registry §10 /returns): record returns,
 * approve (stock leaves the shelf atomically), reject, complete.
 */

const STATUS_OPTIONS: { value: 'ALL' | ReturnStatus; label: string }[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'REJECTED', label: 'Rejected' },
];

const selectClasses =
  'h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

const ACTION_TITLES = {
  approve: { title: 'Approve return', body: 'Approving removes the returned quantity from the batch immediately.', confirm: 'Approve' },
  complete: { title: 'Mark completed', body: 'Stamp the return as completed and set today as the return date.', confirm: 'Complete' },
  reject: { title: 'Reject return', body: 'The return stays recorded but no stock was removed.', confirm: 'Reject' },
} as const;

export default function ReturnsPage() {
  const router = useRouter();

  const [session, setSession] = useState<SessionData | null>(null);
  const [checked, setChecked] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);

  const [statusFilter, setStatusFilter] = useState<'ALL' | ReturnStatus>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ReturnListResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierListItem[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [createPending, setCreatePending] = useState(false);
  const [actionItem, setActionItem] = useState<{ item: ReturnListItem; action: 'approve' | 'complete' | 'reject' } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
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
  const canRead = session?.permissions.includes('returns.read') ?? false;
  const canWrite = session?.permissions.includes('returns.write') ?? false;

  const loadReturns = useCallback(
    (signal?: AbortSignal) => {
      if (!pharmacyId) return;
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (search) params.set('search', search);
      params.set('page', String(page));
      params.set('pageSize', '20');
      api
        .get<ReturnListResponse>(`/returns?${params.toString()}`, { pharmacyId, signal })
        .then((response) => {
          if (!signal?.aborted) {
            setData(response);
            setLoadError(null);
          }
        })
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          setLoadError(error instanceof Error ? error.message : 'Unable to load returns.');
        });
    },
    [pharmacyId, statusFilter, search, page],
  );

  // Debounce the reference-style search box before it hits the API.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!checked || !pharmacyId || !canRead) return;
    const controller = new AbortController();
    loadReturns(controller.signal);
    return () => controller.abort();
  }, [checked, pharmacyId, canRead, loadReturns]);

  function loadSuppliers() {
    if (!pharmacyId) return;
    api
      .get<{ suppliers: SupplierListItem[] }>('/suppliers', { pharmacyId })
      .then((response) => setSuppliers(response.suppliers))
      .catch(() => setSuppliers([]));
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

  async function handleCreate(payload: ReturnFormPayload) {
    if (!pharmacyId) return;
    setCreatePending(true);
    setActionError(null);
    try {
      await api.post('/returns', payload, { pharmacyId });
      setFormOpen(false);
      loadReturns(new AbortController().signal);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not record the return.');
    } finally {
      setCreatePending(false);
    }
  }

  async function confirmAction() {
    if (!pharmacyId || !actionItem) return;
    const { item, action } = actionItem;
    setBusyId(item.id);
    setActionError(null);
    try {
      await api.post(`/returns/${item.id}/${action}`, undefined, { pharmacyId });
      setActionItem(null);
      loadReturns(new AbortController().signal);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not update the return.');
    } finally {
      setBusyId(null);
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
          description="Create or select a pharmacy before recording returns."
        />
      );
    }
    if (!canRead) {
      return (
        <EmptyState
          title="No access to returns"
          description="Ask the pharmacy owner for the returns.read permission."
        />
      );
    }
    if (loadError) {
      return (
        <ErrorState
          title="Returns could not load"
          description={loadError}
          onRetry={() => loadReturns(new AbortController().signal)}
        />
      );
    }
    if (!data || data.returns.length === 0) {
      return (
        <EmptyState
          title={statusFilter === 'ALL' && !search ? 'No returns recorded' : 'No returns match your filters'}
          description="Returns to suppliers appear here; stock leaves at approval."
          action={
            canWrite && statusFilter === 'ALL' && !search ? (
              <button
                type="button"
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
                onClick={() => {
                  loadSuppliers();
                  setFormOpen(true);
                }}
              >
                + New Return
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
        <ReturnTable
          returns={data.returns}
          canWrite={canWrite}
          busyId={busyId}
          onAction={(item, action) => {
            setActionError(null);
            setActionItem({ item, action });
          }}
        />
        <Pagination
          page={data.page}
          totalPages={Math.max(1, Math.ceil(data.total / data.pageSize))}
          total={data.total}
          pageSize={data.pageSize}
          onPageChange={setPage}
        />
      </div>
    );
  }

  const confirmCopy = actionItem ? ACTION_TITLES[actionItem.action] : null;

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
            <h1 className="text-xl font-semibold tracking-tight text-text-primary">Returns Management</h1>
            <p className="mt-0.5 text-sm text-text-muted">Track and manage all your supplier returns.</p>
          </div>
          {canWrite ? (
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-md bg-primary-600 px-4 text-sm font-medium text-white transition hover:bg-primary-700"
              onClick={() => {
                loadSuppliers();
                setFormOpen(true);
              }}
            >
              + New Return
            </button>
          ) : null}
        </header>
        {canRead ? (
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search medicines..."
              aria-label="Search returns by medicine or batch"
              className="h-9 w-full max-w-xs rounded-md border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-faint focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as 'ALL' | ReturnStatus);
                setPage(1);
              }}
              aria-label="Filter by return status"
              className={selectClasses}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {renderContent()}
      </div>

      <ConfirmReturnDialog
        open={formOpen}
        pharmacyId={pharmacyId ?? ''}
        suppliers={suppliers}
        pending={createPending}
        onSubmit={(payload) => void handleCreate(payload)}
        onClose={() => setFormOpen(false)}
      />

      <Modal
        open={confirmCopy !== null}
        onClose={() => setActionItem(null)}
        pending={busyId !== null}
        size="sm"
        title={confirmCopy?.title ?? ''}
      >
        <div className="space-y-4">
          {actionItem ? (
            <p className="text-sm text-text-secondary">
              {actionItem.item.medicineName} - batch {actionItem.item.batchNo} -{' '}
              {actionItem.item.quantity} unit(s). {confirmCopy?.body}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-text-primary transition hover:bg-subtle disabled:opacity-60"
              onClick={() => setActionItem(null)}
              disabled={busyId !== null}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-60 ${
                actionItem?.action === 'reject' ? 'bg-status-critical-fg hover:opacity-90' : 'bg-primary-600 hover:bg-primary-700'
              }`}
              onClick={() => void confirmAction()}
              disabled={busyId !== null}
            >
              {busyId ? 'Working…' : confirmCopy?.confirm}
            </button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
