'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminPaymentListItem, PaymentStatus } from '@pharmaguard/types';
import { PAYMENT_METHOD_LABELS } from '@pharmaguard/types';
import { api, fetchSession, type SessionData } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Modal } from '@/components/ui/modal';
import { formatDate, formatPKR } from '@/lib/format';

/**
 * Platform-admin payment review console (subscriptions spec §18). Data comes
 * from GET /admin/payments (service role, cross-pharmacy); approving or
 * rejecting is the only path that grants a subscription plan. Access is
 * enforced by the API email allowlist - the UI merely mirrors it.
 */

const STATUS_CHIP: Record<string, string> = {
  PENDING: 'bg-status-warning-bg text-status-warning-fg',
  APPROVED: 'bg-status-safe-bg text-status-safe-fg',
  REJECTED: 'bg-status-critical-bg text-status-critical-fg',
};

type StatusFilter = PaymentStatus | 'ALL';

const FILTERS: StatusFilter[] = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'];

export default function AdminPaymentsPage() {
  const router = useRouter();

  const [session, setSession] = useState<SessionData | null>(null);
  const [checked, setChecked] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);

  const [filter, setFilter] = useState<StatusFilter>('PENDING');
  const [payments, setPayments] = useState<AdminPaymentListItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [rejectTarget, setRejectTarget] = useState<AdminPaymentListItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectPending, setRejectPending] = useState(false);

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

  const isAdmin = session?.isPlatformAdmin ?? false;

  const loadPayments = useCallback((status: StatusFilter, signal?: AbortSignal) => {
    api
      .get<{ payments: AdminPaymentListItem[] }>(`/admin/payments?status=${status}`, { signal })
      .then((response) => {
        if (!signal?.aborted) {
          setPayments(response.payments);
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (signal?.aborted) return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load payments.');
      });
  }, []);

  useEffect(() => {
    if (!checked || !isAdmin) return;
    const controller = new AbortController();
    loadPayments(filter, controller.signal);
    return () => controller.abort();
  }, [checked, isAdmin, filter, loadPayments]);

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

  async function handleApprove(payment: AdminPaymentListItem) {
    setRowBusy(payment.id);
    setActionError(null);
    try {
      await api.post(`/admin/payments/${payment.id}/approve`);
      loadPayments(filter, new AbortController().signal);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not approve the payment.');
    } finally {
      setRowBusy(null);
    }
  }

  async function handleRejectSubmit() {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (reason.length < 3) {
      setActionError('A rejection reason is required (at least 3 characters) so the pharmacy knows what to fix.');
      return;
    }
    setRejectPending(true);
    setActionError(null);
    try {
      await api.post(`/admin/payments/${rejectTarget.id}/reject`, { reason });
      setRejectTarget(null);
      setRejectReason('');
      loadPayments(filter, new AbortController().signal);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not reject the payment.');
    } finally {
      setRejectPending(false);
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
    if (!isAdmin) {
      return (
        <EmptyState
          title="Restricted area"
          description="Only platform administrators can review payments."
        />
      );
    }
    if (loadError) {
      return (
        <ErrorState
          title="Payments could not load"
          description={loadError}
          onRetry={() => loadPayments(filter, new AbortController().signal)}
        />
      );
    }
    if (!payments || payments.length === 0) {
      return (
        <EmptyState
          title={filter === 'ALL' ? 'No payments yet' : `No ${filter.toLowerCase()} payments`}
          description="Submitted payments appear here for manual verification."
        />
      );
    }

    return (
      <div className="overflow-x-auto rounded-lg border border-border bg-bg-card">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-text-muted">
              <th scope="col" className="px-4 py-3 font-medium">Submitted</th>
              <th scope="col" className="px-4 py-3 font-medium">Pharmacy</th>
              <th scope="col" className="px-4 py-3 font-medium">Plan</th>
              <th scope="col" className="px-4 py-3 font-medium">Amount</th>
              <th scope="col" className="px-4 py-3 font-medium">Method</th>
              <th scope="col" className="px-4 py-3 font-medium">Reference</th>
              <th scope="col" className="px-4 py-3 font-medium">Submitter</th>
              <th scope="col" className="px-4 py-3 font-medium">Proof</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              {filter !== 'REJECTED' && filter !== 'APPROVED' ? (
                <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">Actions</span></th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="border-b border-border-subtle last:border-0">
                <td className="px-4 py-3 text-text-secondary">{formatDate(payment.submittedAt)}</td>
                <td className="px-4 py-3 font-medium text-text-primary">
                  {payment.pharmacyName ?? 'Unknown pharmacy'}
                </td>
                <td className="px-4 py-3 text-text-secondary">{payment.plan}</td>
                <td className="px-4 py-3 text-text-secondary">{formatPKR(payment.amountPkr)}</td>
                <td className="px-4 py-3 text-text-secondary">
                  {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}
                </td>
                <td className="px-4 py-3 text-text-secondary">{payment.reference}</td>
                <td className="px-4 py-3 text-text-secondary">{payment.userEmail ?? '—'}</td>
                <td className="px-4 py-3">
                  {payment.proofUrl ? (
                    <a
                      href={payment.proofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary-700 underline underline-offset-2"
                    >
                      View
                    </a>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CHIP[payment.status] ?? 'bg-bg-subtle text-text-muted'}`}>
                    {payment.status}
                  </span>
                  {payment.status === 'REJECTED' && payment.rejectionReason ? (
                    <p className="mt-1 max-w-56 text-xs text-status-critical-fg">{payment.rejectionReason}</p>
                  ) : null}
                </td>
                {filter !== 'REJECTED' && filter !== 'APPROVED' ? (
                  <td className="px-4 py-3 text-right">
                    {payment.status === 'PENDING' ? (
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-md bg-primary-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-primary-700 disabled:opacity-60"
                          disabled={rowBusy === payment.id}
                          onClick={() => void handleApprove(payment)}
                        >
                          {rowBusy === payment.id ? 'Approving…' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-status-critical-fg/40 px-2.5 py-1 text-xs font-medium text-status-critical-fg transition hover:bg-status-critical-bg disabled:opacity-60"
                          disabled={rowBusy === payment.id}
                          onClick={() => {
                            setRejectTarget(payment);
                            setRejectReason('');
                            setActionError(null);
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <AppShell
      userName={session?.user.fullName ?? ''}
      userRole={session?.activePharmacy?.role ?? null}
      pharmacyName={session?.activePharmacy?.pharmacyName ?? null}
      isPlatformAdmin={session?.isPlatformAdmin ?? false}
      onLogout={handleLogout}
      logoutPending={logoutPending}
    >
      <div className="space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-text-primary">Payment Reviews</h1>
            <p className="mt-0.5 text-sm text-text-muted">
              Manual verification of Easypaisa, JazzCash and bank-transfer payments
            </p>
          </div>
          <div role="group" aria-label="Payment status filter" className="flex gap-1.5">
            {FILTERS.map((entry) => (
              <button
                key={entry}
                type="button"
                aria-pressed={filter === entry}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  filter === entry
                    ? 'bg-primary-600 text-white'
                    : 'border border-border bg-surface text-text-secondary hover:bg-surface-muted'
                }`}
                onClick={() => setFilter(entry)}
              >
                {entry}
              </button>
            ))}
          </div>
        </header>

        {actionError ? (
          <div role="alert" className="rounded-lg border border-status-critical-fg/40 bg-status-critical-bg p-3 text-sm text-status-critical-fg">
            {actionError}
          </div>
        ) : null}

        {renderContent()}
      </div>

      <Modal
        open={rejectTarget !== null}
        title="Reject payment"
        onClose={() => {
          if (!rejectPending) setRejectTarget(null);
        }}
        pending={rejectPending}
        size="sm"
      >
        <p className="mt-2 text-sm text-text-secondary">
          Rejecting the{' '}
          <span className="font-medium text-text-primary">
            {rejectTarget ? `${formatPKR(rejectTarget.amountPkr)} ${rejectTarget.plan}` : ''}
          </span>{' '}
          payment from {rejectTarget?.pharmacyName ?? 'the pharmacy'}? The reason is shown to the
          pharmacy so they can resubmit correctly.
        </p>
        <label className="mt-3 block">
          <span className="text-sm font-medium text-text-primary">Reason (required)</span>
          <textarea
            className="mt-1 min-h-20 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            maxLength={500}
            placeholder="e.g. The transaction reference could not be found in the Easypaisa statement."
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
          />
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setRejectTarget(null)}
            disabled={rejectPending}
            className="h-9 min-w-24 rounded-md border border-border bg-surface px-4 text-sm font-medium transition hover:bg-surface-muted disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleRejectSubmit()}
            disabled={rejectPending}
            className="h-9 min-w-24 rounded-md bg-status-critical-fg px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {rejectPending ? 'Rejecting…' : 'Reject payment'}
          </button>
        </div>
      </Modal>
    </AppShell>
  );
}
