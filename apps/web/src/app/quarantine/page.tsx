'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  QuarantineListResponse,
  QuarantineListItem,
  QuarantineResolution,
  QuarantineItemStatus,
} from '@pharmaguard/types';
import { api, fetchSession, type SessionData } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Pagination } from '@/components/ui/pagination';
import { QuarantineTable } from '@/components/safety/quarantine-table';
import { QuarantineDialog } from '@/components/safety/quarantine-dialog';

/**
 * Quarantine register (PRD §10.15, ui-registry §10 /quarantine). Batches
 * pulled out of circulation - via the Expiry Center, recall actions, or
 * manual quarantine - wait here for a release/return/remove decision.
 */

type QuarantineStatusFilter = 'ALL' | QuarantineItemStatus;

const STATUS_OPTIONS: { value: QuarantineStatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'QUARANTINED', label: 'Quarantined' },
  { value: 'RELEASED', label: 'Released' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'REMOVED', label: 'Removed' },
];

const selectClasses =
  'h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

export default function QuarantinePage() {
  const router = useRouter();

  const [session, setSession] = useState<SessionData | null>(null);
  const [checked, setChecked] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);

  const [statusFilter, setStatusFilter] = useState<QuarantineStatusFilter>('ALL');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<QuarantineListResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [resolvingItem, setResolvingItem] = useState<QuarantineListItem | null>(null);

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

  const loadList = useCallback(
    (signal?: AbortSignal) => {
      if (!pharmacyId) return;
      const params = new URLSearchParams();
      params.set('status', statusFilter);
      params.set('page', String(page));
      params.set('pageSize', '20');
      api
        .get<QuarantineListResponse>(`/quarantine?${params.toString()}`, { pharmacyId, signal })
        .then((response) => {
          if (!signal?.aborted) setData(response);
        })
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          setLoadError(error instanceof Error ? error.message : 'Unable to load quarantine items.');
        });
    },
    [pharmacyId, statusFilter, page],
  );

  useEffect(() => {
    if (!checked || !pharmacyId) return;
    const controller = new AbortController();
    loadList(controller.signal);
    return () => controller.abort();
  }, [checked, pharmacyId, loadList]);

  async function handleResolve(resolution: QuarantineResolution, reason: string) {
    if (!pharmacyId || !resolvingItem) return;
    await api.post(
      `/quarantine/${resolvingItem.id}/resolve`,
      reason ? { resolution, reason } : { resolution },
      { pharmacyId },
    );
    setResolvingItem(null);
    loadList();
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

  const quarantinedCount = data
    ? data.items.filter((item) => item.status === 'QUARANTINED').length
    : 0;

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
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">Quarantine</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            {data
              ? `${data.total} item${data.total === 1 ? '' : 's'} in the register`
              : 'Loading…'}
          </p>
        </header>

        {checked && session && activePharmacy ? (
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as QuarantineStatusFilter);
              setPage(1);
            }}
            aria-label="Filter by quarantine status"
            className={selectClasses}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : null}

        {!checked || !session ? (
          <div
            aria-busy="true"
            aria-label="Loading session"
            className="h-64 animate-pulse rounded-lg bg-border-subtle"
          />
        ) : !activePharmacy ? (
          <EmptyState
            title="No pharmacy yet"
            description="Create your pharmacy profile first - quarantine is scoped to it."
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
        ) : loadError && !data ? (
          <ErrorState
            title="Could not load quarantine"
            description={loadError}
            onRetry={() => {
              setLoadError(null);
              loadList();
            }}
          />
        ) : !data ? (
          <div aria-busy="true" aria-label="Loading quarantine items" className="h-64 animate-pulse rounded-lg bg-border-subtle" />
        ) : data.items.length === 0 ? (
          <EmptyState
            title={statusFilter === 'ALL' ? 'Quarantine is empty' : 'No items match this filter'}
            description={
              statusFilter === 'ALL'
                ? 'Batches quarantined from the Expiry Center or a recall will appear here.'
                : 'Try a different status.'
            }
          />
        ) : (
          <div className="space-y-3">
            <QuarantineTable
              items={data.items}
              onResolve={(item) => setResolvingItem(item)}
            />
            <p className="text-xs text-text-muted">
              {quarantinedCount} batch{quarantinedCount === 1 ? '' : 'es'} awaiting a decision on this page
            </p>
            <Pagination
              page={data.page}
              totalPages={Math.max(1, Math.ceil(data.total / data.pageSize))}
              total={data.total}
              pageSize={data.pageSize}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <QuarantineDialog
        item={resolvingItem}
        onClose={() => setResolvingItem(null)}
        onConfirm={handleResolve}
      />
    </AppShell>
  );
}
