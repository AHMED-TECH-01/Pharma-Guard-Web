'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type {
  ExpiryAction,
  ExpiryBatchListResponse,
  ExpiryActionResult,
  ExpiryStatus,
  ExpirySummary,
} from '@pharmaguard/types';
import { X } from 'lucide-react';
import { api, fetchSession, type SessionData } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Pagination } from '@/components/ui/pagination';
import { ExpiryCards } from '@/components/safety/expiry-cards';
import { ExpiryTable } from '@/components/safety/expiry-table';
import { BulkActionBar } from '@/components/safety/bulk-action-bar';
import { ExpiryCenterSkeleton } from '@/components/safety/safety-skeletons';

/**
 * Expiry Center (PRD §10.9, ui-registry §10 /expiry). Status cards, FEFO
 * table, and bulk actions with mandatory reasons. Bucket/page live in the
 * URL (TRD §17). The view covers AVAILABLE batches only - quarantined stock
 * lives in the Quarantine register.
 */

const EXPIRY_BUCKETS = ['ALL', 'EXPIRED', 'CRITICAL', 'WARNING', 'SAFE'] as const;
type ExpiryBucketFilter = (typeof EXPIRY_BUCKETS)[number];

function parseBucket(value: string | null): ExpiryBucketFilter {
  return (EXPIRY_BUCKETS as readonly string[]).includes(value ?? '')
    ? (value as ExpiryBucketFilter)
    : 'ALL';
}

export function ExpiryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [session, setSession] = useState<SessionData | null>(null);
  const [checked, setChecked] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);

  const [summary, setSummary] = useState<ExpirySummary | null>(null);
  const [data, setData] = useState<ExpiryBatchListResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; skipped: ExpiryActionResult['skipped'] } | null>(null);

  const bucket = parseBucket(searchParams.get('bucket'));
  const page = Number(searchParams.get('page') ?? '1') || 1;

  // Selection resets whenever the bucket/page view changes.
  const [selection, setSelection] = useState<string[]>([]);
  const [selectionKey, setSelectionKey] = useState('');
  const listKey = `${bucket}:${page}`;
  if (selectionKey !== listKey) {
    setSelectionKey(listKey);
    setSelection([]);
  }

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
  const canExpiryAct = session?.permissions.includes('expiry.act') ?? false;
  const canQuarantineAct = session?.permissions.includes('quarantine.act') ?? false;

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (bucket !== 'ALL') params.set('bucket', bucket);
    if (page > 1) params.set('page', String(page));
    return params.toString();
  }, [bucket, page]);

  const loadSummary = useCallback(
    (signal?: AbortSignal) => {
      if (!pharmacyId) return;
      api
        .get<{ summary: ExpirySummary }>('/expiry/summary', { pharmacyId, signal })
        .then((response) => {
          if (!signal?.aborted) setSummary(response.summary);
        })
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          setLoadError(
            (current) =>
              current ?? (error instanceof Error ? error.message : 'Unable to load expiry data.'),
          );
        });
    },
    [pharmacyId],
  );

  const loadBatches = useCallback(
    (signal?: AbortSignal) => {
      if (!pharmacyId) return;
      const params = new URLSearchParams();
      params.set('bucket', bucket);
      params.set('page', String(page));
      params.set('pageSize', '20');
      api
        .get<ExpiryBatchListResponse>(`/expiry/batches?${params.toString()}`, { pharmacyId, signal })
        .then((response) => {
          if (!signal?.aborted) setData(response);
        })
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          setLoadError(
            (current) =>
              current ?? (error instanceof Error ? error.message : 'Unable to load expiry batches.'),
          );
        });
    },
    [pharmacyId, bucket, page],
  );

  useEffect(() => {
    if (!checked || !pharmacyId) return;
    const controller = new AbortController();
    loadSummary(controller.signal);
    loadBatches(controller.signal);
    return () => controller.abort();
  }, [checked, pharmacyId, loadSummary, loadBatches]);

  const patchParams = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(queryString);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '') params.delete(key);
        else params.set(key, value);
      }
      router.replace(`/expiry${params.size > 0 ? `?${params.toString()}` : ''}`, {
        scroll: false,
      });
    },
    [queryString, router],
  );

  const handleBucketSelect = useCallback(
    (next: ExpiryStatus) => patchParams({ bucket: next === bucket ? null : next, page: null }),
    [patchParams, bucket],
  );

  async function handleBulkRun(action: ExpiryAction, reason: string) {
    if (!pharmacyId) return;
    const result = await api.post<ExpiryActionResult>(
      '/expiry/actions',
      { batchIds: selection, action, reason },
      { pharmacyId },
    );
    const verb =
      action === 'REMOVE'
        ? 'marked removed'
        : action === 'RETURN'
          ? 'marked returned'
          : 'quarantined';
    setNotice({
      text: `${result.updated} batch${result.updated === 1 ? '' : 'es'} ${verb}.`,
      skipped: result.skipped,
    });
    setSelection([]);
    loadSummary();
    loadBatches();
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
          description="Create your pharmacy profile first - expiry tracking is scoped to it."
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
          title="Could not load the Expiry Center"
          description={loadError}
          onRetry={() => {
            setLoadError(null);
            loadSummary();
            loadBatches();
          }}
        />
      );
    }
    if (!summary || !data) {
      return <ExpiryCenterSkeleton />;
    }

    if (data.batches.length === 0) {
      return (
        <div className="space-y-4">
          <ExpiryCards buckets={summary.buckets} activeBucket={bucket} onSelect={handleBucketSelect} />
          <EmptyState
            title={bucket === 'ALL' ? 'No expiring stock' : 'Nothing in this bucket'}
            description={
              bucket === 'ALL'
                ? 'No available batches are expired or inside the warning window.'
                : 'Try another bucket or switch back to all batches.'
            }
            action={
              bucket === 'ALL' ? null : (
                <button
                  type="button"
                  onClick={() => patchParams({ bucket: null, page: null })}
                  className="h-9 rounded-md border border-border bg-surface px-4 text-sm font-medium transition hover:bg-surface-muted"
                >
                  Show all batches
                </button>
              )
            }
          />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <ExpiryCards buckets={summary.buckets} activeBucket={bucket} onSelect={handleBucketSelect} />

        {notice ? (
          <div
            role="status"
            className="flex items-start justify-between gap-3 rounded-lg border border-border-subtle bg-bg-card p-4"
          >
            <div className="min-w-0 text-sm">
              <p className="font-medium text-status-safe-fg">{notice.text}</p>
              {notice.skipped.length > 0 ? (
                <div className="mt-2 text-text-muted">
                  <p className="text-xs font-medium uppercase tracking-wide text-status-warning-fg">
                    {notice.skipped.length} skipped
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {notice.skipped.map((skip) => (
                      <li key={skip.id}>
                        {skip.medicineName} (batch {skip.batchNo}) - {skip.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setNotice(null)}
              className="rounded p-1 text-text-muted transition hover:bg-surface-muted hover:text-text-primary"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ) : null}

        <ExpiryTable
          batches={data.batches}
          selected={selection}
          canAct={canExpiryAct || canQuarantineAct}
          onToggle={(batchId) =>
            setSelection((current) =>
              current.includes(batchId)
                ? current.filter((id) => id !== batchId)
                : [...current, batchId],
            )
          }
          onToggleAll={(selected) =>
            setSelection(selected ? data.batches.map((batch) => batch.id) : [])
          }
        />

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
      onLogout={handleLogout}
      logoutPending={logoutPending}
    >
      <div className="space-y-5">
        <header>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">Expiry Center</h1>
          <p className="mt-0.5 text-sm text-text-muted">Monitor and act on batches approaching or past expiry.</p>
        </header>

        {renderContent()}
      </div>

      {activePharmacy ? (
        <BulkActionBar
          selectedCount={selection.length}
          canExpiryAct={canExpiryAct}
          canQuarantineAct={canQuarantineAct}
          onRun={handleBulkRun}
        />
      ) : null}
    </AppShell>
  );
}
