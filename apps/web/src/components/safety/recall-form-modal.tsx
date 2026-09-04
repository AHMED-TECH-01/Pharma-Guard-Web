'use client';

import { useState } from 'react';
import type { RecallDetail } from '@pharmaguard/types';
import { api } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { MedicineSearchSelect, type MedicineOption } from './medicine-search-select';

/**
 * RecallFormModal: registers a recall (PRD §10.16). A recall targets a
 * medicine and/or a batch number so affected stock can be matched by the
 * server; manufacturer and reason give the audit trail its context.
 */

const inputClasses =
  'h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-faint focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

interface RecallFormModalProps {
  open: boolean;
  pharmacyId: string;
  onClose: () => void;
  onCreated: () => void;
}

export function RecallFormModal({ open, pharmacyId, onClose, onCreated }: RecallFormModalProps) {
  const [medicine, setMedicine] = useState<MedicineOption | null>(null);
  const [batchNo, setBatchNo] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!medicine && !batchNo.trim()) {
      setError('Select a medicine or provide a batch number so affected stock can be matched.');
      return;
    }
    const payload: Record<string, string> = {};
    if (medicine) payload.medicineId = medicine.id;
    if (batchNo.trim()) payload.batchNo = batchNo.trim();
    if (manufacturer.trim()) payload.manufacturer = manufacturer.trim();
    if (reason.trim()) payload.reason = reason.trim();

    setPending(true);
    setError(null);
    try {
      await api.post<{ recall: RecallDetail }>('/recalls', payload, { pharmacyId });
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to register the recall.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Register recall"
      onClose={onClose}
      pending={pending}
      size="lg"
    >
      <div className="mt-2 space-y-4">
        <div>
          <label className="text-sm font-medium text-text-primary">Medicine</label>
          <div className="mt-1">
            <MedicineSearchSelect
              pharmacyId={pharmacyId}
              value={medicine}
              onChange={setMedicine}
              disabled={pending}
            />
          </div>
          <p className="mt-1 text-xs text-text-muted">
            Leave empty to target a batch number across all medicines.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="recall-batch-no" className="text-sm font-medium text-text-primary">
              Batch no.
            </label>
            <input
              id="recall-batch-no"
              type="text"
              value={batchNo}
              onChange={(event) => setBatchNo(event.target.value)}
              maxLength={100}
              disabled={pending}
              placeholder="e.g. BT-2231"
              className={`mt-1 ${inputClasses}`}
            />
          </div>
          <div>
            <label htmlFor="recall-manufacturer" className="text-sm font-medium text-text-primary">
              Manufacturer
            </label>
            <input
              id="recall-manufacturer"
              type="text"
              value={manufacturer}
              onChange={(event) => setManufacturer(event.target.value)}
              maxLength={255}
              disabled={pending}
              placeholder="e.g. Global Pharma Ltd"
              className={`mt-1 ${inputClasses}`}
            />
          </div>
        </div>

        <div>
          <label htmlFor="recall-reason" className="text-sm font-medium text-text-primary">
            Reason
          </label>
          <textarea
            id="recall-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            maxLength={1000}
            disabled={pending}
            placeholder="e.g. DRAP alert DR-2026-11 - contamination in listed lots"
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
            onClick={submit}
            disabled={pending}
            className="inline-flex h-9 items-center rounded-md bg-primary-600 px-4 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-60"
          >
            {pending ? 'Registering…' : 'Register recall'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
