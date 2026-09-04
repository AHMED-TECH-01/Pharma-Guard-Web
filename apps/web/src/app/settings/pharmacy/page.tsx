'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PharmacySettings } from '@pharmaguard/types';
import { SettingsPage } from '@/components/settings/settings-page';
import { EmptyState } from '@/components/ui/states';
import { api, type SessionData } from '@/lib/api';

/**
 * Pharmacy information (PRD §10.21). Every member can view; only the owner
 * (settings.manage) can edit. Currency is display-only - it is chosen at
 * onboarding and kept stable so historical amounts stay meaningful.
 */

const INPUT_CLASS =
  'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-faint focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-surface-muted disabled:text-text-secondary';
const LABEL_CLASS = 'mb-1 block text-sm font-medium text-text-secondary';

function PharmacyForm({ session }: { session: SessionData }) {
  const pharmacyId = session.activePharmacy?.pharmacyId ?? null;
  const canManage = session.permissions.includes('settings.manage');

  const [settings, setSettings] = useState<PharmacySettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback((signal?: AbortSignal) => {
    if (!pharmacyId) return;
    api
      .get<PharmacySettings>('/settings/pharmacy', { pharmacyId, signal })
      .then((response) => {
        if (signal?.aborted) return;
        setSettings(response);
        setLoadError(null);
        setName(response.name);
        setOwnerName(response.ownerName ?? '');
        setPhone(response.phone ?? '');
        setEmail(response.email ?? '');
        setAddress(response.address ?? '');
      })
      .catch((cause: unknown) => {
        if (signal?.aborted) return;
        setLoadError(cause instanceof Error ? cause.message : 'Unable to load pharmacy details.');
      });
  }, [pharmacyId]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function submit() {
    if (!pharmacyId) return;
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      await api.patch(
        '/settings/pharmacy',
        {
          name: name.trim(),
          ownerName: ownerName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim(),
        },
        { pharmacyId },
      );
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update pharmacy details.');
    } finally {
      setPending(false);
    }
  }

  if (!settings) {
    return (
      <div className="flex min-h-56 items-center justify-center" aria-busy="true">
        <p className="text-sm text-text-muted">{loadError ?? 'Loading pharmacy details…'}</p>
      </div>
    );
  }

  return (
    <form
      className="max-w-lg space-y-4 rounded-lg border border-border bg-bg-card p-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (canManage) void submit();
      }}
    >
      <div>
        <label className={LABEL_CLASS} htmlFor="pharmacy-name">Pharmacy name *</label>
        <input
          id="pharmacy-name"
          className={INPUT_CLASS}
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={!canManage}
          required
        />
      </div>
      <div>
        <label className={LABEL_CLASS} htmlFor="pharmacy-owner">Owner name</label>
        <input
          id="pharmacy-owner"
          className={INPUT_CLASS}
          value={ownerName}
          onChange={(event) => setOwnerName(event.target.value)}
          disabled={!canManage}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL_CLASS} htmlFor="pharmacy-phone">Phone</label>
          <input
            id="pharmacy-phone"
            type="tel"
            className={INPUT_CLASS}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            disabled={!canManage}
          />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="pharmacy-email">Email</label>
          <input
            id="pharmacy-email"
            type="email"
            className={INPUT_CLASS}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={!canManage}
          />
        </div>
      </div>
      <div>
        <label className={LABEL_CLASS} htmlFor="pharmacy-address">Address</label>
        <textarea
          id="pharmacy-address"
          rows={2}
          className={INPUT_CLASS}
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          disabled={!canManage}
        />
      </div>
      <div>
        <label className={LABEL_CLASS} htmlFor="pharmacy-currency">Currency</label>
        <input
          id="pharmacy-currency"
          className={INPUT_CLASS}
          value={settings.currency}
          disabled
        />
        <p className="mt-1 text-xs text-text-muted">Set at onboarding; shown on all money fields.</p>
      </div>
      {canManage ? (
        <>
          {saved ? (
            <p role="status" className="text-sm font-medium text-status-safe-fg">Pharmacy details updated.</p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-status-critical-fg">{error}</p>
          ) : null}
          <button
            type="submit"
            disabled={pending || name.trim().length < 2}
            className="h-9 min-w-28 rounded-md bg-primary-600 px-4 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-60"
          >
            {pending ? 'Saving…' : 'Save changes'}
          </button>
        </>
      ) : (
        <p className="text-xs text-text-muted">
          Only the pharmacy owner can change these details.
        </p>
      )}
    </form>
  );
}

export default function PharmacySettingsPage() {
  return (
    <SettingsPage
      title="Pharmacy information"
      description="Details shown across the workspace and on exports."
    >
      {(session) => {
        if (!session.activePharmacy) {
          return (
            <EmptyState
              title="No pharmacy selected"
              description="Create or select a pharmacy before editing its details."
            />
          );
        }
        return <PharmacyForm key={session.activePharmacy.pharmacyId} session={session} />;
      }}
    </SettingsPage>
  );
}
