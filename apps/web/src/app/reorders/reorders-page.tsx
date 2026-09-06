'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type {
  ReorderListResponse,
  ReorderRecord,
  ReorderRecommendationsResponse,
  ReorderStatus,
} from '@pharmaguard/types';
import { api, fetchSession, type SessionData } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Pagination } from '@/components/ui/pagination';
import { ReorderCard } from '@/components/reorders/reorder-card';
import { formatDate, formatRelativeTime } from '@/lib/format';

/**
 * Reorder Center (PRD §10.12, ui-registry §10 /reorders): live TRD §11
 * recommendations with adjustable observation/lead-time windows, plus the
 * persisted reorder history with status transitions.
 */

const HISTORY_STATUS_OPTIONS: { value: 'ALL' | ReorderStatus; label: string }[] = [
  { value: 'ALL', label: 'All records' },
  { value: 'SUGGESTED', label: 'Suggested' },
  { value: 'ORDERED', label: 'Ordered' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'DISMISSED', label: 'Dismissed' },
];

const selectClasses =
  'h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

const RECORD_STATUS_CHIP: Record<ReorderStatus, string> = {
  SUGGESTED: 'bg-status-warning-bg text-status-warning-fg',
  ORDERED: 'bg-status-info-bg text-status-info-fg',
  RECEIVED: 'bg-status-safe-bg text-status-safe-fg',
  DISMISSED: 'bg-bg-subtle text-text-secondary',
};

export function ReordersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [session, setSession] = useState<SessionData | null>(null);
  const [checked, setChecked] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);

  const [observationDays, setObservationDays] = useState(
    Number.parseInt(searchParams.get('observed') ?? '30', 10) || 30,
  );
  const [leadTimeDays, setLeadTimeDays] = useState(
    Number.parseInt(searchParams.get('lead') ?? '7', 10) || 7,
  );
  const [recommendations, setRecommendations] = useState<ReorderRecommendationsResponse | null>(null);
  const [recoError, setRecoError] = useState<string | null>(null);
  const [busyMedicineId, setBusyMedicineId] = useState<string | null>(null);

  const [historyStatus, setHistoryStatus] = useState<'ALL' | ReorderStatus>('ALL');
  const [historyPage, setHistoryPage] = useState(1);
  const [history, setHistory] = useState<ReorderListResponse | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [recordBusy, setRecordBusy] = useState<string | null>(null);
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
  const canRead = session?.permissions.includes('reorders.read') ?? false;
  const canWrite = session?.permissions.includes('reorders.write') ?? false;

  const loadRecommendations = useCallback(
    (signal?: AbortSignal) => {
      if (!pharmacyId) return;
      api
        .get<ReorderRecommendationsResponse>(
          `/reorders/recommendations?observationDays=${observationDays}&leadTimeDays=${leadTimeDays}`,
          { pharmacyId, signal },
        )
        .then((response) => {
          if (!signal?.aborted) {
            setRecommendations(response);
            setRecoError(null);
          }
        })
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          setRecoError(error instanceof Error ? error.message : 'Unable to compute recommendations.');
        });
    },
    [pharmacyId, observationDays, leadTimeDays],
  );

  const loadHistory = useCallback(
    (signal?: AbortSignal) => {
      if (!pharmacyId) return;
      const params = new URLSearchParams();
      if (historyStatus !== 'ALL') params.set('status', historyStatus);
      params.set('page', String(historyPage));
      params.set('pageSize', '10');
      api
        .get<ReorderListResponse>(`/reorders?${params.toString()}`, { pharmacyId, signal })
        .then((response) => {
          if (!signal?.aborted) {
            setHistory(response);
            setHistoryError(null);
          }
        })
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          setHistoryError(error instanceof Error ? error.message : 'Unable to load reorder history.');
        });
    },
    [pharmacyId, historyStatus, historyPage],
  );

  useEffect(() => {
    if (!checked || !pharmacyId || !canRead) return;
    const controller = new AbortController();
    loadRecommendations(controller.signal);
    return () => controller.abort();
  }, [checked, pharmacyId, canRead, loadRecommendations]);

  useEffect(() => {
    if (!checked || !pharmacyId || !canRead) return;
    const controller = new AbortController();
    loadHistory(controller.signal);
    return () => controller.abort();
  }, [checked, pharmacyId, canRead, loadHistory]);

  function patchWindowParams(nextObserved: number, nextLead: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextObserved === 30) params.delete('observed');
    else params.set('observed', String(nextObserved));
    if (nextLead === 7) params.delete('lead');
    else params.set('lead', String(nextLead));
    router.replace(params.size > 0 ? `/reorders?${params.toString()}` : '/reorders');
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

  async function handleRecord(medicineId: string) {
    if (!pharmacyId) return;
    setBusyMedicineId(medicineId);
    setActionError(null);
    try {
      await api.post(
        '/reorders',
        { medicineId, observationDays, leadTimeDays },
        { pharmacyId },
      );
      loadHistory(new AbortController().signal);
      setRecommendations((current) =>
        current
          ? { ...current, recommendations: current.recommendations.filter((r) => r.medicineId !== medicineId) }
          : current,
      );
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not record the reorder.');
    } finally {
      setBusyMedicineId(null);
    }
  }

  async function handleRecordStatus(record: ReorderRecord, status: ReorderStatus) {
    if (!pharmacyId) return;
    setRecordBusy(record.id);
    setActionError(null);
    try {
      await api.patch(`/reorders/${record.id}`, { status }, { pharmacyId });
      loadHistory(new AbortController().signal);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not update the reorder.');
    } finally {
      setRecordBusy(null);
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
          description="Create or select a pharmacy before viewing reorder recommendations."
        />
      );
    }
    if (!canRead) {
      return (
        <EmptyState
          title="No access to reorders"
          description="Ask the pharmacy owner for the reorders.read permission."
        />
      );
    }

    return (
      <div className="space-y-6">
        {actionError ? (
          <div className="rounded-lg border border-status-critical-fg/40 bg-status-critical-bg p-3 text-sm text-status-critical-fg">
            {actionError}
          </div>
        ) : null}

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-text-primary">Recommendations</h2>
            <div className="flex items-center gap-2">
              <label className="text-xs text-text-muted" htmlFor="observed-window">
                Sales window
              </label>
              <select
                id="observed-window"
                className={selectClasses}
                value={observationDays}
                onChange={(event) => {
                  const next = Number.parseInt(event.target.value, 10);
                  setObservationDays(next);
                  patchWindowParams(next, leadTimeDays);
                }}
              >
                {[14, 30, 60, 90].map((days) => (
                  <option key={days} value={days}>
                    {days} days
                  </option>
                ))}
              </select>
              <label className="text-xs text-text-muted" htmlFor="lead-window">
                Lead time
              </label>
              <select
                id="lead-window"
                className={selectClasses}
                value={leadTimeDays}
                onChange={(event) => {
                  const next = Number.parseInt(event.target.value, 10);
                  setLeadTimeDays(next);
                  patchWindowParams(observationDays, next);
                }}
              >
                {[3, 7, 14, 21, 30].map((days) => (
                  <option key={days} value={days}>
                    {days} days
                  </option>
                ))}
              </select>
            </div>
          </div>

          {recoError ? (
            <ErrorState
              title="Recommendations could not load"
              description={recoError}
              onRetry={() => loadRecommendations(new AbortController().signal)}
            />
          ) : !recommendations ? (
            <p className="text-sm text-text-muted" aria-busy="true">Computing recommendations…</p>
          ) : recommendations.recommendations.length === 0 ? (
            <p className="rounded-xl border border-border bg-card p-4 text-sm text-text-muted">
              No reorders suggested for this window - stock covers the estimated lead-time demand.
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {recommendations.recommendations.map((recommendation) => (
                <ReorderCard
                  key={recommendation.medicineId}
                  recommendation={recommendation}
                  canWrite={canWrite}
                  busy={busyMedicineId === recommendation.medicineId}
                  onRecord={(entry) => void handleRecord(entry.medicineId)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-text-primary">Reorder history</h2>
            <select
              value={historyStatus}
              onChange={(event) => {
                setHistoryStatus(event.target.value as 'ALL' | ReorderStatus);
                setHistoryPage(1);
              }}
              aria-label="Filter reorder history"
              className={selectClasses}
            >
              {HISTORY_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {historyError ? (
            <ErrorState
              title="History could not load"
              description={historyError}
              onRetry={() => loadHistory(new AbortController().signal)}
            />
          ) : !history ? (
            <p className="text-sm text-text-muted" aria-busy="true">Loading history…</p>
          ) : history.reorders.length === 0 ? (
            <p className="rounded-xl border border-border bg-card p-4 text-sm text-text-muted">
              No reorder records yet - record one from a recommendation above.
            </p>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <table className="min-w-full divide-y divide-border text-sm">
                  <tbody className="divide-y divide-border">
                    {history.reorders.map((record) => (
                      <tr key={record.id}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-text-primary">{record.medicineName}</div>
                          <div className="text-xs text-text-muted">
                            {formatRelativeTime(record.createdAt)} - order {record.recommendedQuantity} units
                            {record.supplierName ? ` - ${record.supplierName}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-text-secondary">
                          Stockout est. {record.estimatedStockoutDate ? formatDate(record.estimatedStockoutDate) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${RECORD_STATUS_CHIP[record.status]}`}>
                            {record.status.charAt(0) + record.status.slice(1).toLowerCase()}
                          </span>
                        </td>
                        {canWrite ? (
                          <td className="px-4 py-3 text-right">
                            {record.status === 'SUGGESTED' || record.status === 'ORDERED' ? (
                              <select
                                aria-label={`Update status for ${record.medicineName}`}
                                className={selectClasses}
                                value={record.status}
                                disabled={recordBusy !== null}
                                onChange={(event) =>
                                  void handleRecordStatus(record, event.target.value as ReorderStatus)
                                }
                              >
                                {record.status === 'SUGGESTED' ? <option value="SUGGESTED">Suggested</option> : null}
                                <option value="ORDERED">Ordered</option>
                                <option value="RECEIVED">Received</option>
                                <option value="DISMISSED">Dismissed</option>
                              </select>
                            ) : null}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={history.page}
                totalPages={Math.max(1, Math.ceil(history.total / history.pageSize))}
                total={history.total}
                pageSize={history.pageSize}
                onPageChange={setHistoryPage}
              />
            </>
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
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">Reorders</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            Stockout predictions and recommended order quantities
          </p>
        </header>
        {renderContent()}
      </div>
    </AppShell>
  );
}
