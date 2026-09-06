'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { AuditListResponse, AuditUsersResponse } from '@pharmaguard/types';
import { api, fetchSession, type SessionData } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Pagination } from '@/components/ui/pagination';
import { AuditTimeline } from '@/components/audit/audit-timeline';
import { formatRelativeTime } from '@/lib/format';

/**
 * Full audit timeline (/compliance/audit, PRD §10.19): filterable, paginated
 * audit trail plus per-user activity over the last 30 days. OWNER/MANAGER
 * (audit.read).
 */

interface AppliedFilters {
  action: string;
  userId: string;
  from: string;
  to: string;
  page: number;
}

const EMPTY_FILTERS: AppliedFilters = { action: '', userId: '', from: '', to: '', page: 1 };

const inputClasses =
  'h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

export function AuditPage() {
  const router = useRouter();

  const [session, setSession] = useState<SessionData | null>(null);
  const [checked, setChecked] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);

  const [draft, setDraft] = useState<AppliedFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<AppliedFilters>(EMPTY_FILTERS);
  const [entries, setEntries] = useState<AuditListResponse | null>(null);
  const [users, setUsers] = useState<AuditUsersResponse | null>(null);
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

  const loadEntries = useCallback(
    (signal?: AbortSignal) => {
      if (!pharmacyId) return;
      const params = new URLSearchParams();
      if (applied.action) params.set('action', applied.action);
      if (applied.userId) params.set('userId', applied.userId);
      if (applied.from) params.set('from', applied.from);
      if (applied.to) params.set('to', applied.to);
      params.set('page', String(applied.page));
      params.set('pageSize', '20');
      api
        .get<AuditListResponse>(`/audit?${params.toString()}`, { pharmacyId, signal })
        .then((response) => {
          if (signal?.aborted) return;
          setEntries(response);
          setError(null);
        })
        .catch((cause: unknown) => {
          if (signal?.aborted) return;
          setError(cause instanceof Error ? cause.message : 'Unable to load the audit timeline.');
        });
    },
    [pharmacyId, applied],
  );

  useEffect(() => {
    if (!checked || !pharmacyId || !canRead) return;
    const controller = new AbortController();
    loadEntries(controller.signal);
    return () => controller.abort();
  }, [checked, pharmacyId, canRead, loadEntries]);

  useEffect(() => {
    if (!checked || !pharmacyId || !canRead) return;
    const controller = new AbortController();
    api
      .get<AuditUsersResponse>('/audit/users', { pharmacyId, signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) setUsers(response);
      })
      .catch(() => {
        // Activity summary is supplementary; the timeline still loads.
      });
    return () => controller.abort();
  }, [checked, pharmacyId, canRead]);

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
          title="No pharmacy selected"
          description="Create or select a pharmacy before viewing the audit timeline."
        />
      );
    }
    if (!canRead) {
      return (
        <EmptyState
          title="No access to the audit timeline"
          description="Audit records are available to the pharmacy owner and managers."
        />
      );
    }

    const totalPages =
      entries === null ? 0 : Math.max(1, Math.ceil(entries.total / entries.pageSize));

    return (
      <div className="space-y-6">
        {users && users.users.length > 0 ? (
          <section className="rounded-lg border border-border-subtle bg-bg-card p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-text-primary">User activity</h2>
              <span className="text-xs text-text-faint">Last {users.windowDays} days</span>
            </div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {users.users.slice(0, 6).map((user) => (
                <li
                  key={user.userId ?? 'system'}
                  className="rounded-full bg-bg-subtle px-2.5 py-1 text-xs font-medium text-text-secondary"
                  title={user.lastActiveAt ? `Last active ${formatRelativeTime(user.lastActiveAt)}` : undefined}
                >
                  {user.actorName ?? 'Unknown user'}: {user.actionCount} actions
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            setEntries(null);
            setError(null);
            setApplied({ ...draft, page: 1 });
          }}
        >
          <label className="flex flex-col gap-1.5 text-xs font-medium text-text-muted">
            Action starts with
            <input
              className={inputClasses}
              value={draft.action}
              placeholder="e.g. sale."
              onChange={(event) => setDraft({ ...draft, action: event.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-text-muted">
            User
            <select
              className={inputClasses}
              value={draft.userId}
              onChange={(event) => setDraft({ ...draft, userId: event.target.value })}
            >
              <option value="">All users</option>
              {users?.users
                .filter((user) => user.userId !== null)
                .map((user) => (
                  <option key={user.userId} value={user.userId ?? ''}>
                    {user.actorName ?? 'Unknown user'}
                  </option>
                ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-text-muted">
            From
            <input
              type="date"
              className={inputClasses}
              value={draft.from}
              onChange={(event) => setDraft({ ...draft, from: event.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-text-muted">
            To
            <input
              type="date"
              className={inputClasses}
              value={draft.to}
              onChange={(event) => setDraft({ ...draft, to: event.target.value })}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-primary-600 px-4 text-sm font-medium text-white transition hover:bg-primary-700"
            >
              Apply
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-surface px-3 text-sm font-medium text-text-primary transition hover:bg-bg-subtle"
              onClick={() => {
                setDraft(EMPTY_FILTERS);
                setEntries(null);
                setApplied(EMPTY_FILTERS);
              }}
            >
              Reset
            </button>
          </div>
        </form>

        {error ? (
          <ErrorState
            title="Could not load the audit timeline"
            description={error}
            onRetry={() => loadEntries(new AbortController().signal)}
          />
        ) : !entries ? (
          <p className="text-sm text-text-muted" aria-busy="true">
            Loading audit timeline…
          </p>
        ) : (
          <section className="rounded-lg border border-border-subtle bg-bg-card p-5">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-text-primary">Audit timeline</h2>
              <Link
                href="/compliance"
                className="text-xs font-medium text-primary-600 hover:text-primary-700"
              >
                Back to compliance
              </Link>
            </div>
            <AuditTimeline entries={entries.entries} />
            <div className="mt-5">
              <Pagination
                page={entries.page}
                totalPages={totalPages}
                total={entries.total}
                pageSize={entries.pageSize}
                disabled={false}
                onPageChange={(page) => {
                  setEntries(null);
                  setApplied((current) => ({ ...current, page }));
                }}
              />
            </div>
          </section>
        )}
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
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">Audit timeline</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            Every recorded action, newest first - filter by action, user and window
          </p>
        </header>
        {renderContent()}
      </div>
    </AppShell>
  );
}
