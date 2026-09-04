'use client';

import { useEffect, useState } from 'react';
import { SettingsPage } from '@/components/settings/settings-page';

/**
 * Appearance settings (PRD §10.21, build-plan Phase 12): device-local
 * display preferences persisted to localStorage ('pg.appearance') and
 * applied app-wide via classes set before first paint (layout.tsx).
 */

interface AppearancePrefs {
  compactTables: boolean;
  reduceMotion: boolean;
}

const DEFAULTS: AppearancePrefs = { compactTables: false, reduceMotion: false };
const STORAGE_KEY = 'pg.appearance';

/** Reads device-local prefs; safe as a lazy initializer because this form
 * mounts only client-side, after the session gate renders it. */
function readStoredPrefs(): AppearancePrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppearancePrefs>;
      return {
        compactTables: parsed.compactTables === true,
        reduceMotion: parsed.reduceMotion === true,
      };
    }
  } catch {
    // Corrupt storage falls back to defaults.
  }
  return DEFAULTS;
}

const CHECKBOX_CLASS =
  'size-4 rounded border-border text-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500';

function applyToDocument(prefs: AppearancePrefs): void {
  document.documentElement.classList.toggle('pg-compact', prefs.compactTables);
  document.documentElement.classList.toggle('pg-reduce-motion', prefs.reduceMotion);
}

function AppearanceForm() {
  const [prefs, setPrefs] = useState<AppearancePrefs>(readStoredPrefs);

  // Class changes are the external-system sync; idempotent on re-runs.
  useEffect(() => {
    applyToDocument(prefs);
  }, [prefs]);

  function update(patch: Partial<AppearancePrefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private browsing may block storage; the session still applies.
    }
  }

  const OPTIONS: Array<{ key: keyof AppearancePrefs; label: string; description: string }> = [
    {
      key: 'compactTables',
      label: 'Compact tables',
      description: 'Tighter rows in data tables so more stock fits on screen.',
    },
    {
      key: 'reduceMotion',
      label: 'Reduce motion',
      description: 'Minimise animations and transitions across the app.',
    },
  ];

  return (
    <div className="max-w-lg space-y-4 rounded-lg border border-border bg-bg-card p-5">
      <fieldset className="space-y-3">
        <legend className="sr-only">Display preferences</legend>
        {OPTIONS.map((option) => (
          <label
            key={option.key}
            htmlFor={`appearance-${option.key}`}
            className="flex cursor-pointer items-start gap-3 rounded-md border border-border-subtle p-3 transition hover:bg-surface-muted"
          >
            <input
              id={`appearance-${option.key}`}
              type="checkbox"
              className={`${CHECKBOX_CLASS} mt-0.5`}
              checked={prefs[option.key]}
              onChange={(event) => update({ [option.key]: event.target.checked })}
            />
            <span>
              <span className="block text-sm font-medium text-text-primary">{option.label}</span>
              <span className="mt-0.5 block text-xs text-text-muted">{option.description}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="text-xs text-text-muted">
        These preferences are saved on this device only and apply immediately.
      </p>
    </div>
  );
}

export default function AppearanceSettingsPage() {
  return (
    <SettingsPage title="Appearance" description="Display preferences for this device.">
      {() => <AppearanceForm />}
    </SettingsPage>
  );
}
