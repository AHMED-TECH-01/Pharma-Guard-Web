'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  RecallDetail,
  RecallListResponse,
  RecallStatus,
} from '@pharmaguard/types';
import { api, fetchSession, type SessionData } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Pagination } from '@/components/ui/pagination';
import { RecallCard } from '@/components/safety/recall-card';
import { RecallDialog } from '@/components/safety/recall-dialog';
import { RecallFormModal } from '@/components/safety/recall-form-modal';

/**
 * Recall Center (PRD §10.16, ui-registry §10 /recalls). Register recalls,
 * track their lifecycle, inspect affected stock, and quarantine it. Every
 * authenticated member can read and act; the API authorizes and audits.
 */

type RecallStatusFilter = 'ALL' | RecallStatus;

const STATUS_OPTIONS: { value: RecallStatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const selectClasses =
  'h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

export default function RecallsPage() {
  const router = useRouter();

  const [session, setSession] = useState<SessionData | null>(null);
  const [checked, setChecked] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);

  const [statusFilter, setStatusFilter] = useState<RecallStatusFilter>('ALL');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<RecallListResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<RecallDetail | null>(null);

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
        .get<RecallListResponse>(`/recalls?${params.toString()}`, { pharmacyId, signal })
        .then((response) => {
          if (!signal?.aborted) setData(response);
        })
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          setLoadError(error instanceof Error ? error.message : 'Unable to load recalls.');
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

  async function openDetail(id: string) {
    if (!pharmacyId) return;
    const response = await api.get<{ recall: RecallDetail }>(`/recalls/${id}`, { pharmacyId });
    setDetail(response.recall);
  }

  async function updateStatus(id: string, status: RecallStatus) {
    if (!pharmacyId) return;
    const response = await api.patch<{ recall: RecallDetail }>(
      `/recalls/${id}`,
      { status },
      { pharmacyId },
    );
    // Keep the open dialog in sync with the new lifecycle state.
    setDetail((current) => (current && current.id === id ? response.recall : current));
    loadList();
  }

  async function quarantineAffected(id: string) {
    if (!pharmacyId) return;
    const response = await api.post<{ recall: RecallDetail }>(
      `/recalls/${id}/quarantine`,
      undefined,
      { pharmacyId },
    );
    setDetail((current) => (current && current.id === id ? response.recall : current));
    setNotice('Affected batches were moved to quarantine.');
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

  function renderContent() {
    if (!checked || !session) {
      return (
        <div aria-busy="true" aria-label="Loading session" className="h-64 animate-pulse rounded-lg bg-border-subtle" />
      );
    }
    if (!activePharmacy) {
      return (
        <EmptyState
          title="No pharmacy yet"
          description="Create your pharmacy profile first - recalls are scoped to it."
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
          title="Could not load recalls"
          description={loadError}
          onRetry={() => {
            setLoadError(null);
            loadList();
          }}
        />
      );
    }
    if (!data) {
      return <div aria-busy="true" aria-label="Loading recalls" className="h-64 animate-pulse rounded-lg bg-border-subtle" />;
    }
    if (data.recalls.length === 0) {
      return (
        <EmptyState
          title={statusFilter === 'ALL' ? 'No recalls registered' : 'No recalls match this filter'}
          description={
            statusFilter === 'ALL'
              ? 'Register a manufacturer or regulator recall so affected stock can be tracked and quarantined.'
              : 'Try a different status.'
          }
          action={
            statusFilter === 'ALL' ? (
              <button
                type="button"
                onClick={() => setFormOpen(true)}
                className="inline-flex h-9 items-center rounded-md bg-primary-600 px-4 text-sm font-medium text-white transition hover:bg-primary-700"
              >
                Register recall
              </button>
            ) : null
          }
        />
      );
    }

    return (
      <div className="space-y-3">
        {data.recalls.map((recall) => (
          <RecallCard
            key={recall.id}
            recall={recall}
            onOpen={() => {
              openDetail(recall.id).catch(() => {
                setLoadError('Unable to open the recall detail.');
              });
            }}
            onUpdateStatus={(status) => updateStatus(recall.id, status)}
            onQuarantine={() => quarantineAffected(recall.id)}
          />
        ))}
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

  return (
    <AppShell
      userName={session?.user.fullName ?? ''}
      userRole={activePharmacy?.role ?? null}
      pharmacyName={activePharmacy?.pharmacyName ?? null}
      onLogout={handleLogout}
      logoutPending={logoutPending}
    >
      <div className="space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-text-primary">Recall Center</h1>
            <p className="mt-0.5 text-sm text-text-muted">
              {data ? `${data.total} recall${data.total === 1 ? '' : 's'}` : 'Loading…'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="inline-flex h-9 items-center rounded-md bg-primary-600 px-4 text-sm font-medium text-white transition hover:bg-primary-700"
          >
            Register recall
          </button>
        </header>

        {notice ? (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-bg-card px-4 py-3 text-sm"
          >
            <span className="font-medium text-status-safe-fg">{notice}</span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setNotice(null)}
              className="text-xs text-text-muted transition hover:text-text-primary"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {checked && session && activePharmacy ? (
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as RecallStatusFilter);
              setPage(1);
            }}
            aria-label="Filter by recall status"
            className={selectClasses}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : null}

        {renderContent()}
      </div>

      {activePharmacy ? (
        <RecallFormModal
          open={formOpen}
          pharmacyId={activePharmacy.pharmacyId}
          onClose={() => setFormOpen(false)}
          onCreated={() => {
            setFormOpen(false);
            setNotice('Recall registered. Review affected stock and quarantine it if needed.');
            loadList();
          }}
        />
      ) : null}

      <RecallDialog
        recall={detail}
        onClose={() => setDetail(null)}
        onUpdateStatus={(status) => {
          if (!detail) return Promise.resolve();
          return updateStatus(detail.id, status);
        }}
        onQuarantine={() => {
          if (!detail) return Promise.resolve();
          return quarantineAffected(detail.id);
        }}
      />
    </AppShell>
  );
}
