'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { AuditListResponse, ComplianceSummary } from '@pharmaguard/types';
import { api, fetchSession, type SessionData } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { StatCard } from '@/components/ui/stat-card';
import { AuditTimeline } from '@/components/audit/audit-timeline';
import { formatPKR } from '@/lib/format';

/**
 * Compliance support page (PRD §10.19, build-plan Phase 11): expired,
 * quarantined and removed stock, supplier returns, stock movement and user
 * activity counts, plus the recent audit timeline. Records support internal
 * review only - the DRAP disclaimer is explicit and always visible.
 */

const RECENT_ENTRY_COUNT = 12;

export function CompliancePage() {
  const router = useRouter();

  const [session, setSession] = useState<SessionData | null>(null);
  const [checked, setChecked] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);

  const [summary, setSummary] = useState<ComplianceSummary | null>(null);
  const [recent, setRecent] = useState<AuditListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  const canRead = session?.permissions.includes('audit.read') ?? false;

  const loadSummary = useCallback(
    (signal?: AbortSignal) => {
      if (!pharmacyId) return;
      Promise.all([
        api.get<ComplianceSummary>('/compliance/summary', { pharmacyId, signal }),
        api.get<AuditListResponse>(`/audit?page=1&pageSize=${RECENT_ENTRY_COUNT}`, {
          pharmacyId,
          signal,
        }),
      ])
        .then(([summaryData, recentData]) => {
          if (signal?.aborted) return;
          setSummary(summaryData);
          setRecent(recentData);
          setError(null);
        })
        .catch((cause: unknown) => {
          if (signal?.aborted) return;
          setError(cause instanceof Error ? cause.message : 'Unable to load compliance data.');
        });
    },
    [pharmacyId],
  );

  useEffect(() => {
    if (!checked || !pharmacyId || !canRead) return;
    const controller = new AbortController();
    loadSummary(controller.signal);
    return () => controller.abort();
  }, [checked, pharmacyId, canRead, loadSummary]);

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
          description="Create or select a pharmacy before viewing compliance records."
        />
      );
    }
    if (!canRead) {
      return (
        <EmptyState
          title="No access to compliance records"
          description="Compliance data is available to the pharmacy owner and managers."
        />
      );
    }
    if (error) {
      return (
        <ErrorState
          title="Could not load compliance data"
          description={error}
          onRetry={() => loadSummary(new AbortController().signal)}
        />
      );
    }
    if (!summary || !recent) {
      return (
        <p className="text-sm text-text-muted" aria-busy="true">
          Loading compliance records…
        </p>
      );
    }

    return (
      <div className="space-y-6">
        <div
          role="note"
          className="rounded-lg border border-status-warning-border bg-status-warning-bg p-4 text-sm text-status-warning-fg"
        >
          These records support internal compliance review and inspections. PharmaGuard does not
          issue or certify official DRAP compliance - official certification requires independent
          validation.
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label="Expired stock"
            value={String(summary.expired.batches)}
            hint={`${summary.expired.units} units - ${formatPKR(summary.expired.valueAtCost)} at cost`}
          />
          <StatCard
            label="Quarantined stock"
            value={String(summary.quarantined.batches)}
            hint={`${summary.quarantined.units} units - ${formatPKR(summary.quarantined.valueAtCost)} at cost`}
          />
          <StatCard
            label="Removed stock"
            value={String(summary.removed.batches)}
            hint={`${summary.removed.units} units held as removed`}
          />
          <StatCard
            label="Returned to suppliers"
            value={`${summary.returned.completedUnits} units`}
            hint={`${summary.returned.completedReturns} completed - ${summary.returned.pendingReturns} pending`}
          />
          <StatCard
            label="Stock movements (30d)"
            value={String(summary.stockMovements30d)}
            hint="Sales, receipts, returns and batch creations"
          />
          <StatCard
            label="Active users (30d)"
            value={String(summary.activeUsers30d)}
            hint="Users with recorded actions"
          />
        </section>

        {summary.topActions.length > 0 ? (
          <section className="rounded-lg border border-border-subtle bg-bg-card p-5">
            <h2 className="text-sm font-semibold text-text-primary">Most frequent actions (30d)</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {summary.topActions.map((entry) => (
                <li
                  key={entry.action}
                  className="rounded-full bg-bg-subtle px-2.5 py-1 text-xs font-medium text-text-secondary"
                >
                  {entry.action}: {entry.count}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-lg border border-border-subtle bg-bg-card p-5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-text-primary">Recent audit timeline</h2>
            <Link
              href="/compliance/audit"
              className="text-xs font-medium text-primary-600 hover:text-primary-700"
            >
              Open full audit timeline
            </Link>
          </div>
          <AuditTimeline entries={recent.entries} />
        </section>

        <p className="text-xs text-text-faint">
          Need exports? Download inventory, sales, expiry and audit reports with CSV or PDF from{' '}
          <Link href="/reports" className="font-medium text-primary-600 hover:text-primary-700">
            Reports
          </Link>
          .
        </p>
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
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">Compliance</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            Expired, quarantined and returned stock, user actions and the audit timeline
          </p>
        </header>
        {renderContent()}
      </div>
    </AppShell>
  );
}
