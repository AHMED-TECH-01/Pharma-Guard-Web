'use client';

import { Modal } from '@/components/ui/modal';

export interface ConfirmSaleDialogProps {
  open: boolean;
  mode: 'create' | 'reverse';
  pending: boolean;
  summary: { label: string; value: string }[];
  onConfirm: () => void;
  onClose: () => void;
}

const PRIMARY_BUTTON =
  'rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60';
const DANGER_BUTTON =
  'rounded-lg bg-status-critical-fg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60';
const SECONDARY_BUTTON =
  'rounded-lg border border-border bg-card px-4 py-2 text-sm text-text-primary transition hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Confirmation step before a sale is recorded or reversed (registry §9).
 * `create` shows the full sale summary; `reverse` warns that stock returns
 * to the batch and the action is final.
 */
export function ConfirmSaleDialog({
  open,
  mode,
  pending,
  summary,
  onConfirm,
  onClose,
}: ConfirmSaleDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      pending={pending}
      size="sm"
      title={mode === 'create' ? 'Confirm sale' : 'Reverse sale'}
    >
      <div className="space-y-4">
        <dl className="space-y-2 rounded-lg border border-subtle bg-subtle p-4 text-sm">
          {summary.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-4">
              <dt className="shrink-0 text-text-secondary">{row.label}</dt>
              <dd className="text-right font-medium text-text-primary">{row.value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-text-muted">
          {mode === 'create'
            ? 'Confirming records the sale and immediately decrements the selected batch.'
            : 'The sold quantity returns to its batch and the reversal is written to the audit trail. This cannot be undone.'}
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className={SECONDARY_BUTTON} onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button
            type="button"
            className={mode === 'create' ? PRIMARY_BUTTON : DANGER_BUTTON}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? 'Working…' : mode === 'create' ? 'Record sale' : 'Reverse sale'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
