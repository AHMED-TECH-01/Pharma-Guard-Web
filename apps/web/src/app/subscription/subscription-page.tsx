'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  PaymentMethodId,
  PaymentMethodInstruction,
  PlanDefinition,
  SubscriptionOverview,
} from '@pharmaguard/types';
import { PAYMENT_METHOD_LABELS, PLANS } from '@pharmaguard/types';
import { api, fetchSession, type SessionData } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Modal } from '@/components/ui/modal';
import { formatDate, formatPKR } from '@/lib/format';

/**
 * Subscription page (subscriptions spec §7). Every member can view the
 * current plan, usage and payment history; the OWNER (billing.manage)
 * submits payments and switches plans. Plans, prices and limits come from
 * the shared source of truth and the API - never from client state.
 */

const PAYMENT_STATUS_CHIP: Record<string, string> = {
  PENDING: 'bg-status-warning-bg text-status-warning-fg',
  APPROVED: 'bg-status-safe-bg text-status-safe-fg',
  REJECTED: 'bg-status-critical-bg text-status-critical-fg',
};

const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = {
  TRIALING: 'Trialing',
  ACTIVE: 'Active',
  PAST_DUE: 'Past due',
  CANCELLED: 'Cancelled',
};

const MAX_PROOF_BYTES = 5 * 1024 * 1024;

function UsageMeter({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const unlimited = limit === null;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(limit ?? 1, 1)) * 100));
  const barColor = pct >= 100 ? 'bg-status-critical-fg' : 'bg-primary-600';
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-text-primary">{label}</span>
        <span className="text-text-muted">
          {used.toLocaleString('en-US')} / {unlimited ? 'Unlimited' : (limit ?? 0).toLocaleString('en-US')}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-border-subtle" role="presentation">
        <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function SubscriptionPage() {
  const router = useRouter();

  const [session, setSession] = useState<SessionData | null>(null);
  const [checked, setChecked] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);

  const [overview, setOverview] = useState<SubscriptionOverview | null>(null);
  const [methods, setMethods] = useState<PaymentMethodInstruction[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [payTarget, setPayTarget] = useState<PlanDefinition | null>(null);
  const [payMethod, setPayMethod] = useState<PaymentMethodId | ''>('');
  const [payReference, setPayReference] = useState('');
  const [payProof, setPayProof] = useState<File | null>(null);
  const [payPending, setPayPending] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const [downgradeOpen, setDowngradeOpen] = useState(false);
  const [switchPending, setSwitchPending] = useState(false);
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
  // Payment submission is a normal feature for every member (spec §23);
  // billing.manage (OWNER) only guards the switch to the free plan, a
  // pharmacy-wide business decision.
  const canManageBilling = session?.permissions.includes('billing.manage') ?? false;

  const loadOverview = useCallback(
    (signal?: AbortSignal) => {
      if (!pharmacyId) return;
      api
        .get<SubscriptionOverview>('/billing/overview', { pharmacyId, signal })
        .then((response) => {
          if (!signal?.aborted) {
            setOverview(response);
            setLoadError(null);
          }
        })
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          setLoadError(error instanceof Error ? error.message : 'Unable to load the subscription.');
        });
    },
    [pharmacyId],
  );

  useEffect(() => {
    if (!checked || !pharmacyId) return;
    const controller = new AbortController();
    loadOverview(controller.signal);
    api
      .get<{ methods: PaymentMethodInstruction[] }>('/billing/payment-methods', {
        signal: controller.signal,
      })
      .then((response) => {
        if (!controller.signal.aborted) setMethods(response.methods);
      })
      .catch(() => {
        // Non-fatal: the payment dialog surfaces the missing methods itself.
      });
    return () => controller.abort();
  }, [checked, pharmacyId, loadOverview]);

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

  const pendingPayment = overview?.payments.find((payment) => payment.status === 'PENDING') ?? null;
  const currentPlanId = overview?.subscription.plan ?? null;

  function openPayDialog(plan: PlanDefinition) {
    setPayTarget(plan);
    setPayMethod(methods.length === 1 ? methods[0]!.method : '');
    setPayReference('');
    setPayProof(null);
    setPayError(null);
  }

  async function handlePaySubmit() {
    if (!pharmacyId || !payTarget) return;
    const reference = payReference.trim();
    if (!payMethod) {
      setPayError('Choose a payment method first.');
      return;
    }
    if (reference.length < 4 || reference.length > 100) {
      setPayError('Enter the transaction or reference number from your payment confirmation (4-100 characters).');
      return;
    }
    if (payProof && payProof.size > MAX_PROOF_BYTES) {
      setPayError('Payment proof exceeds the 5 MB size limit.');
      return;
    }
    setPayPending(true);
    setPayError(null);
    try {
      if (payProof) {
        await api.upload('/billing/payments', {
          file: payProof,
          fieldName: 'proof',
          fields: { planId: payTarget.id, method: payMethod, reference },
          pharmacyId,
        });
      } else {
        await api.post(
          '/billing/payments',
          { planId: payTarget.id, method: payMethod, reference },
          { pharmacyId },
        );
      }
      setPayTarget(null);
      loadOverview(new AbortController().signal);
    } catch (cause) {
      setPayError(cause instanceof Error ? cause.message : 'Could not submit the payment.');
    } finally {
      setPayPending(false);
    }
  }

  async function handleDowngrade() {
    if (!pharmacyId) return;
    setSwitchPending(true);
    setActionError(null);
    try {
      await api.post('/billing/subscribe/free', { planId: 'FREE' }, { pharmacyId });
      setDowngradeOpen(false);
      loadOverview(new AbortController().signal);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not switch to the Free plan.');
    } finally {
      setSwitchPending(false);
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
    if (!activePharmacy || !overview) {
      if (loadError) {
        return (
          <ErrorState
            title="The subscription could not load"
            description={loadError}
            onRetry={() => loadOverview(new AbortController().signal)}
          />
        );
      }
      return (
        <EmptyState
          title="No pharmacy selected"
          description="Create or select a pharmacy to manage its subscription."
        />
      );
    }

    const { subscription, plan, usage, payments } = overview;

    return (
      <div className="space-y-5">
        {actionError ? (
          <div role="alert" className="rounded-lg border border-status-critical-fg/40 bg-status-critical-bg p-3 text-sm text-status-critical-fg">
            {actionError}
          </div>
        ) : null}

        {pendingPayment ? (
          <div role="status" className="rounded-lg border border-status-warning-fg/40 bg-status-warning-bg p-3 text-sm text-status-warning-fg">
            A {formatPKR(pendingPayment.amountPkr)} payment for the {pendingPayment.plan} plan is
            awaiting verification. You can submit a new payment once it has been reviewed.
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-lg border border-border bg-bg-card p-5 lg:col-span-1">
            <h2 className="text-sm font-semibold text-text-primary">Current plan</h2>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">{plan.name}</p>
            <p className="text-sm text-text-muted">
              {plan.pricePkr === 0 ? 'Free' : `${plan.priceLabel}${plan.period}`}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-800">
                {SUBSCRIPTION_STATUS_LABEL[subscription.status] ?? subscription.status}
              </span>
              {subscription.currentPeriodEnd ? (
                <span className="text-xs text-text-muted">
                  Period ends {formatDate(subscription.currentPeriodEnd)}
                </span>
              ) : null}
            </div>
            <ul className="mt-4 space-y-1.5">
              {plan.features.map((feature) => (
                <li key={feature} className="text-xs text-text-secondary">{feature}</li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-border bg-bg-card p-5 lg:col-span-2">
            <h2 className="text-sm font-semibold text-text-primary">Usage this period</h2>
            <p className="mt-1 text-xs text-text-muted">
              Limits apply when creating new records - existing data always stays accessible.
            </p>
            <div className="mt-4 space-y-4">
              <UsageMeter label="Medicines" used={usage.medicines} limit={plan.limits.medicines} />
              <UsageMeter label="Team members" used={usage.users} limit={plan.limits.users} />
              <UsageMeter label="AI scans (this month)" used={usage.ocrScansThisMonth} limit={plan.limits.ocrScansPerMonth} />
            </div>
          </section>
        </div>

        <section aria-labelledby="plan-grid-title">
          <h2 id="plan-grid-title" className="text-sm font-semibold text-text-primary">Change plan</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {PLANS.map((entry) => {
              const isCurrent = entry.id === currentPlanId;
              return (
                <div
                  key={entry.id}
                  className={`relative flex flex-col rounded-lg border bg-surface p-5 ${
                    entry.recommended ? 'border-primary-600' : 'border-border'
                  }`}
                >
                  {isCurrent ? (
                    <span className="absolute -top-3 left-5 rounded-full bg-primary-700 px-2.5 py-0.5 text-xs font-medium text-white">
                      Current plan
                    </span>
                  ) : null}
                  <h3 className="text-base font-semibold text-text-primary">{entry.name}</h3>
                  <p className="mt-1">
                    <span className="text-xl font-semibold tracking-tight text-text-primary">
                      {entry.priceLabel}
                    </span>
                    {entry.pricePkr > 0 ? (
                      <span className="text-xs text-text-muted">{entry.period}</span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">{entry.description}</p>
                  <div className="mt-4 flex-1">
                    {isCurrent ? (
                      <p className="text-xs text-text-muted">You are on this plan.</p>
                    ) : entry.pricePkr === 0 ? (
                      canManageBilling ? (
                        <button
                          type="button"
                          className="h-9 w-full rounded-md border border-border bg-surface text-sm font-medium transition hover:bg-surface-muted disabled:opacity-60"
                          disabled={switchPending}
                          onClick={() => setDowngradeOpen(true)}
                        >
                          Switch to Free
                        </button>
                      ) : (
                        <p className="text-xs text-text-muted">
                          The pharmacy owner can switch to the Free plan.
                        </p>
                      )
                    ) : (
                      <button
                        type="button"
                        className="h-9 w-full rounded-md bg-primary-600 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-60"
                        disabled={pendingPayment !== null}
                        onClick={() => openPayDialog(entry)}
                      >
                        Subscribe
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="payment-history-title">
          <h2 id="payment-history-title" className="text-sm font-semibold text-text-primary">
            Payment history
          </h2>
          {payments.length === 0 ? (
            <p className="mt-3 text-sm text-text-muted">No payments submitted yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-bg-card">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-text-muted">
                    <th scope="col" className="px-4 py-3 font-medium">Submitted</th>
                    <th scope="col" className="px-4 py-3 font-medium">Plan</th>
                    <th scope="col" className="px-4 py-3 font-medium">Method</th>
                    <th scope="col" className="px-4 py-3 font-medium">Amount</th>
                    <th scope="col" className="px-4 py-3 font-medium">Reference</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-b border-border-subtle last:border-0">
                      <td className="px-4 py-3 text-text-secondary">{formatDate(payment.submittedAt)}</td>
                      <td className="px-4 py-3 font-medium text-text-primary">{payment.plan}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{formatPKR(payment.amountPkr)}</td>
                      <td className="px-4 py-3 text-text-secondary">{payment.reference}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${PAYMENT_STATUS_CHIP[payment.status] ?? 'bg-bg-subtle text-text-muted'}`}>
                          {payment.status}
                        </span>
                        {payment.status === 'REJECTED' && payment.rejectionReason ? (
                          <p className="mt-1 max-w-56 text-xs text-status-critical-fg">{payment.rejectionReason}</p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    );
  }

  const selectedMethod = methods.find((method) => method.method === payMethod) ?? null;

  return (
    <AppShell
      userName={session?.user.fullName ?? ''}
      userRole={activePharmacy?.role ?? null}
      pharmacyName={activePharmacy?.pharmacyName ?? null}
      isPlatformAdmin={session?.isPlatformAdmin ?? false}
      onLogout={handleLogout}
      logoutPending={logoutPending}
    >
      <div className="space-y-5">
        <header>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">Subscription</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            Your plan, usage and payment verification
          </p>
        </header>
        {renderContent()}
      </div>

      <Modal
        open={payTarget !== null}
        title={payTarget ? `Subscribe to ${payTarget.name}` : 'Subscribe'}
        onClose={() => {
          if (!payPending) setPayTarget(null);
        }}
        pending={payPending}
        size="md"
      >
        {payTarget ? (
          <div className="mt-2 space-y-4">
            <p className="text-sm text-text-secondary">
              Send{' '}
              <span className="font-semibold text-text-primary">{formatPKR(payTarget.pricePkr)}</span>{' '}
              for one month of the {payTarget.name} plan, then submit the payment details below.
              Our team verifies payments manually, usually within a day.
            </p>

            {methods.length === 0 ? (
              <p className="rounded-md border border-status-warning-fg/40 bg-status-warning-bg p-3 text-sm text-status-warning-fg">
                No payment methods are configured yet. Please contact support.
              </p>
            ) : (
              <>
                <label className="block">
                  <span className="text-sm font-medium text-text-primary">Payment method</span>
                  <select
                    className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    value={payMethod}
                    onChange={(event) => setPayMethod(event.target.value as PaymentMethodId | '')}
                  >
                    <option value="">Select a method…</option>
                    {methods.map((method) => (
                      <option key={method.method} value={method.method}>{method.label}</option>
                    ))}
                  </select>
                </label>

                {selectedMethod ? (
                  <div className="rounded-md border border-border bg-surface-muted p-3 text-sm">
                    <p className="font-medium text-text-primary">{selectedMethod.label}</p>
                    <p className="mt-1 text-text-secondary">
                      Account name: <span className="font-medium text-text-primary">{selectedMethod.accountName}</span>
                    </p>
                    <p className="text-text-secondary">
                      {selectedMethod.bankName ? `${selectedMethod.bankName} - ` : ''}
                      Account number:{' '}
                      <span className="font-medium text-text-primary">{selectedMethod.accountNumber}</span>
                    </p>
                    <p className="mt-2 text-xs text-text-muted">{selectedMethod.instructions}</p>
                  </div>
                ) : null}

                <label className="block">
                  <span className="text-sm font-medium text-text-primary">Transaction / reference number</span>
                  <input
                    type="text"
                    className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    value={payReference}
                    maxLength={100}
                    placeholder="e.g. TID from your confirmation SMS"
                    onChange={(event) => setPayReference(event.target.value)}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-text-primary">
                    Payment proof (optional screenshot)
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="mt-1 block w-full text-sm text-text-secondary file:mr-3 file:rounded-md file:border-0 file:bg-surface-muted file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-border-subtle"
                    onChange={(event) => setPayProof(event.target.files?.[0] ?? null)}
                  />
                  <span className="mt-1 block text-xs text-text-muted">
                    JPEG, PNG or WebP up to 5 MB - speeds up verification.
                  </span>
                </label>
              </>
            )}

            {payError ? (
              <p role="alert" className="rounded-md border border-status-critical-fg/40 bg-status-critical-bg p-2.5 text-sm text-status-critical-fg">
                {payError}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPayTarget(null)}
                disabled={payPending}
                className="h-9 min-w-24 rounded-md border border-border bg-surface px-4 text-sm font-medium transition hover:bg-surface-muted disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handlePaySubmit()}
                disabled={payPending || methods.length === 0}
                className="h-9 min-w-32 rounded-md bg-primary-600 px-4 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-60"
              >
                {payPending ? 'Submitting…' : 'Submit payment'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={downgradeOpen}
        title="Switch to the Free plan?"
        onClose={() => {
          if (!switchPending) setDowngradeOpen(false);
        }}
        pending={switchPending}
        size="sm"
      >
        <p className="mt-2 text-sm text-text-secondary">
          The Free plan allows up to 500 medicines, 1 user and 50 AI scans per month. Your
          existing data stays fully accessible, but you will not be able to create more records
          beyond these limits until you upgrade again.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setDowngradeOpen(false)}
            disabled={switchPending}
            className="h-9 min-w-24 rounded-md border border-border bg-surface px-4 text-sm font-medium transition hover:bg-surface-muted disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleDowngrade()}
            disabled={switchPending}
            className="h-9 min-w-24 rounded-md bg-primary-600 px-4 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-60"
          >
            {switchPending ? 'Switching…' : 'Switch to Free'}
          </button>
        </div>
      </Modal>
    </AppShell>
  );
}
