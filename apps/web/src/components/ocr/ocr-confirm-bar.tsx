'use client';

import Link from 'next/link';

/**
 * OCRConfirmBar (ui-registry §6): Confirm & Add plus Discard, with the
 * manual-entry fallback (TRD §33: AI must fall back to manual entry).
 */

export interface OCRConfirmBarProps {
  onConfirm: () => void;
  onDiscard: () => void;
  /** Confirm creates inventory (medicine + batch) - the slow step. */
  pending?: boolean;
  discardPending?: boolean;
  /** Some fields cannot be created as-is (e.g. empty medicine name). */
  confirmDisabled?: boolean;
}

export function OCRConfirmBar({
  onConfirm,
  onDiscard,
  pending = false,
  discardPending = false,
  confirmDisabled = false,
}: OCRConfirmBarProps) {
  const busy = pending || discardPending;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-text-secondary">
        <p className="font-medium text-text-primary">Confirm &amp; add to inventory</p>
        <p>Creates the medicine and batch from the values above.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/inventory?add=1"
          className="h-9 rounded-md border border-border bg-surface px-4 text-sm font-medium leading-9 text-text-primary transition hover:bg-surface-muted"
        >
          Add manually
        </Link>
        <button
          type="button"
          onClick={onDiscard}
          disabled={busy}
          className="h-9 rounded-md border border-border bg-surface px-4 text-sm font-medium transition hover:bg-surface-muted disabled:opacity-60"
        >
          {discardPending ? 'Discarding…' : 'Discard'}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy || confirmDisabled}
          className="h-9 rounded-md bg-primary-600 px-5 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-60"
        >
          {pending ? 'Adding…' : 'Confirm & Add'}
        </button>
      </div>
    </div>
  );
}
