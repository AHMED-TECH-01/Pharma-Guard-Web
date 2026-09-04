'use client';

import { useEffect, useState } from 'react';
import type { NotificationPrefs } from '@pharmaguard/types';
import { SettingsPage } from '@/components/settings/settings-page';
import { api } from '@/lib/api';

/**
 * Notification preferences (PRD §10.21): which alert emails the account
 * receives. Stored as a validated JSON document on the profile (migration
 * 0007) and audited on change.
 */

const OPTIONS: Array<{ key: keyof NotificationPrefs; label: string; description: string }> = [
  {
    key: 'emailCritical',
    label: 'Critical alerts',
    description: 'Expired stock, open recalls, and high-severity safety alerts.',
  },
  {
    key: 'emailWarnings',
    label: 'Warnings',
    description: 'Near-expiry warnings, low stock, and medium/low severity alerts.',
  },
  {
    key: 'weeklyDigest',
    label: 'Weekly digest',
    description: 'A weekly summary of expiry risk, stock health, and activity.',
  },
];

const CHECKBOX_CLASS =
  'size-4 rounded border-border text-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500';

function NotificationsForm({ pharmacyId }: { pharmacyId: string | null }) {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<NotificationPrefs>('/settings/notifications', { pharmacyId: pharmacyId ?? undefined, signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) setPrefs(response);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(cause instanceof Error ? cause.message : 'Unable to load notification preferences.');
      });
    return () => controller.abort();
  }, [pharmacyId]);

  async function submit() {
    if (!prefs) return;
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      await api.patch(
        '/settings/notifications',
        prefs,
        { pharmacyId: pharmacyId ?? undefined },
      );
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save notification preferences.');
    } finally {
      setPending(false);
    }
  }

  if (!prefs) {
    return (
      <div className="flex min-h-56 items-center justify-center" aria-busy="true">
        <p className="text-sm text-text-muted">{loadError ?? 'Loading preferences…'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-4 rounded-lg border border-border bg-bg-card p-5">
      <fieldset className="space-y-3">
        <legend className="sr-only">Email notifications</legend>
        {OPTIONS.map((option) => (
          <label
            key={option.key}
            htmlFor={`notif-${option.key}`}
            className="flex cursor-pointer items-start gap-3 rounded-md border border-border-subtle p-3 transition hover:bg-surface-muted"
          >
            <input
              id={`notif-${option.key}`}
              type="checkbox"
              className={`${CHECKBOX_CLASS} mt-0.5`}
              checked={prefs[option.key]}
              onChange={(event) => {
                setPrefs({ ...prefs, [option.key]: event.target.checked });
                setSaved(false);
              }}
            />
            <span>
              <span className="block text-sm font-medium text-text-primary">{option.label}</span>
              <span className="mt-0.5 block text-xs text-text-muted">{option.description}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {saved ? (
        <p role="status" className="text-sm font-medium text-status-safe-fg">Preferences saved.</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-status-critical-fg">{error}</p>
      ) : null}
      <button
        type="button"
        onClick={() => void submit()}
        disabled={pending}
        className="h-9 min-w-28 rounded-md bg-primary-600 px-4 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Save preferences'}
      </button>
    </div>
  );
}

export default function NotificationSettingsPage() {
  return (
    <SettingsPage
      title="Notifications"
      description="Choose which emails this account receives. Critical safety emails stay on by default."
    >
      {(session) => (
        <NotificationsForm
          key={session.user.userId}
          pharmacyId={session.activePharmacy?.pharmacyId ?? null}
        />
      )}
    </SettingsPage>
  );
}
