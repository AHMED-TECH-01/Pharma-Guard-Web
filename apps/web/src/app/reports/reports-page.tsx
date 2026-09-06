'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ReportPreview, ReportType } from '@pharmaguard/types';
import { api, downloadFile, fetchSession, type SessionData } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { EmptyState, ErrorState } from '@/components/ui/states';

/**
 * Reports (PRD §10.20, ui-registry §10 /reports): JSON preview of each
 * report plus CSV and PDF exports rendered server-side. Dated reports take
 * a bounded from/to window; state reports reflect current stock.
 */

const REPORT_OPTIONS: {
  value: ReportType;
  label: string;
  description: string;
  dated: boolean;
}[] = [
  { value: 'inventory', label: 'Inventory', description: 'All stock on hand with batch, expiry and status.', dated: false },
  { value: 'expired', label: 'Expired stock', description: 'Saleable batches already past their expiry date.', dated: false },
  { value: 'near-expiry', label: 'Near-expiry', description: 'Batches expiring within the next 90 days.', dated: false },
  { value: 'sales', label: 'Sales', description: 'Sales in the selected window, including reversals.', dated: true },
  { value: 'purchases', label: 'Purchases', description: 'Received purchase lines in the selected window.', dated: true },
  { value: 'valuation', label: 'Stock valuation', description: 'Value of stock on hand at cost, per medicine.', dated: false },
  { value: 'audit', label: 'Audit', description: 'Audit trail events in the selected window.', dated: true },
  { value: 'returns', label: 'Returns', description: 'Supplier returns in the selected window.', dated: true },
];

const selectClasses =
  'h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

export function ReportsPage() {
  const router = useRouter();

  const [session, setSession] = useState<SessionData | null>(null);
  const [checked, setChecked] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);

  const [type, setType] = useState<ReportType>('inventory');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState<'csv' | 'pdf' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const activeReport = REPORT_OPTIONS.find((option) => option.value === type) ?? REPORT_OPTIONS[0];

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
  const canRead = session?.permissions.includes('reports.read') ?? false;

  const loadPreview = useCallback(
    (signal?: AbortSignal) => {
      if (!pharmacyId) return;
      const params = new URLSearchParams();
      if (activeReport.dated) {
        if (from) params.set('from', from);
        if (to) params.set('to', to);
      }
      const suffix = params.size > 0 ? `?${params.toString()}` : '';
      api
        .get<ReportPreview>(`/reports/${type}${suffix}`, { pharmacyId, signal })
        .then((response) => {
          if (signal?.aborted) return;
          setPreview(response);
          setError(null);
        })
        .catch((cause: unknown) => {
          if (signal?.aborted) return;
          setError(cause instanceof Error ? cause.message : 'Unable to load the report.');
        });
    },
    [pharmacyId, type, activeReport.dated, from, to],
  );

  useEffect(() => {
    if (!checked || !pharmacyId || !canRead) return;
    const controller = new AbortController();
    loadPreview(controller.signal);
    return () => controller.abort();
  }, [checked, pharmacyId, canRead, loadPreview]);

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

  async function handleExport(format: 'csv' | 'pdf') {
    if (!pharmacyId) return;
    setExportBusy(format);
    setExportError(null);
    try {
      const params = new URLSearchParams({ format });
      if (activeReport.dated) {
        if (from) params.set('from', from);
        if (to) params.set('to', to);
      }
      const { blob, filename } = await downloadFile(
        `/reports/${type}?${params.toString()}`,
        { pharmacyId },
      );
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
          description="Create or select a pharmacy before viewing reports."
        />
      );
    }
    if (!canRead) {
      return (
        <EmptyState
          title="No access to reports"
          description="Reports are available to the pharmacy owner and managers."
        />
      );
    }

    const truncated = preview !== null && preview.totalRows > preview.rows.length;

    return (
      <div className="space-y-5">
        <section className="rounded-lg border border-border-subtle bg-bg-card p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-text-muted">
              Report
              <select
                className={selectClasses}
                value={type}
                onChange={(event) => {
                  setPreview(null);
                  setError(null);
                  setType(event.target.value as ReportType);
                }}
              >
                {REPORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {activeReport.dated ? (
              <>
                <label className="flex flex-col gap-1.5 text-xs font-medium text-text-muted">
                  From
                  <input
                    type="date"
                    className={selectClasses}
                    value={from}
                    onChange={(event) => {
                      setPreview(null);
                      setFrom(event.target.value);
                    }}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-medium text-text-muted">
                  To
                  <input
                    type="date"
                    className={selectClasses}
                    value={to}
                    onChange={(event) => {
                      setPreview(null);
                      setTo(event.target.value);
                    }}
                  />
                </label>
              </>
            ) : null}
          </div>
          <p className="mt-3 text-xs text-text-muted">
            {activeReport.description}
            {activeReport.dated ? ' Leave the window empty for the last 30 days.' : ''}
          </p>
        </section>

        {error ? (
          <ErrorState
            title="Could not load the report"
            description={error}
            onRetry={() => loadPreview(new AbortController().signal)}
          />
        ) : !preview ? (
          <p className="text-sm text-text-muted" aria-busy="true">
            Loading report…
          </p>
        ) : (
          <section className="rounded-lg border border-border-subtle bg-bg-card">
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5">
              <h2 className="text-sm font-semibold text-text-primary">{preview.title}</h2>
              <span className="text-xs text-text-faint">
                {truncated
                  ? `Preview: first ${preview.rows.length} of ${preview.totalRows} rows`
                  : `${preview.totalRows} rows`}
              </span>
            </div>
            {preview.rows.length > 0 ? (
              <div className="overflow-x-auto px-5 pb-5 pt-3">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border-subtle text-xs uppercase tracking-wide text-text-faint">
                      {preview.columns.map((column) => (
                        <th key={column.key} scope="col" className="whitespace-nowrap py-2 pr-4 font-medium">
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-b border-border-subtle last:border-0">
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="whitespace-nowrap py-2.5 pr-4 text-text-secondary">
                            {cell === null ? '-' : cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-5 pb-5 pt-3">
                <EmptyState
                  title="Nothing to report"
                  description="No records match this report scope."
                />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle px-5 py-4">
              <button
                type="button"
                onClick={() => handleExport('csv')}
                disabled={exportBusy !== null}
                className="inline-flex h-9 items-center rounded-md bg-primary-600 px-4 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exportBusy === 'csv' ? 'Preparing…' : 'Export CSV'}
              </button>
              <button
                type="button"
                onClick={() => handleExport('pdf')}
                disabled={exportBusy !== null}
                className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-text-primary transition hover:bg-bg-subtle disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exportBusy === 'pdf' ? 'Preparing…' : 'Export PDF'}
              </button>
              {exportError ? (
                <span role="alert" className="text-xs text-status-critical-fg">
                  {exportError}
                </span>
              ) : null}
            </div>
          </section>
        )}

        <p className="text-xs text-text-faint">
          Exports include summary totals where applicable. Internal records for review support -
          not an official DRAP certification.
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
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">Reports</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            Inventory, sales, compliance and audit reports with CSV and PDF exports
          </p>
        </header>
        {renderContent()}
      </div>
    </AppShell>
  );
}
