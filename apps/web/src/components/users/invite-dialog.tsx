'use client';

import { useState } from 'react';
import type { InviteMemberResult } from '@pharmaguard/types';
import { Modal } from '@/components/ui/modal';

export interface InviteFormValues {
  email: string;
  role: 'MANAGER' | 'PHARMACIST' | 'STAFF';
}

interface InviteDialogProps {
  open: boolean;
  pending: boolean;
  /** Runs the API call; resolves with the created member (and link, if any). */
  onSubmit: (values: InviteFormValues) => Promise<InviteMemberResult>;
  onClose: () => void;
}

const INPUT_CLASS =
  'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-faint focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';
const LABEL_CLASS = 'mb-1 block text-sm font-medium text-text-secondary';

/**
 * Add team member dialog (PRD §10.21). Existing platform users are added
 * immediately; brand-new emails receive a one-time invite link shown here
 * for the owner to share manually (no SMTP dependency).
 */
export function InviteDialog({ open, pending, onSubmit, onClose }: InviteDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteFormValues['role']>('PHARMACIST');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteMemberResult | null>(null);
  const [copied, setCopied] = useState(false);

  function close() {
    setEmail('');
    setRole('PHARMACIST');
    setError(null);
    setResult(null);
    setCopied(false);
    onClose();
  }

  async function submit() {
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    try {
      const created = await onSubmit({ email: trimmed, role });
      setResult(created);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add the member.');
    }
  }

  async function copyLink() {
    if (!result?.inviteLink) return;
    try {
      await navigator.clipboard.writeText(result.inviteLink);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Modal open={open} title="Add team member" onClose={close} pending={pending}>
      {result ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-text-secondary">
            <span className="font-medium text-text-primary">{result.member.email ?? result.member.fullName ?? 'Member'}</span>{' '}
            was added as <span className="font-medium">{result.member.role}</span>.
          </p>
          {result.inviteLink ? (
            <div>
              <p className={LABEL_CLASS}>One-time invite link</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={result.inviteLink}
                  aria-label="Invite link"
                  className={`${INPUT_CLASS} truncate font-mono text-xs`}
                />
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  className="h-10 shrink-0 rounded-lg bg-primary-600 px-3 text-sm font-medium text-white transition hover:bg-primary-700"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-text-muted">
                The member was not emailed automatically. Share this link with them; it signs them
                in once to accept the invite.
              </p>
            </div>
          ) : (
            <p className="text-xs text-text-muted">
              This email already has a PharmaGuard account, so the member can sign in and switch to
              this pharmacy right away.
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={close}
              className="h-9 min-w-24 rounded-md border border-border bg-surface px-4 text-sm font-medium transition hover:bg-surface-muted"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div>
            <label className={LABEL_CLASS} htmlFor="invite-email">
              Email *
            </label>
            <input
              id="invite-email"
              type="email"
              autoComplete="email"
              className={INPUT_CLASS}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="colleague@pharmacy.com"
              required
            />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="invite-role">
              Role
            </label>
            <select
              id="invite-role"
              className={INPUT_CLASS}
              value={role}
              onChange={(event) => setRole(event.target.value as InviteFormValues['role'])}
            >
              <option value="MANAGER">Manager</option>
              <option value="PHARMACIST">Pharmacist</option>
              <option value="STAFF">Staff</option>
            </select>
            <p className="mt-1.5 text-xs text-text-muted">
              Every member has full access to normal features; only owners manage the team and
              membership. New members cannot be created as Owner - promote an existing member
              later if needed.
            </p>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-status-critical-fg">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={close}
              disabled={pending}
              className="h-9 min-w-24 rounded-md border border-border bg-surface px-4 text-sm font-medium transition hover:bg-surface-muted disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-9 min-w-24 rounded-md bg-primary-600 px-4 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-60"
            >
              {pending ? 'Adding…' : 'Add member'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
