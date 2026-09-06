'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AlertListResponse } from '@pharmaguard/types';
import { api, fetchSession, type SessionData } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Pagination } from '@/components/ui/pagination';
import { AlertCard, ALERT_TYPE_LABELS } from '@/components/safety/alert-card';
import { AlertSkeleton } from '@/components/safety/safety-skeletons';

/**
 * Alerts Center (PRD §10.18, ui-registry §10 /alerts). Severity/type/status
 * filters and page live in the URL (TRD §17); the unread count returned with
 * the list drives the topbar bell badge. Reading this page also runs the
 * throttled alert engine server-side, so alerts appear without a cron job.
 */

const ALERT_STATUS_FILTERS = ['active', 'NEW', 'READ', 'SNOOZED', 'RESOLVED'] as const;
type AlertStatusFilter = (typeof ALERT_STATUS_FILTERS)[number];

const ALERT_SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
const ALERT_TYPES = [
  'EXPIRED',
  'EXPIRING',
  'LOW_STOCK',
  'STOCKOUT_RISK',
  'DEAD_STOCK',
  'OVERSTOCK',
  'RECALL',
  'QUARANTINE',
  'OCR_REVIEW',
] as const;

function parseEnum<T extends string>(values: readonly T[], value: string | null): T | null {
  return value && (values as readonly string[]).includes(value) ? (value as T) : null;
}

const STATUS_OPTIONS: { value: AlertStatusFilter; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'NEW', label: 'New' },
  { value: 'READ', label: 'Read' },
  { value: 'SNOOZED', label: 'Snoozed' },
  { value: 'RESOLVED', label: 'Resolved' },
];

// Reference ALERTS CENTER screen: severity pill tabs (All Alerts active by
// default). Status/type stay as compact secondary filters.
const SEVERITY_TABS: { value: string; label: string }[] = [
  { value: '', label: 'All Alerts' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

const selectClasses =
  'h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

export function AlertsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [session, setSession] = useState<SessionData | null>(null);
  const [checked, setChecked] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);

  const [data, setData] = useState<AlertListResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const status = parseEnum(ALERT_STATUS_FILTERS, searchParams.get('status')) ?? 'active';
  const severity = parseEnum(ALERT_SEVERITIES, searchParams.get('severity'));
  const type = parseEnum(ALERT_TYPES, searchParams.get('type'));
  const page = Number(searchParams.get('page') ?? '1') || 1;

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

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (status !== 'active') params.set('status', status);
    if (severity) params.set('severity', severity);
    if (type) params.set('type', type);
    if (page > 1) params.set('page', String(page));
    return params.toString();
  }, [status, severity, type, page]);

  const loadList = useCallback(
    (signal?: AbortSignal) => {
      if (!pharmacyId) return;
      const params = new URLSearchParams();
      params.set('status', status);
      if (severity) params.set('severity', severity);
      if (type) params.set('type', type);
      params.set('page', String(page));
      params.set('pageSize', '20');
      api
        .get<AlertListResponse>(`/alerts?${params.toString()}`, { pharmacyId, signal })
        .then((response) => {
          if (!signal?.aborted) setData(response);
        })
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          setLoadError(error instanceof Error ? error.message : 'Unable to load alerts.');
        });
    },
    [pharmacyId, status, severity, type, page],
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
      router.replace(`/alerts${params.size > 0 ? `?${params.toString()}` : ''}`, {
        scroll: false,
      });
    },
    [queryString, router],
  );

  async function handleRead(id: string) {
    if (!pharmacyId) return;
    await api.post(`/alerts/${id}/read`, undefined, { pharmacyId });
    loadList();
  }

  async function handleResolve(id: string) {
    if (!pharmacyId) return;
    await api.post(`/alerts/${id}/resolve`, undefined, { pharmacyId });
    loadList();
  }

  async function handleSnooze(id: string, days: number) {
    if (!pharmacyId) return;
    await api.post(`/alerts/${id}/snooze`, { days }, { pharmacyId });
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
          description="Create your pharmacy profile first - alerts are scoped to it."
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
          title="Could not load alerts"
          description={loadError}
          onRetry={() => {
            setLoadError(null);
            loadList();
          }}
        />
      );
    }
    if (!data) {
      return <AlertSkeleton />;
    }
    if (data.alerts.length === 0) {
      return (
        <EmptyState
          title={status === 'active' ? 'Nothing needs attention' : 'No alerts match this filter'}
          description={
            status === 'active'
              ? 'New alerts appear here automatically when stock runs low or batches near expiry.'
              : 'Try the Active view or a different status.'
          }
        />
      );
    }

    return (
      <div className="space-y-3">
        {data.alerts.map((alert) => (
          <AlertCard
            key={alert.id}
            alert={alert}
            onRead={handleRead}
            onResolve={handleResolve}
            onSnooze={handleSnooze}
          />
        ))}
        <Pagination
          page={data.page}
          totalPages={Math.max(1, Math.ceil(data.total / data.pageSize))}
          total={data.total}
          pageSize={data.pageSize}
          onPageChange={(next) => patchParams({ page: next > 1 ? String(next) : null })}
        />
      </div>
    );
  }

  return (
    <AppShell
      userName={session?.user.fullName ?? ''}
      userRole={activePharmacy?.role ?? null}
      pharmacyName={activePharmacy?.pharmacyName ?? null}
      unreadAlertsCount={data?.unreadCount ?? 0}
      onLogout={handleLogout}
      logoutPending={logoutPending}
    >
      <div className="space-y-5">
        <header>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">Alerts Center</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            {data
              ? `${data.unreadCount} new · ${data.total} matching alert${data.total === 1 ? '' : 's'}`
              : 'Loading…'}
          </p>
        </header>

        {checked && session && activePharmacy ? (
          <div className="flex flex-wrap items-center gap-3">
            <div role="group" aria-label="Filter by severity" className="flex flex-wrap items-center gap-2">
              {SEVERITY_TABS.map((tab) => {
                const isActive = severity === tab.value || (!tab.value && !severity);
                return (
                  <button
                    key={tab.value || 'all'}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => patchParams({ severity: tab.value || null, page: null })}
                    className={`inline-flex h-8 items-center rounded-full px-3.5 text-sm font-medium transition ${
                      isActive
                        ? 'bg-primary-600 text-white'
                        : 'border border-border bg-surface text-text-secondary hover:bg-surface-muted'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <select
                value={status}
                onChange={(event) =>
                  patchParams({
                    status: event.target.value === 'active' ? null : event.target.value,
                    page: null,
                  })
                }
                aria-label="Filter by status"
                className={selectClasses}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={type ?? ''}
                onChange={(event) => patchParams({ type: event.target.value || null, page: null })}
                aria-label="Filter by type"
                className={selectClasses}
              >
                <option value="">All types</option>
                {ALERT_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {ALERT_TYPE_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}

        {renderContent()}
      </div>
    </AppShell>
  );
}
