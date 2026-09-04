'use client';

import { useState } from 'react';
import type { MedicineDetail, SupplierListItem } from '@pharmaguard/types';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import {
  MedicineSearchSelect,
  type MedicineOption,
} from '@/components/safety/medicine-search-select';
import { Modal } from '@/components/ui/modal';

export interface ReturnFormPayload {
  batchId: string;
  supplierId?: string;
  quantity: number;
  reason: 'EXPIRED' | 'DAMAGED' | 'RECALL' | 'INCORRECT_SHIPMENT' | 'OTHER';
  notes?: string;
}

interface ConfirmReturnDialogProps {
  open: boolean;
  pharmacyId: string;
  suppliers: SupplierListItem[];
  pending: boolean;
  onSubmit: (payload: ReturnFormPayload, summary: string) => void;
  onClose: () => void;
}

const INPUT_CLASS =
  'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-faint focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';
const LABEL_CLASS = 'mb-1 block text-sm font-medium text-text-secondary';
const selectClasses =
  'h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

const REASONS: { value: ReturnFormPayload['reason']; label: string }[] = [
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'RECALL', label: 'Recall' },
  { value: 'INCORRECT_SHIPMENT', label: 'Incorrect shipment' },
  { value: 'OTHER', label: 'Other' },
];

/**
 * Record-return dialog (registry §9 ConfirmReturnDialog, PRD §10.14):
 * pick medicine -> available batch, quantity capped at stock, reason,
 * optional supplier and notes. Stock is decremented only at approval.
 */
export function ConfirmReturnDialog({
  open,
  pharmacyId,
  suppliers,
  pending,
  onSubmit,
  onClose,
}: ConfirmReturnDialogProps) {
  const [option, setOption] = useState<MedicineOption | null>(null);
  const [batches, setBatches] = useState<{ id: string; label: string; quantity: number }[]>([]);
  const [batchId, setBatchId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState<ReturnFormPayload['reason']>('EXPIRED');
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedBatch = batches.find((batch) => batch.id === batchId) ?? null;

  function reset() {
    setOption(null);
    setBatches([]);
    setBatchId('');
    setQuantity('1');
    setReason('EXPIRED');
    setSupplierId('');
    setNotes('');
    setError(null);
  }

  async function handleMedicine(next: MedicineOption | null) {
    setOption(next);
    setBatches([]);
    setBatchId('');
    setError(null);
    if (!next) return;
    setLoading(true);
    try {
      const detail = await api.get<MedicineDetail>(`/medicines/${next.id}`);
      setBatches(
        detail.batches
          .filter((batch) => batch.status === 'AVAILABLE' && batch.quantity > 0)
          .map((batch) => ({
            id: batch.id,
            label: `${batch.batchNo} - exp ${formatDate(batch.expiryDate)} - ${batch.quantity} in stock`,
            quantity: batch.quantity,
          })),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load batches.');
    } finally {
      setLoading(false);
    }
  }

  function submit() {
    setError(null);
    if (!selectedBatch) {
      setError('Select a batch to return.');
      return;
    }
    const parsed = Number.parseInt(quantity, 10);
    if (!Number.isInteger(parsed) || parsed < 1) {
      setError('Quantity must be a whole number of at least 1.');
      return;
    }
    if (parsed > selectedBatch.quantity) {
      setError(`Only ${selectedBatch.quantity} unit(s) in this batch.`);
      return;
    }
    onSubmit(
      {
        batchId,
        supplierId: supplierId || undefined,
        quantity: parsed,
        reason,
        notes: notes.trim() || undefined,
      },
      `${option?.name ?? 'Medicine'} - ${selectedBatch.label.split(' - ')[0]} x ${parsed}`,
    );
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      pending={pending}
      size="md"
      title="Record return"
    >
      <div className="space-y-4">
        <div>
          <span className={LABEL_CLASS}>Medicine</span>
          <MedicineSearchSelect
            value={option}
            onChange={(next) => void handleMedicine(next)}
            pharmacyId={pharmacyId}
          />
        </div>

        {loading ? <p className="text-sm text-text-muted">Loading batches…</p> : null}

        {option ? (
          <>
            <div>
              <label className={LABEL_CLASS} htmlFor="return-batch">
                Batch
              </label>
              <select
                id="return-batch"
                className={selectClasses}
                value={batchId}
                onChange={(event) => setBatchId(event.target.value)}
              >
                <option value="">Select a batch…</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={LABEL_CLASS} htmlFor="return-qty">
                  Quantity
                </label>
                <input
                  id="return-qty"
                  type="number"
                  min={1}
                  max={selectedBatch?.quantity ?? undefined}
                  className={INPUT_CLASS}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </div>
              <div>
                <label className={LABEL_CLASS} htmlFor="return-reason">
                  Reason
                </label>
                <select
                  id="return-reason"
                  className={selectClasses}
                  value={reason}
                  onChange={(event) => setReason(event.target.value as ReturnFormPayload['reason'])}
                >
                  {REASONS.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={LABEL_CLASS} htmlFor="return-supplier">
                Supplier (optional)
              </label>
              <select
                id="return-supplier"
                className={selectClasses}
                value={supplierId}
                onChange={(event) => setSupplierId(event.target.value)}
              >
                <option value="">Not specified</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS} htmlFor="return-notes">
                Notes (optional)
              </label>
              <textarea
                id="return-notes"
                rows={2}
                className={INPUT_CLASS}
                value={notes}
                maxLength={500}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
          </>
        ) : null}

        {error ? (
          <p className="text-sm text-status-critical-fg" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-text-primary transition hover:bg-subtle disabled:opacity-60"
            onClick={() => {
              reset();
              onClose();
            }}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-60"
            onClick={submit}
            disabled={pending || !option}
          >
            {pending ? 'Recording…' : 'Record return'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
