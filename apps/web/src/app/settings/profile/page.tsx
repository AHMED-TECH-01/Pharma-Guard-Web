'use client';

import { useState } from 'react';
import { SettingsPage } from '@/components/settings/settings-page';
import { api, type SessionData } from '@/lib/api';

/**
 * Profile settings (PRD §10.21): self-service name and phone. The server
 * re-validates and audits the change. The form mounts only after the
 * session resolves, so fields can initialize directly from the session.
 */

const INPUT_CLASS =
  'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-faint focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';
const LABEL_CLASS = 'mb-1 block text-sm font-medium text-text-secondary';

function ProfileForm({ session }: { session: SessionData }) {
  const [fullName, setFullName] = useState(session.user.fullName);
  const [phone, setPhone] = useState(session.user.phone ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit() {
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      await api.patch(
        '/settings/profile',
        { fullName: fullName.trim(), phone: phone.trim() },
        { pharmacyId: session.activePharmacy?.pharmacyId },
      );
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update your profile.');
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
        <label className={LABEL_CLASS} htmlFor="profile-name">Full name *</label>
        <input
          id="profile-name"
          className={INPUT_CLASS}
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
        />
      </div>
      <div>
        <label className={LABEL_CLASS} htmlFor="profile-phone">Phone</label>
        <input
          id="profile-phone"
          type="tel"
          className={INPUT_CLASS}
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="+92 300 0000000"
        />
      </div>
      <p className="text-xs text-text-muted">
        Signed in as <span className="font-medium">{session.user.email}</span>
      </p>
      {saved ? (
        <p role="status" className="text-sm font-medium text-status-safe-fg">Profile updated.</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-status-critical-fg">{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending || fullName.trim().length === 0}
        className="h-9 min-w-28 rounded-md bg-primary-600 px-4 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}

export default function ProfileSettingsPage() {
  return (
    <SettingsPage title="Profile" description="Your name and contact details.">
      {(session) => <ProfileForm key={session.user.userId} session={session} />}
    </SettingsPage>
  );
}
