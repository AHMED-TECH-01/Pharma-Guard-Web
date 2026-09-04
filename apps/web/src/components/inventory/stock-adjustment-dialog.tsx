'use client';

import { useState, type FormEvent } from 'react';
import type { Batch } from '@pharmaguard/types';
import { adjustStockSchema } from '@pharmaguard/validation';
import { api } from '@/lib/api';
import { Modal } from '@/components/ui/modal';

/**
 * StockAdjustmentDialog (ui-registry §9). Signed delta with a mandatory
 * reason; the API applies it and writes the audit trail (FR-031).
 */

interface StockAdjustmentDialogProps {
  open: boolean;
  batch: Batch | null;
  onClose: () => void;
  onAdjusted: () => void;
}

export function StockAdjustmentDialog({ open, batch, onClose, onAdjusted }: StockAdjustmentDialogProps) {
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function close() {
    setDelta('');
    setReason('');
    setFieldErrors({});
    setFormError(null);
    onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!batch) return;
    setFormError(null);

    const parsed = adjustStockSchema.safeParse({
      delta: Number(delta),
      reason,
    });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string' && !errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await api.post(`/batches/${batch.id}/adjust`, parsed.data);
      setSubmitting(false);
      onAdjusted();
      close();
    } catch (error) {
      setSubmitting(false);
      setFormError(error instanceof Error ? error.message : 'Unable to adjust stock.');
    }
  }

  const deltaNumber = Number(delta);
  const projected =
    batch && Number.isFinite(deltaNumber) && delta !== ''
      ? batch.quantity + deltaNumber
      : null;

  return (
    <Modal open={open && batch !== null} title="Adjust stock" onClose={close} pending={submitting} size="sm">
      {batch ? (
        <form onSubmit={submit} noValidate className="mt-4 space-y-4">
          <p className="text-sm text-text-muted">
            Batch <span className="font-medium text-text-primary">{batch.batchNo}</span> currently
            holds <span className="font-medium text-text-primary">{batch.quantity}</span> units.
          </p>

          {formError ? (
            <p role="alert" className="rounded-md bg-status-critical-bg px-3 py-2 text-sm text-status-critical-fg">
              {formError}
            </p>
          ) : null}

          <div>
            <label htmlFor="adjust-delta" className="mb-1.5 block text-sm font-medium text-text-primary">
              Adjustment (signed, e.g. 10 or -3)
              {fieldErrors.delta ? (
                <span className="ml-1 text-status-critical-fg">- {fieldErrors.delta}</span>
              ) : null}
            </label>
            <input
              id="adjust-delta"
              type="number"
              value={delta}
              onChange={(event) => setDelta(event.target.value)}
              placeholder="e.g. -2"
              className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
            {projected !== null ? (
              <p className={`mt-1.5 text-xs ${projected < 0 ? 'text-status-critical-fg' : 'text-text-muted'}`}>
                New quantity: {projected}
                {projected < 0 ? ' (below zero - not allowed)' : ''}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="adjust-reason" className="mb-1.5 block text-sm font-medium text-text-primary">
              Reason *
              {fieldErrors.reason ? (
                <span className="ml-1 text-status-critical-fg">- {fieldErrors.reason}</span>
              ) : null}
            </label>
            <textarea
              id="adjust-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={2}
              placeholder="e.g. Damaged units removed, stock count correction"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={close}
              disabled={submitting}
              className="h-9 rounded-md border border-border bg-surface px-4 text-sm font-medium transition hover:bg-surface-muted disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-9 rounded-md bg-primary-600 px-5 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-60"
            >
              {submitting ? 'Applying…' : 'Apply adjustment'}
            </button>
          </div>
        </form>
      ) : null}
    </Modal>
  );
}
