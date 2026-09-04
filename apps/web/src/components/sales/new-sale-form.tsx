'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Batch, MedicineDetail } from '@pharmaguard/types';
import { api } from '@/lib/api';
import { formatDate, formatPKR } from '@/lib/format';
import {
  MedicineSearchSelect,
  type MedicineOption,
} from '@/components/safety/medicine-search-select';
import { ConfirmSaleDialog } from './confirm-sale-dialog';

const INPUT_CLASS =
  'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-faint focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';
const LABEL_CLASS = 'mb-1 block text-sm font-medium text-text-secondary';

function daysUntil(dateIso: string): number {
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.floor(
    (new Date(`${dateIso.slice(0, 10)}T00:00:00Z`).getTime() - todayUtc) / 86_400_000,
  );
}

/** Value for a datetime-local input representing "now" in local time. */
function nowLocalInput(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function sellable(batches: Batch[]): Batch[] {
  return batches
    .filter((batch) => batch.status === 'AVAILABLE' && batch.quantity > 0)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}

/**
 * New sale flow (PRD §10.10, TRD §7 POST /sales): pick medicine, choose a
 * batch (FEFO pick preselected), quantity + price + time, confirm, record.
 * Batch availability is re-verified server-side at record time.
 */
export function NewSaleForm({ pharmacyId }: { pharmacyId: string }) {
  const [option, setOption] = useState<MedicineOption | null>(null);
  const [detail, setDetail] = useState<MedicineDetail | null>(null);
  const [detailPending, setDetailPending] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [batchId, setBatchId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [soldAtLocal, setSoldAtLocal] = useState(nowLocalInput());
  const [note, setNote] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ batchNo: string; totalAmount: number } | null>(null);

  const sellableBatches = detail ? sellable(detail.batches) : [];
  const selectedBatch = sellableBatches.find((batch) => batch.id === batchId) ?? null;
  const parsedQuantity = Number.parseInt(quantity, 10);
  const parsedPrice = Number.parseFloat(unitPrice);
  const total =
    Number.isFinite(parsedQuantity) && Number.isFinite(parsedPrice)
      ? parsedQuantity * parsedPrice
      : null;

  const fefoId = sellableBatches.find((batch) => daysUntil(batch.expiryDate) >= 0)?.id ?? null;

  async function handleMedicine(next: MedicineOption | null) {
    setOption(next);
    setDetail(null);
    setBatchId('');
    setQuantity('1');
    setUnitPrice('');
    setDetailError(null);
    setFormError(null);
    setCreated(null);
    if (!next) return;
    setDetailPending(true);
    try {
      const data = await api.get<MedicineDetail>(`/medicines/${next.id}`);
      setDetail(data);
      const available = sellable(data.batches);
      if (available.length > 0) setBatchId(available[0].id);
      if (data.medicine.sellingPrice !== null) setUnitPrice(String(data.medicine.sellingPrice));
    } catch (cause) {
      setDetailError(cause instanceof Error ? cause.message : 'Could not load medicine batches.');
    } finally {
      setDetailPending(false);
    }
  }

  function openConfirm() {
    setFormError(null);
    if (!selectedBatch) {
      setFormError('Select a batch to sell from.');
      return;
    }
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1) {
      setFormError('Quantity must be a whole number of at least 1.');
      return;
    }
    if (parsedQuantity > selectedBatch.quantity) {
      setFormError(`Only ${selectedBatch.quantity} unit(s) left in batch ${selectedBatch.batchNo}.`);
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setFormError('Enter a valid unit price.');
      return;
    }
    const soldAt = new Date(soldAtLocal);
    if (Number.isNaN(soldAt.getTime())) {
      setFormError('Enter a valid sale time.');
      return;
    }
    // Future sale times are rejected server-side (single source of truth).
    setConfirmOpen(true);
  }

  async function confirmSale() {
    if (!selectedBatch) return;
    setPending(true);
    setFormError(null);
    try {
      const response = await api.post<{ sale: { id: string; batchNo: string; totalAmount: number } }>(
        '/sales',
        {
          batchId: selectedBatch.id,
          quantity: parsedQuantity,
          unitPrice: parsedPrice,
          note: note.trim() ? note.trim() : undefined,
          soldAt: new Date(soldAtLocal).toISOString(),
        },
      );
      setConfirmOpen(false);
      setCreated({ batchNo: response.sale.batchNo, totalAmount: response.sale.totalAmount });
      setBatchId('');
      setQuantity('1');
      setNote('');
      const nextBatch = sellableBatches.find(
        (batch) => batch.id !== selectedBatch.id && batch.quantity >= parsedQuantity,
      );
      if (nextBatch) setBatchId(nextBatch.id);
    } catch (cause) {
      setConfirmOpen(false);
      setFormError(cause instanceof Error ? cause.message : 'Could not record the sale.');
    } finally {
      setPending(false);
    }
  }

  const summary = selectedBatch
    ? [
        { label: 'Medicine', value: option ? `${option.name}${option.strength ? ` ${option.strength}` : ''}` : '—' },
        { label: 'Batch', value: selectedBatch.batchNo },
        { label: 'Before Sale', value: String(selectedBatch.quantity) },
        { label: 'After Sale', value: String(selectedBatch.quantity - (Number.isInteger(parsedQuantity) ? parsedQuantity : 0)) },
        { label: 'Sold', value: String(Number.isInteger(parsedQuantity) ? parsedQuantity : 0) },
      ]
    : [];

  return (
    <div className="space-y-4">
      {created ? (
        <div className="rounded-lg border border-status-safe-fg/40 bg-status-safe-bg p-4 text-sm text-status-safe-fg">
          Sale recorded - {formatPKR(created.totalAmount)} from batch {created.batchNo}.{' '}
          <Link href="/sales" className="font-medium underline">
            View sales history
          </Link>
        </div>
      ) : null}

      {/* Reference composition: form card (2/3) + Sale Summary card (1/3). */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-border-subtle bg-bg-card p-5 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={LABEL_CLASS} htmlFor="sale-medicine">
                Medicine <span className="text-status-critical-fg">*</span>
              </label>
              <MedicineSearchSelect value={option} onChange={handleMedicine} pharmacyId={pharmacyId} />
              {detailPending ? <p className="mt-2 text-xs text-text-muted">Loading batches…</p> : null}
              {detailError ? <p className="mt-2 text-xs text-status-critical-fg">{detailError}</p> : null}
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor="sale-batch">
                Batch <span className="text-status-critical-fg">*</span>
              </label>
              <select
                id="sale-batch"
                className={INPUT_CLASS}
                value={batchId}
                onChange={(event) => setBatchId(event.target.value)}
                disabled={sellableBatches.length === 0}
              >
                {sellableBatches.length === 0 ? <option value="">No sellable batches</option> : null}
                {sellableBatches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batchNo} · exp {formatDate(batch.expiryDate)} · {batch.quantity} in stock
                    {batch.id === fefoId ? ' · FEFO' : ''}
                  </option>
                ))}
              </select>
              {sellableBatches.length === 0 && detail ? (
                <p className="mt-1 text-xs text-status-warning-fg">
                  Receive a purchase or release quarantined stock first.
                </p>
              ) : null}
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor="sale-price">
                Sale Price (PKR)
              </label>
              <input
                id="sale-price"
                type="number"
                min={0}
                step="0.01"
                className={INPUT_CLASS}
                value={unitPrice}
                onChange={(event) => setUnitPrice(event.target.value)}
                placeholder="Defaults to selling price"
              />
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor="sale-quantity">
                Quantity <span className="text-status-critical-fg">*</span>
              </label>
              <input
                id="sale-quantity"
                type="number"
                min={1}
                max={selectedBatch?.quantity ?? undefined}
                className={INPUT_CLASS}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
              {selectedBatch ? (
                <p className="mt-1 text-xs text-text-muted">Max {selectedBatch.quantity}</p>
              ) : null}
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor="sale-time">
                Date &amp; Time
              </label>
              <input
                id="sale-time"
                type="datetime-local"
                className={INPUT_CLASS}
                value={soldAtLocal}
                onChange={(event) => setSoldAtLocal(event.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <label className={LABEL_CLASS} htmlFor="sale-note">
                Note (Optional)
              </label>
              <textarea
                id="sale-note"
                rows={2}
                className={INPUT_CLASS}
                value={note}
                maxLength={500}
                placeholder="Customer, discount context, remarks…"
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          </div>

          <button
            type="button"
            className="mt-6 h-10 w-full rounded-md bg-primary-600 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-40"
            onClick={openConfirm}
            disabled={sellableBatches.length === 0}
          >
            Record Sale
          </button>
          {formError ? (
            <p className="mt-3 text-sm text-status-critical-fg" role="alert">
              {formError}
            </p>
          ) : null}
        </section>

        <aside
          aria-label="Sale summary"
          className="h-fit rounded-lg border border-border-subtle bg-bg-card p-5"
        >
          <h2 className="text-sm font-semibold text-text-primary">Sale Summary</h2>
          {selectedBatch ? (
            <>
              <dl className="mt-4 space-y-2.5 text-sm">
                {summary.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-2">
                    <dt className="text-text-muted">{row.label}</dt>
                    <dd className="font-medium text-text-primary">{row.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 border-t border-border-subtle pt-4">
                <p className="text-xs uppercase tracking-wide text-text-muted">Total Amount</p>
                <p className="mt-1 text-xl font-semibold text-text-primary">{formatPKR(total ?? 0)}</p>
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-text-muted">
              Select a medicine and batch to see the sale preview here.
            </p>
          )}
        </aside>
      </div>

      <ConfirmSaleDialog
        open={confirmOpen}
        mode="create"
        pending={pending}
        summary={summary}
        onConfirm={confirmSale}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
