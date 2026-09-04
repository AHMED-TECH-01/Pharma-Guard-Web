'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Pharmacy } from '@pharmaguard/types';
import { createPharmacySchema } from '@pharmaguard/validation';
import { api, fetchSession, type SessionData } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { AuthError } from '@/components/auth/auth-error';
import { ErrorState } from '@/components/ui/states';

/**
 * Pharmacy onboarding (PRD §7 - New Pharmacy journey, build-plan dashboard
 * prerequisite). Creates the pharmacy + OWNER membership via the Phase 1
 * RPC-backed endpoint, then hands the user to the dashboard.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [checked, setChecked] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);

  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchSession(controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      if (!data) {
        router.replace('/login');
        return;
      }
      setOwnerName((current) => current || data.user.fullName);
      setEmail((current) => current || data.user.email);
      setSession(data);
      setChecked(true);
    });
    return () => controller.abort();
  }, [router]);

  async function handleLogout() {
    setLogoutPending(true);
    try {
      await api.post('/auth/logout');
    } catch {
      // Same contract as dashboard: redirect still ends the visible session.
    }
    router.replace('/login');
    router.refresh();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = createPharmacySchema.safeParse({
      name,
      ownerName: ownerName || undefined,
      phone: phone || undefined,
      email: email || undefined,
      address: address || undefined,
    });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string' && !errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await api.post<{ pharmacy: Pharmacy }>('/onboarding/pharmacy', parsed.data);
      router.replace('/dashboard');
      router.refresh();
    } catch (error) {
      setSubmitting(false);
      setFormError(
        error instanceof Error ? error.message : 'Unable to create your pharmacy right now.',
      );
    }
  }

  const inputClasses =
    'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-faint focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-60';

  function labelWith(id: string, label: string, error?: string) {
    return (
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-text-primary">
        {label}
        {error ? <span className="ml-1 text-status-critical-fg">- {error}</span> : null}
      </label>
    );
  }

  if (!checked || !session) {
    return (
      <div className="flex min-h-dvh" aria-busy="true" aria-label="Loading session">
        <div className="hidden w-[230px] shrink-0 bg-primary-950 lg:block" />
        <div className="flex flex-1 flex-col">
          <div className="h-16 border-b border-border bg-surface" />
          <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">
            <ErrorState title="Loading…" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      userName={session.user.fullName}
      userRole={session.activePharmacy?.role ?? null}
      pharmacyName={session.activePharmacy?.pharmacyName ?? null}
      onLogout={handleLogout}
      logoutPending={logoutPending}
    >
      <div className="mx-auto max-w-2xl">
        <header className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">
            Set up your pharmacy
          </h1>
          <p className="mt-0.5 text-sm text-text-muted">
            You will be the owner. You can invite your team later in Users (Phase 10).
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="space-y-4 rounded-lg border border-border bg-bg-card p-6"
        >
          {formError ? <AuthError message={formError} /> : null}

          <div>
            {labelWith('pharmacy-name', 'Pharmacy name *', fieldErrors.name)}
            <input
              id="pharmacy-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Al-Shifa Pharmacy"
              autoComplete="organization"
              className={inputClasses}
            />
          </div>

          <div>
            {labelWith('owner-name', 'Owner name', fieldErrors.ownerName)}
            <input
              id="owner-name"
              type="text"
              value={ownerName}
              onChange={(event) => setOwnerName(event.target.value)}
              placeholder="Full name"
              autoComplete="name"
              className={inputClasses}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              {labelWith('phone', 'Phone', fieldErrors.phone)}
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+92 3XX XXXXXXX"
                autoComplete="tel"
                className={inputClasses}
              />
            </div>
            <div>
              {labelWith('email', 'Email', fieldErrors.email)}
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="pharmacy@example.com"
                autoComplete="email"
                className={inputClasses}
              />
            </div>
          </div>

          <div>
            {labelWith('address', 'Address', fieldErrors.address)}
            <textarea
              id="address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Street, city"
              rows={2}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-faint focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary-600 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-60 sm:w-auto sm:px-6"
          >
            {submitting ? 'Creating…' : 'Create pharmacy'}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
