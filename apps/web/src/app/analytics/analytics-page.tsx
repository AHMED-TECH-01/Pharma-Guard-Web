'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Printer } from 'lucide-react';
import type {
  AnalyticsInventory,
  AnalyticsOverview,
  AnalyticsReorders,
  AnalyticsSales,
  ExpiryBucketKey,
  ExpirySummary,
} from '@pharmaguard/types';
import { api, downloadFile, fetchSession, type SessionData } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { ExpiryOverview, SalesOverview } from '@/components/dashboard/charts';
import { AnalyticsSkeleton } from '@/components/analytics/analytics-skeleton';
import { HealthScore } from '@/components/analytics/health-score';
import { StatCard } from '@/components/ui/stat-card';
import { formatPKR } from '@/lib/format';

/**
 * Analytics (build-plan Phase 10, PRD §10.17, ui-registry §10 /analytics):
 * sales trends and fast movers, slow/dead/overstock lists, inventory
 * valuation, expiry exposure, reorder trends and the transparent health
 * score. Available to every authenticated member (enforced server-side).
 */

const WINDOW_OPTIONS = [7, 30, 90];

const EXPIRY_BUCKET_LABELS: Record<ExpiryBucketKey, string> = {
  expired: 'Expired',
  critical: '0-30 days',
  warning: '31-90 days',
  safe: '> 90 days',
};

const REORDER_STATUS_CHIPS: Record<string, string> = {
  suggested: 'bg-status-warning-bg text-status-warning-fg',
  ordered: 'bg-status-info-bg text-status-info-fg',
  received: 'bg-status-safe-bg text-status-safe-fg',
  dismissed: 'bg-bg-subtle text-text-secondary',
};

const REORDER_STATUS_LABELS: Record<keyof AnalyticsReorders['statusCounts'], string> = {
  suggested: 'Suggested',
  ordered: 'Ordered',
  received: 'Received',
  dismissed: 'Dismissed',
};

const selectClasses =
  'h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

function ListCard({
  title,
  subtitle,
  emptyTitle,
  emptyDescription,
  children,
}: {
  title: string;
  subtitle?: string;
  emptyTitle: string;
  emptyDescription: string;
  children: React.ReactNode;
}) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-card p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        {subtitle ? <span className="text-xs text-text-faint">{subtitle}</span> : null}
      </div>
      {hasRows ? children : <EmptyState title={emptyTitle} description={emptyDescription} />}
    </div>
  );
}

export function AnalyticsPage() {
  const router = useRouter();

  const [session, setSession] = useState<SessionData | null>(null);
  const [checked, setChecked] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);

  const [observationDays, setObservationDays] = useState(30);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [inventory, setInventory] = useState<AnalyticsInventory | null>(null);
  const [expiry, setExpiry] = useState<ExpirySummary | null>(null);
  const [reorders, setReorders] = useState<AnalyticsReorders | null>(null);
  const [sales, setSales] = useState<AnalyticsSales | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [salesError, setSalesError] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState<'csv' | 'pdf' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

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

  const loadStatic = useCallback(
    (signal?: AbortSignal) => {
      if (!pharmacyId) return;
      Promise.all([
        api.get<AnalyticsOverview>('/analytics/overview', { pharmacyId, signal }),
        api.get<AnalyticsInventory>('/analytics/inventory', { pharmacyId, signal }),
        api.get<ExpirySummary>('/analytics/expiry', { pharmacyId, signal }),
        api.get<AnalyticsReorders>('/analytics/reorders', { pharmacyId, signal }),
      ])
        .then(([overviewData, inventoryData, expiryData, reordersData]) => {
          if (signal?.aborted) return;
          setLoadError(null);
          setOverview(overviewData);
          setInventory(inventoryData);
          setExpiry(expiryData);
          setReorders(reordersData);
        })
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          setLoadError(error instanceof Error ? error.message : 'Unable to load analytics.');
        });
    },
    [pharmacyId],
  );

  const loadSales = useCallback(
    (signal?: AbortSignal) => {
      if (!pharmacyId) return;
      api
        .get<AnalyticsSales>(`/analytics/sales?observationDays=${observationDays}`, { pharmacyId, signal })
        .then((response) => {
          if (signal?.aborted) return;
          setSales(response);
          setSalesError(null);
        })
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          setSalesError(error instanceof Error ? error.message : 'Unable to load sales analytics.');
        });
    },
    [pharmacyId, observationDays],
  );

  useEffect(() => {
    if (!checked || !pharmacyId) return;
    const controller = new AbortController();
    loadStatic(controller.signal);
    return () => controller.abort();
  }, [checked, pharmacyId, loadStatic]);

  useEffect(() => {
    if (!checked || !pharmacyId) return;
    const controller = new AbortController();
    loadSales(controller.signal);
    return () => controller.abort();
  }, [checked, pharmacyId, loadSales]);

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

  function isoWindowFrom(): string {
    return new Date(Date.now() - (observationDays - 1) * 86400000).toISOString().slice(0, 10);
  }

  // Reference REPORTS & ANALYTICS footer: export the sales report for the
  // selected window via the /reports/sales endpoints; print uses the browser.
  async function handleExport(format: 'csv' | 'pdf') {
    if (!pharmacyId) return;
    setExportBusy(format);
    setExportError(null);
    try {
      const params = new URLSearchParams({ format });
      params.set('from', isoWindowFrom());
      params.set('to', new Date().toISOString().slice(0, 10));
      const { blob, filename } = await downloadFile(`/reports/sales?${params.toString()}`, {
        pharmacyId,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : 'Could not download the report.');
    } finally {
      setExportBusy(null);
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
          description="Create or select a pharmacy before viewing analytics."
        />
      );
    }
    if (loadError) {
      return <ErrorState title="Could not load analytics" description={loadError} onRetry={() => loadStatic(new AbortController().signal)} />;
    }
    if (!overview || !inventory || !expiry || !reorders) {
      return <AnalyticsSkeleton />;
    }

    // Adapt the safety ExpirySummary into the dashboard donut shape.
    const expiryChart = {
      totalBatches: expiry.buckets.reduce((sum, card) => sum + card.batchCount, 0),
      buckets: expiry.buckets.map((card) => ({
        key: card.bucket.toLowerCase() as ExpiryBucketKey,
        label: EXPIRY_BUCKET_LABELS[card.bucket.toLowerCase() as ExpiryBucketKey],
        count: card.batchCount,
      })),
    };

    const deltaHint =
      overview.salesDeltaPct === null
        ? 'No sales yesterday'
        : `${overview.salesDeltaPct >= 0 ? '+' : ''}${overview.salesDeltaPct}% vs yesterday`;
    const maxCreated = Math.max(...reorders.createdPerDay.map((day) => day.count), 1);
    // Derived staleness: the displayed trend belongs to a previous window.
    const salesStale = sales !== null && sales.observationDays !== observationDays;

    // Window sales come from the loaded trend so the KPI matches the selected
    // window; the overview snapshot is the 30-day fallback while it loads.
    const salesWindowTotal =
      sales && !salesStale
        ? sales.trend.reduce((sum, point) => sum + point.total, 0)
        : overview.revenue30d;
    const topMovers = sales && !salesStale ? sales.fastMovers.slice(0, 5) : [];
    const maxMoverUnits = Math.max(...topMovers.map((mover) => mover.unitsSold), 1);

    return (
      <div className="space-y-6">
        {/* Reference REPORTS & ANALYTICS composition: 3 KPI cards, Sales Trend
            + Top Selling Medicines, export buttons. Phase 10 suites (health
            score, expiry exposure, reorder pipeline, movers) remain below. */}
        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Total Sales" value={formatPKR(salesWindowTotal)} hint={deltaHint} />
          <StatCard
            label="Total Items Sold"
            value={overview.unitsSold30d.toLocaleString('en-US')}
            hint="In the last 30 days"
          />
          <StatCard
            label="Gross Margin"
            value={overview.grossMargin30d === null ? 'Not configured' : formatPKR(overview.grossMargin30d)}
            hint={
              overview.marginPct === null
                ? 'Set batch purchase prices to track margin'
                : `${overview.marginPct}% of revenue`
            }
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {salesError && (salesStale || !sales) ? (
              <ErrorState
                title="Could not load sales analytics"
                description={salesError}
                onRetry={() => loadSales(new AbortController().signal)}
              />
            ) : !sales || salesStale ? (
              <div
                className="flex h-72 items-center justify-center rounded-lg border border-border-subtle bg-bg-card text-sm text-text-muted"
                aria-busy="true"
              >
                Loading sales trend…
              </div>
            ) : (
              <SalesOverview
                data={sales.trend}
                title="Sales Trend"
                subtitle={`Last ${sales.observationDays} Days`}
              />
            )}
          </div>

          <div className="rounded-lg border border-border-subtle bg-bg-card p-5">
            <h2 className="text-sm font-semibold text-text-primary">Top Selling Medicines</h2>
            {topMovers.length > 0 ? (
              <ul className="mt-4 space-y-3.5">
                {topMovers.map((mover) => (
                  <li key={mover.medicineId}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate font-medium text-text-primary">
                        {mover.medicineName}
                        {mover.medicineStrength ? (
                          <span className="ml-1.5 text-xs text-text-muted">{mover.medicineStrength}</span>
                        ) : null}
                      </span>
                      <span className="shrink-0 tabular-nums text-text-muted">{mover.unitsSold}</span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-bg-subtle">
                      <div
                        className="h-2 rounded-full bg-primary-600"
                        style={{ width: `${Math.max((mover.unitsSold / maxMoverUnits) * 100, 4)}%` }}
                        title={`${mover.unitsSold} units - ${formatPKR(mover.revenue)} revenue`}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-text-muted">
                No sales in this window yet. Record sales to see top sellers.
              </p>
            )}
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleExport('pdf')}
            disabled={exportBusy !== null}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium text-text-primary transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="size-4" aria-hidden />
            {exportBusy === 'pdf' ? 'Preparing…' : 'Download PDF'}
          </button>
          <button
            type="button"
            onClick={() => void handleExport('csv')}
            disabled={exportBusy !== null}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium text-text-primary transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="size-4" aria-hidden />
            {exportBusy === 'csv' ? 'Preparing…' : 'Download CSV'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium text-text-primary transition hover:bg-surface-muted"
          >
            <Printer className="size-4" aria-hidden />
            Print Report
          </button>
          {exportError ? (
            <span role="alert" className="text-xs text-status-critical-fg">
              {exportError}
            </span>
          ) : null}
        </div>

        <section className="grid gap-4 lg:grid-cols-3">
          <HealthScore score={overview.healthScore} notes={overview.healthNotes} />
          <div className="space-y-4">
            <ExpiryOverview overview={expiryChart} />
            {expiry.valueAtRisk > 0 ? (
              <p className="px-1 text-xs text-text-muted">
                Value at risk (expired + expiring):{' '}
                <span className="font-medium text-text-primary">{formatPKR(expiry.valueAtRisk)}</span>
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border border-border-subtle bg-bg-card p-5">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-text-primary">Reorder pipeline</h2>
              {reorders.urgentCount > 0 ? (
                <span className="rounded-full bg-status-critical-bg px-2 py-0.5 text-xs font-medium text-status-critical-fg">
                  {reorders.urgentCount} out of stock
                </span>
              ) : null}
            </div>
            <ul className="flex flex-wrap gap-2">
              {(Object.keys(REORDER_STATUS_LABELS) as (keyof AnalyticsReorders['statusCounts'])[]).map((status) => (
                <li
                  key={status}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${REORDER_STATUS_CHIPS[status]}`}
                >
                  {REORDER_STATUS_LABELS[status]}: {reorders.statusCounts[status]}
                </li>
              ))}
            </ul>
            <p className="mb-1 mt-4 text-xs font-medium uppercase tracking-wide text-text-faint">
              Created per day (30 days)
            </p>
            <div className="flex h-16 items-end gap-1" aria-hidden="true">
              {reorders.createdPerDay.map((day) => (
                <div
                  key={day.date}
                  title={`${day.label}: ${day.count} reorders`}
                  className="flex-1 rounded-sm bg-primary-500"
                  style={{ height: `${Math.max((day.count / maxCreated) * 100, 4)}%` }}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <ListCard
            title="Slow movers"
            subtitle={inventory.slowMovers.length > 0 ? `${inventory.slowMovers.length} shown` : undefined}
            emptyTitle="No slow movers"
            emptyDescription="Everything on hand is selling."
          >
            <ul className="space-y-2">
              {inventory.slowMovers.map((item) => (
                <li key={item.medicineId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-medium text-text-primary">{item.medicineName}</span>
                    <span className="ml-1.5 text-xs text-text-muted">{item.currentStock} on hand</span>
                  </span>
                  <span className="shrink-0 text-xs text-text-muted">
                    {item.unitsSold30d} units/30d - {formatPKR(item.valueAtCost)}
                  </span>
                </li>
              ))}
            </ul>
          </ListCard>

          <ListCard
            title="Dead stock"
            subtitle={inventory.deadStock.length > 0 ? `${inventory.deadStock.length} shown` : undefined}
            emptyTitle="No dead stock"
            emptyDescription="No stock has sat unsold for 60 days."
          >
            <ul className="space-y-2">
              {inventory.deadStock.map((item) => (
                <li key={item.medicineId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-medium text-text-primary">{item.medicineName}</span>
                    <span className="ml-1.5 text-xs text-text-muted">{item.currentStock} on hand</span>
                  </span>
                  <span className="shrink-0 text-xs text-status-critical-fg">{formatPKR(item.valueAtCost)}</span>
                </li>
              ))}
            </ul>
          </ListCard>

          <ListCard
            title="Overstock"
            subtitle={inventory.overstock.length > 0 ? `${inventory.overstock.length} shown` : undefined}
            emptyTitle="No overstock"
            emptyDescription="Stock levels are within reorder thresholds."
          >
            <ul className="space-y-2">
              {inventory.overstock.map((item) => (
                <li key={item.medicineId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-medium text-text-primary">{item.medicineName}</span>
                    <span className="ml-1.5 text-xs text-text-muted">
                      {item.excessUnits} above threshold ({item.threshold})
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-text-muted">{formatPKR(item.valueAtCost)}</span>
                </li>
              ))}
            </ul>
          </ListCard>
        </section>

        <p className="text-xs text-text-faint">
          Inventory on hand: {inventory.totalUnits} units. Slow movers sold 5 units or fewer in 30
          days; dead stock has had no sales in 60 days.
        </p>
      </div>
    );
  }

  const now = new Date();
  const windowFrom = new Date(now);
  windowFrom.setDate(windowFrom.getDate() - (observationDays - 1));
  const rangeLabel = `${windowFrom.toLocaleDateString('en-GB')} - ${now.toLocaleDateString('en-GB')}`;

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
            <h1 className="text-xl font-semibold tracking-tight text-text-primary">Sales Overview</h1>
            <p className="mt-0.5 text-sm text-text-muted">Track your pharmacy&apos;s sales performance.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Reference REPORTS & ANALYTICS header: the window is shown as a date range. */}
            <span
              suppressHydrationWarning
              className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-sm tabular-nums text-text-primary"
            >
              {rangeLabel}
            </span>
            <label className="flex items-center gap-2 text-xs text-text-muted">
              Window
              <select
                className={selectClasses}
                value={observationDays}
                onChange={(event) => setObservationDays(Number(event.target.value))}
              >
                {WINDOW_OPTIONS.map((days) => (
                  <option key={days} value={days}>
                    {days} days
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>
        {renderContent()}
      </div>
    </AppShell>
  );
}
