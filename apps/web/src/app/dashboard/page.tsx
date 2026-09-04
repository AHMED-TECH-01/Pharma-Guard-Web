'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DashboardSummary } from '@pharmaguard/types';
import { api, fetchSession, type SessionData } from '@/lib/api';
import { formatGreeting } from '@/lib/format';
import { AppShell } from '@/components/app-shell';
import { ErrorState, EmptyState } from '@/components/ui/states';
import { KpiGrid } from '@/components/dashboard/kpi-grid';
import { ExpiryOverview, SalesOverview } from '@/components/dashboard/charts';
import {
  ExpiringSoonCard,
  LowStockCard,
  RecentSalesCard,
  StockStatusCard,
} from '@/components/dashboard/lists';
import { ActionCenter, AiDailySummary } from '@/components/dashboard/insights';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';

/**
 * Dashboard (build-plan Phase 3, PRD §10.5).
 * Session first (silent refresh on 401), then the single aggregate payload
 * from GET /dashboard/summary. Users without a pharmacy see the onboarding
 * empty state instead of an empty dashboard.
 */
export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [checked, setChecked] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchSession(controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      if (!data) {
        router.replace('/login');
        return;
      }
      setSession(data);
      setChecked(true);
    });
    return () => controller.abort();
  }, [router]);

  const loadSummary = useCallback(
    (pharmacyId: string, signal?: AbortSignal) => {
      api
        .get<{ summary: DashboardSummary }>('/dashboard/summary', { pharmacyId, signal })
        .then((data) => {
          if (signal?.aborted) return;
          setSummary(data.summary);
        })
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          setSummaryError(
            error instanceof Error ? error.message : 'Unable to load dashboard data.',
          );
        });
    },
    [],
  );

  const active = session?.activePharmacy ?? null;
  const pharmacyId = active?.pharmacyId ?? null;

  useEffect(() => {
    if (!checked || !pharmacyId) return;
    const controller = new AbortController();
    loadSummary(pharmacyId, controller.signal);
    return () => controller.abort();
  }, [checked, pharmacyId, loadSummary]);

  async function handleLogout() {
    setLogoutPending(true);
    try {
      await api.post('/auth/logout');
    } catch {
      // Cookie clearing failed server-side; the client redirect still ends
      // the visible session, and refresh would fail without the cookie.
    }
    router.replace('/login');
    router.refresh();
  }

  if (!checked || !session) {
    return (
      <div className="flex min-h-dvh" aria-busy="true" aria-label="Loading session">
        <div className="hidden w-[230px] shrink-0 bg-primary-950 lg:block" />
        <div className="flex flex-1 flex-col">
          <div className="h-16 border-b border-border bg-surface" />
          <div className="mx-auto w-full max-w-[1440px] p-4 sm:p-6">
            <DashboardSkeleton />
          </div>
        </div>
      </div>
    );
  }

  const today = new Date();
  const greeting = (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-text-primary">
          {formatGreeting(today)}, {session.user.fullName.split(' ')[0]}! 👋
        </h1>
        <p className="mt-0.5 text-sm text-text-muted">
          Here&apos;s what&apos;s happening with your pharmacy today:
        </p>
      </div>
      {/* Reference: short date pinned to the right of the greeting. */}
      <p className="text-sm text-text-muted">
        {today.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
      </p>
    </header>
  );

  return (
    <AppShell
      userName={session.user.fullName}
      userRole={active?.role ?? null}
      pharmacyName={active?.pharmacyName ?? null}
      unreadAlertsCount={summary?.unreadAlertsCount ?? 0}
      onLogout={handleLogout}
      logoutPending={logoutPending}
    >
      {!active ? (
        <div className="space-y-6">
          {greeting}
          <EmptyState
            icon={<span className="text-4xl" aria-hidden>💊</span>}
            title="Create your pharmacy to unlock the dashboard"
            description="Your dashboard comes alive once you register a pharmacy profile - add its name and contact details to get started."
            action={
              <button
                type="button"
                onClick={() => router.push('/onboarding')}
                className="inline-flex h-10 items-center rounded-md bg-primary-600 px-5 text-sm font-medium text-white transition hover:bg-primary-700"
              >
                Set up my pharmacy
              </button>
            }
          />
        </div>
      ) : summaryError ? (
        <div className="space-y-6">
          {greeting}
          <ErrorState
            title="Could not load your dashboard"
            description={summaryError}
            onRetry={
              pharmacyId
                ? () => {
                    setSummaryError(null);
                    loadSummary(pharmacyId);
                  }
                : undefined
            }
          />
        </div>
      ) : !summary ? (
        <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
          {greeting}
          <DashboardSkeleton />
        </div>
      ) : (
        <div className="space-y-6">
          {greeting}
          <KpiGrid kpis={summary.kpis} />
          {/* Reference row: Sales Overview | Expiry Overview | Stock Status. */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <SalesOverview data={summary.salesTrend} />
            <ExpiryOverview overview={summary.expiryOverview} />
            <StockStatusCard status={summary.stockStatus} />
          </section>
          {/* Reference row: Low Stock Alerts | Expiring Soon | Recent Sales. */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <LowStockCard items={summary.lowStockItems} />
            <ExpiringSoonCard items={summary.expiringSoon} />
            <RecentSalesCard items={summary.recentSales} />
          </section>
          {/* Beyond the reference composition: Phase 3 insight features,
              placed after the reference rows so the above stays pixel-faithful. */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <AiDailySummary summary={summary.aiSummary} source={summary.aiSummarySource} />
            </div>
            <ActionCenter tasks={summary.actionCenter} />
          </section>
        </div>
      )}
    </AppShell>
  );
}
