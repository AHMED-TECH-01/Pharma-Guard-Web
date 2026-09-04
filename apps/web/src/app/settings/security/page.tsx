'use client';

import { useState } from 'react';
import { SettingsPage } from '@/components/settings/settings-page';
import { api } from '@/lib/api';

/**
 * Security settings (PRD §10.21): password change with re-authentication.
 * The server verifies the current password before applying the new one and
 * writes security.password_changed to the audit timeline.
 */

const INPUT_CLASS =
  'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-faint focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';
const LABEL_CLASS = 'mb-1 block text-sm font-medium text-text-secondary';

function validateNewPassword(value: string): string | null {
  if (value.length < 10) return 'Use at least 10 characters.';
  if (!/[a-z]/.test(value)) return 'Include a lowercase letter.';
  if (!/[A-Z]/.test(value)) return 'Include an uppercase letter.';
  if (!/[0-9]/.test(value)) return 'Include a number.';
  return null;
}

function SecurityForm({ pharmacyId }: { pharmacyId: string | null }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit() {
    setError(null);
    setSaved(false);
    const problem = validateNewPassword(newPassword);
    if (problem) {
      setError(problem);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    setPending(true);
    try {
      await api.patch(
        '/settings/security/password',
        { currentPassword, newPassword },
        { pharmacyId: pharmacyId ?? undefined },
      );
      setSaved(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not change the password.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="max-w-lg space-y-4 rounded-lg border border-border bg-bg-card p-5"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div>
        <label className={LABEL_CLASS} htmlFor="current-password">Current password *</label>
        <input
          id="current-password"
          type="password"
          autoComplete="current-password"
          className={INPUT_CLASS}
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
        />
      </div>
      <div>
        <label className={LABEL_CLASS} htmlFor="new-password">New password *</label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          className={INPUT_CLASS}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
        />
        <p className="mt-1 text-xs text-text-muted">
          At least 10 characters with an uppercase letter, a lowercase letter, and a number.
        </p>
      </div>
      <div>
        <label className={LABEL_CLASS} htmlFor="confirm-password">Confirm new password *</label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          className={INPUT_CLASS}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />
      </div>
      {saved ? (
        <p role="status" className="text-sm font-medium text-status-safe-fg">
          Password changed. The update is recorded in the audit timeline.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-status-critical-fg">{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending || currentPassword.length === 0 || newPassword.length === 0}
        className="h-9 min-w-28 rounded-md bg-primary-600 px-4 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-60"
      >
        {pending ? 'Updating…' : 'Change password'}
      </button>
    </form>
  );
}

export default function SecuritySettingsPage() {
  return (
    <SettingsPage
      title="Security"
      description="Your password protects stock, sales, and compliance records."
    >
      {(session) => (
        <SecurityForm key={session.user.userId} pharmacyId={session.activePharmacy?.pharmacyId ?? null} />
      )}
    </SettingsPage>
  );
}
