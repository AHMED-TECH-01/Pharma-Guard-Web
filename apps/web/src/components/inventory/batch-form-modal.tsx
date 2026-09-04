'use client';

import { useState, type FormEvent } from 'react';
import type { Batch } from '@pharmaguard/types';
import { createBatchSchema, updateBatchSchema } from '@pharmaguard/validation';
import { api } from '@/lib/api';
import { Modal } from '@/components/ui/modal';

/**
 * Add/Edit batch form (PRD §10.7 "Batch view"). Batch-number conflicts
 * surface as 409 from the DB constraint and render inline.
 */

const inputClasses =
  'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-faint focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

interface FormValues {
  batchNo: string;
  expiryDate: string;
  manufacturingDate: string;
  quantity: string;
  receivedDate: string;
  purchasePrice: string;
}

const EMPTY_FORM: FormValues = {
  batchNo: '',
  expiryDate: '',
  manufacturingDate: '',
  quantity: '0',
  receivedDate: '',
  purchasePrice: '',
};

interface BatchFormModalProps {
  open: boolean;
  medicineId: string;
  /** Present = edit mode (descriptive fields only; quantity changes go through adjustments). */
  batch?: Batch | null;
  onClose: () => void;
  onSaved: () => void;
}

export function BatchFormModal({ open, medicineId, batch, onClose, onSaved }: BatchFormModalProps) {
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [seededFor, setSeededFor] = useState<string | null>(null);
  const seedKey = open ? (batch?.id ?? 'new') : null;
  if (open && seedKey !== seededFor) {
    setSeededFor(seedKey);
    setFieldErrors({});
    setFormError(null);
    setValues(
      batch
        ? {
            batchNo: batch.batchNo,
            expiryDate: batch.expiryDate,
            manufacturingDate: batch.manufacturingDate ?? '',
            quantity: String(batch.quantity),
            receivedDate: batch.receivedDate ?? '',
            purchasePrice: batch.purchasePrice === null ? '' : String(batch.purchasePrice),
          }
        : EMPTY_FORM,
    );
  }

  function setField(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const base = {
      batchNo: values.batchNo,
      expiryDate: values.expiryDate || undefined,
      manufacturingDate: values.manufacturingDate || undefined,
      quantity: Number(values.quantity),
      receivedDate: values.receivedDate || undefined,
      purchasePrice: values.purchasePrice.trim() === '' ? null : Number(values.purchasePrice),
    };

    const schema = batch ? updateBatchSchema : createBatchSchema;
    const parsed = schema.safeParse(base);
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
      if (batch) {
        await api.patch(`/batches/${batch.id}`, parsed.data);
      } else {
        await api.post(`/medicines/${medicineId}/batches`, parsed.data);
      }
      setSubmitting(false);
      onSaved();
      onClose();
    } catch (error) {
      setSubmitting(false);
      setFormError(error instanceof Error ? error.message : 'Unable to save the batch.');
    }
  }

  const label = (id: keyof FormValues, text: string, required = false) => (
    <label htmlFor={`batch-${id}`} className="mb-1.5 block text-sm font-medium text-text-primary">
      {text}
      {required ? ' *' : ''}
      {fieldErrors[id] ? <span className="ml-1 text-status-critical-fg">- {fieldErrors[id]}</span> : null}
    </label>
  );

  return (
    <Modal
      open={open}
      title={batch ? `Edit batch ${batch.batchNo}` : 'Add batch'}
      onClose={onClose}
      pending={submitting}
    >
      {formError ? (
        <p role="alert" className="mb-4 rounded-md bg-status-critical-bg px-3 py-2 text-sm text-status-critical-fg">
          {formError}
        </p>
      ) : null}

      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            {label('batchNo', 'Batch number', true)}
            <input
              id="batch-batchNo"
              type="text"
              value={values.batchNo}
              onChange={(event) => setField('batchNo', event.target.value)}
              placeholder="e.g. B-2451"
              className={inputClasses}
            />
          </div>
          <div>
            {label('expiryDate', 'Expiry date', true)}
            <input
              id="batch-expiryDate"
              type="date"
              value={values.expiryDate}
              onChange={(event) => setField('expiryDate', event.target.value)}
              className={inputClasses}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            {label('manufacturingDate', 'Manufacturing date')}
            <input
              id="batch-manufacturingDate"
              type="date"
              value={values.manufacturingDate}
              onChange={(event) => setField('manufacturingDate', event.target.value)}
              className={inputClasses}
            />
          </div>
          <div>
            {label('receivedDate', 'Received date')}
            <input
              id="batch-receivedDate"
              type="date"
              value={values.receivedDate}
              onChange={(event) => setField('receivedDate', event.target.value)}
              className={inputClasses}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            {label('quantity', batch ? 'Quantity (use Adjust for stock changes)' : 'Quantity', true)}
            <input
              id="batch-quantity"
              type="number"
              min="0"
              value={values.quantity}
              onChange={(event) => setField('quantity', event.target.value)}
              disabled={Boolean(batch)}
              className={inputClasses}
            />
          </div>
          <div>
            {label('purchasePrice', 'Purchase price (PKR)')}
            <input
              id="batch-purchasePrice"
              type="number"
              min="0"
              step="0.01"
              value={values.purchasePrice}
              onChange={(event) => setField('purchasePrice', event.target.value)}
              className={inputClasses}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
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
            {submitting ? 'Saving…' : batch ? 'Save changes' : 'Add batch'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
