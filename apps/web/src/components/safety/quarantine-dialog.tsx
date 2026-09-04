'use client';

import { useState } from 'react';
import type { QuarantineListItem, QuarantineResolution } from '@pharmaguard/types';
import { Modal } from '@/components/ui/modal';

/**
 * QuarantineDialog (ui-registry §9): resolves a quarantined batch by
 * releasing it back to stock, returning it to the supplier, or removing it
 * from stock. Removal (destructive) demands a reason for the audit trail.
 */

const RESOLUTION_OPTIONS: { value: QuarantineResolution; label: string; description: string }[] = [
  {
    value: 'RELEASE',
    label: 'Release to stock',
    description: 'Batch returns to AVAILABLE and is sellable again.',
  },
  {
    value: 'RETURN',
    label: 'Return to supplier',
    description: 'Batch is marked RETURNED for supplier credit.',
  },
  {
    value: 'REMOVE',
    label: 'Remove from stock',
    description: 'Batch is destroyed or written off and leaves inventory.',
  },
];

interface QuarantineDialogProps {
  item: QuarantineListItem | null;
  onClose: () => void;
  onConfirm: (resolution: QuarantineResolution, reason: string) => Promise<void>;
}

export function QuarantineDialog({ item, onClose, onConfirm }: QuarantineDialogProps) {
  const [resolution, setResolution] = useState<QuarantineResolution>('RELEASE');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = RESOLUTION_OPTIONS.find((option) => option.value === resolution);

  async function confirm() {
    const trimmed = reason.trim();
    if (resolution === 'REMOVE' && trimmed.length < 3) {
      setError('Removing stock demands a reason of at least 3 characters for the audit trail.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onConfirm(resolution, trimmed);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Action failed.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={item !== null}
      title="Resolve quarantined batch"
      onClose={onClose}
      pending={pending}
    >
      {item ? (
        <div className="mt-2 space-y-4">
          <p className="text-sm text-text-muted">
            {item.medicineName} · batch {item.batchNo} · {item.quantity} unit
            {item.quantity === 1 ? '' : 's'}
          </p>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-text-primary">Resolution</legend>
            {RESOLUTION_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-2.5 rounded-md border p-3 transition ${
                  resolution === option.value
                    ? 'border-primary-500 bg-primary-50/50'
                    : 'border-border hover:bg-surface-muted'
                }`}
              >
                <input
                  type="radio"
                  name="quarantine-resolution"
                  value={option.value}
                  checked={resolution === option.value}
                  onChange={() => setResolution(option.value)}
                  className="mt-0.5 accent-primary-600"
                />
                <span>
                  <span className="block text-sm font-medium text-text-primary">{option.label}</span>
                  <span className="mt-0.5 block text-xs text-text-muted">{option.description}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <div>
            <label htmlFor="quarantine-reason" className="text-sm font-medium text-text-primary">
              Note{' '}
              <span className="font-normal text-text-muted">
                {resolution === 'REMOVE' ? '(required for removal)' : '(optional)'}
              </span>
            </label>
            <textarea
              id="quarantine-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={2}
              maxLength={500}
              placeholder="e.g. Verified intact after recall inspection"
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-faint focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-status-critical-fg">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="h-9 rounded-md border border-border bg-surface px-4 text-sm font-medium text-text-primary transition hover:bg-surface-muted disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={pending}
              className={`inline-flex h-9 items-center rounded-md px-4 text-sm font-medium text-white transition disabled:opacity-60 ${
                resolution === 'REMOVE'
                  ? 'bg-status-critical-fg hover:opacity-90'
                  : 'bg-primary-600 hover:bg-primary-700'
              }`}
            >
              {pending ? 'Applying…' : selected?.label ?? 'Confirm'}
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
