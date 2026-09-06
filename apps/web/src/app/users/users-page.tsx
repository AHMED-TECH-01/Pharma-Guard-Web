'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MemberListResponse, MemberListItem, UserRole } from '@pharmaguard/types';
import { api, fetchSession, type SessionData } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Modal } from '@/components/ui/modal';
import { formatDate } from '@/lib/format';
import { InviteDialog, type InviteFormValues } from '@/components/users/invite-dialog';

/**
 * Team roster (PRD §10.21 Settings > Roles, ui-registry Phase 12). Owners
 * manage roles and membership; managers can view. Self-changes are blocked
 * client-side and server-side, and the role matrix documents each role's
 * capabilities.
 */

const ROLE_OPTIONS: UserRole[] = ['OWNER', 'MANAGER', 'PHARMACIST', 'STAFF'];

const STATUS_CHIP: Record<string, string> = {
  active: 'bg-status-safe-bg text-status-safe-fg',
  invited: 'bg-status-warning-bg text-status-warning-fg',
  suspended: 'bg-status-critical-bg text-status-critical-fg',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  invited: 'Invited',
  suspended: 'Suspended',
};

const ROLE_MATRIX: Array<{ role: UserRole; summary: string }> = [
  { role: 'OWNER', summary: 'Full control: team, pharmacy settings, billing contact, everything below' },
  { role: 'MANAGER', summary: 'Runs operations: inventory, sales, purchases, analytics, reports, audit read' },
  { role: 'PHARMACIST', summary: 'Day-to-day stock: inventory edits, sales, expiry actions, returns, OCR' },
  { role: 'STAFF', summary: 'Counter access: record sales, view stock and alerts' },
];

const SELECT_CLASS =
  'h-8 rounded-md border border-border bg-card px-2 text-xs text-text-primary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50';

export default function UsersPage() {
  const router = useRouter();

  const [session, setSession] = useState<SessionData | null>(null);
  const [checked, setChecked] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);

  const [data, setData] = useState<MemberListResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitePending, setInvitePending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<MemberListItem | null>(null);

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
  const canRead = session?.permissions.includes('users.read') ?? false;
  const canManage = session?.permissions.includes('users.manage') ?? false;
  const currentUserId = session?.user.userId ?? null;

  const loadMembers = useCallback(
    (signal?: AbortSignal) => {
      if (!pharmacyId) return;
      api
        .get<MemberListResponse>('/users', { pharmacyId, signal })
        .then((response) => {
          if (!signal?.aborted) {
            setData(response);
            setLoadError(null);
          }
        })
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          setLoadError(error instanceof Error ? error.message : 'Unable to load the team roster.');
        });
    },
    [pharmacyId],
  );

  useEffect(() => {
    if (!checked || !pharmacyId || !canRead) return;
    const controller = new AbortController();
    loadMembers(controller.signal);
    return () => controller.abort();
  }, [checked, pharmacyId, canRead, loadMembers]);

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

  async function handleInvite(values: InviteFormValues) {
    if (!pharmacyId) throw new Error('No pharmacy selected.');
    setInvitePending(true);
    try {
      const result = await api.post<{ member: MemberListItem; inviteLink: string | null }>(
        '/users',
        values,
        { pharmacyId },
      );
      loadMembers(new AbortController().signal);
      return result;
    } finally {
      setInvitePending(false);
    }
  }

  async function handleUpdate(member: MemberListItem, patch: { role?: string; status?: string }) {
    if (!pharmacyId) return;
    setRowBusy(member.userId);
    setActionError(null);
    try {
      await api.patch(`/users/${member.userId}`, patch, { pharmacyId });
      loadMembers(new AbortController().signal);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not update the member.');
    } finally {
      setRowBusy(null);
    }
  }

  async function handleRemove() {
    if (!pharmacyId || !removeTarget) return;
    setRowBusy(removeTarget.userId);
    setActionError(null);
    try {
      await api.delete(`/users/${removeTarget.userId}`, { pharmacyId });
      setRemoveTarget(null);
      loadMembers(new AbortController().signal);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not remove the member.');
    } finally {
      setRowBusy(null);
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
          description="Create or select a pharmacy before managing the team."
        />
      );
    }
    if (!canRead) {
      return (
        <EmptyState
          title="No access to the team roster"
          description="Ask the pharmacy owner for the users.read permission."
        />
      );
    }
    if (loadError) {
      return (
        <ErrorState
          title="The team roster could not load"
          description={loadError}
          onRetry={() => loadMembers(new AbortController().signal)}
        />
      );
    }
    if (!data || data.members.length === 0) {
      return (
        <EmptyState
          title="No members yet"
          description="Add pharmacists and staff so they can record sales and manage stock."
          action={
            canManage ? (
              <button
                type="button"
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
                onClick={() => setInviteOpen(true)}
              >
                Add member
              </button>
            ) : null
          }
        />
      );
    }

    return (
      <div className="space-y-5">
        {actionError ? (
          <div role="alert" className="rounded-lg border border-status-critical-fg/40 bg-status-critical-bg p-3 text-sm text-status-critical-fg">
            {actionError}
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-lg border border-border bg-bg-card">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-text-muted">
                <th scope="col" className="px-4 py-3 font-medium">Member</th>
                <th scope="col" className="px-4 py-3 font-medium">Phone</th>
                <th scope="col" className="px-4 py-3 font-medium">Role</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Joined</th>
                {canManage ? <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">Actions</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {data.members.map((member) => {
                const isSelf = member.userId === currentUserId;
                const editable = canManage && !isSelf;
                return (
                  <tr key={member.userId} className="border-b border-border-subtle last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-text-primary">
                        {member.fullName ?? 'Unnamed member'}
                        {isSelf ? <span className="ml-1.5 text-xs font-normal text-text-muted">(you)</span> : null}
                      </div>
                      <div className="text-xs text-text-muted">{member.email ?? 'Email hidden'}</div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{member.phone ?? '—'}</td>
                    <td className="px-4 py-3">
                      {editable ? (
                        <select
                          aria-label={`Role for ${member.fullName ?? member.email ?? 'member'}`}
                          className={SELECT_CLASS}
                          value={member.role}
                          disabled={rowBusy === member.userId}
                          onChange={(event) => void handleUpdate(member, { role: event.target.value })}
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-medium text-text-primary">{member.role}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CHIP[member.status] ?? 'bg-bg-subtle text-text-muted'}`}>
                        {STATUS_LABEL[member.status] ?? member.status}
                      </span>
                      {editable && member.status !== 'invited' ? (
                        <select
                          aria-label={`Status for ${member.fullName ?? member.email ?? 'member'}`}
                          className={`${SELECT_CLASS} ml-2`}
                          value={member.status}
                          disabled={rowBusy === member.userId}
                          onChange={(event) => void handleUpdate(member, { status: event.target.value })}
                        >
                          <option value="active">Set active</option>
                          <option value="suspended">Suspend</option>
                        </select>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{formatDate(member.joinedAt)}</td>
                    {canManage ? (
                      <td className="px-4 py-3 text-right">
                        {editable ? (
                          <button
                            type="button"
                            className="rounded-md border border-status-critical-fg/40 px-2.5 py-1 text-xs font-medium text-status-critical-fg transition hover:bg-status-critical-bg disabled:opacity-60"
                            disabled={rowBusy === member.userId}
                            onClick={() => setRemoveTarget(member)}
                          >
                            Remove
                          </button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <section aria-labelledby="role-matrix-title" className="rounded-lg border border-border bg-bg-card p-4">
          <h2 id="role-matrix-title" className="text-sm font-semibold text-text-primary">Role permissions</h2>
          <ul className="mt-3 space-y-2.5">
            {ROLE_MATRIX.map((entry) => (
              <li key={entry.role} className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                <span className="w-24 shrink-0 rounded-full bg-primary-50 px-2 py-0.5 text-center text-xs font-semibold text-primary-800">
                  {entry.role}
                </span>
                <span className="text-sm text-text-secondary">{entry.summary}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-text-muted">
            You cannot change your own role or status, and the last active owner cannot be demoted
            or removed - this keeps the pharmacy reachable at all times.
          </p>
        </section>
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
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-text-primary">Users</h1>
            <p className="mt-0.5 text-sm text-text-muted">
              {canRead && data ? `${data.members.length} member${data.members.length === 1 ? '' : 's'}` : 'Team, roles, and access'}
            </p>
          </div>
          {canManage ? (
            <button
              type="button"
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
              onClick={() => setInviteOpen(true)}
            >
              Add member
            </button>
          ) : null}
        </header>
        {renderContent()}
      </div>

      <InviteDialog
        open={inviteOpen}
        pending={invitePending}
        onSubmit={handleInvite}
        onClose={() => setInviteOpen(false)}
      />

      <Modal
        open={removeTarget !== null}
        title="Remove member"
        onClose={() => setRemoveTarget(null)}
        pending={rowBusy !== null}
        size="sm"
      >
        <p className="mt-2 text-sm text-text-secondary">
          Remove{' '}
          <span className="font-medium text-text-primary">
            {removeTarget?.fullName ?? removeTarget?.email ?? 'this member'}
          </span>{' '}
          from {activePharmacy?.pharmacyName ?? 'the pharmacy'}? They lose access immediately; their
          past audit entries remain.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setRemoveTarget(null)}
            disabled={rowBusy !== null}
            className="h-9 min-w-24 rounded-md border border-border bg-surface px-4 text-sm font-medium transition hover:bg-surface-muted disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleRemove()}
            disabled={rowBusy !== null}
            className="h-9 min-w-24 rounded-md bg-status-critical-fg px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {rowBusy ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </Modal>
    </AppShell>
  );
}
