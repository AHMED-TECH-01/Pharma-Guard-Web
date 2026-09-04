'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { MedicineDetail, SupplierListItem } from '@pharmaguard/types';
import { api } from '@/lib/api';
import { formatDate, formatPKR } from '@/lib/format';
import {
  MedicineSearchSelect,
  type MedicineOption,
} from '@/components/safety/medicine-search-select';
import { Modal } from '@/components/ui/modal';

const INPUT_CLASS =
  'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-faint focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';
const LABEL_CLASS = 'mb-1 block text-sm font-medium text-text-secondary';
const selectClasses =
  'h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

interface ItemDraft {
  key: number;
  option: MedicineOption | null;
  batchOptions: { id: string; label: string }[];
  mode: 'EXISTING' | 'NEW';
  batchId: string;
  batchNo: string;
  expiryDate: string;
  quantity: string;
  unitCost: string;
}

let itemKeyCounter = 0;

function emptyItem(): ItemDraft {
  itemKeyCounter += 1;
  return {
    key: itemKeyCounter,
    option: null,
    batchOptions: [],
    mode: 'EXISTING',
    batchId: '',
    batchNo: '',
    expiryDate: '',
    quantity: '1',
    unitCost: '',
  };
}

/**
 * Purchase receiving form (PRD §10.11, TRD §7 POST /purchases, TRD §13
 * Purchase transaction). Each line adds stock to an existing AVAILABLE
 * batch or creates a new one; the whole receive is atomic server-side.
 */
export function NewPurchaseForm({ pharmacyId }: { pharmacyId: string }) {
  const [supplierId, setSupplierId] = useState('');
  const [suppliers, setSuppliers] = useState<SupplierListItem[]>([]);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [note, setNote] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [rowPending, setRowPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const loadSuppliers = () => {
    api
      .get<{ suppliers: SupplierListItem[] }>('/suppliers', { pharmacyId })
      .then((response) => setSuppliers(response.suppliers))
      .catch(() => setSuppliers([])); // Receiving without a supplier stays possible.
  };

  async function handleMedicine(key: number, option: MedicineOption | null) {
    setItems((current) =>
      current.map((item) =>
        item.key === key
          ? { ...emptyItem(), key: item.key, option, quantity: item.quantity, unitCost: item.unitCost }
          : item,
      ),
    );
    if (!option) return;
    setRowPending(true);
    try {
      const detail = await api.get<MedicineDetail>(`/medicines/${option.id}`);
      const batches = detail.batches
        .filter((batch) => batch.status === 'AVAILABLE' && batch.quantity > 0)
        .map((batch) => ({
          id: batch.id,
          label: `${batch.batchNo} - exp ${formatDate(batch.expiryDate)} - ${batch.quantity} in stock`,
        }));
      setItems((current) =>
        current.map((item) =>
          item.key === key
            ? {
                ...item,
                batchOptions: batches,
                mode: batches.length > 0 ? 'EXISTING' : 'NEW',
                unitCost: item.unitCost || (detail.medicine.purchasePrice !== null ? String(detail.medicine.purchasePrice) : ''),
              }
            : item,
        ),
      );
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not load medicine batches.');
    } finally {
      setRowPending(false);
    }
  }

  function patchItem(key: number, patch: Partial<ItemDraft>) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function openConfirm() {
    setFormError(null);
    for (const item of items) {
      if (!item.option) {
        setFormError('Every line needs a medicine.');
        return;
      }
      if (item.mode === 'EXISTING' && !item.batchId) {
        setFormError('Pick a batch to add stock to, or switch the line to "New batch".');
        return;
      }
      if (item.mode === 'NEW' && (!item.batchNo.trim() || !item.expiryDate)) {
        setFormError('New batches need a batch number and expiry date.');
        return;
      }
      const quantity = Number.parseInt(item.quantity, 10);
      const cost = Number.parseFloat(item.unitCost);
      if (!Number.isInteger(quantity) || quantity < 1) {
        setFormError('Quantities must be whole numbers of at least 1.');
        return;
      }
      if (!Number.isFinite(cost) || cost < 0) {
        setFormError('Enter a valid unit cost for every line.');
        return;
      }
    }
    setConfirmOpen(true);
  }

  async function confirmPurchase() {
    setPending(true);
    setFormError(null);
    try {
      const response = await api.post<{ purchase: { id: string } }>(
        '/purchases',
        {
          supplierId: supplierId || undefined,
          invoiceNo: invoiceNo.trim() || undefined,
          note: note.trim() || undefined,
          items: items.map((item) => ({
            medicineId: item.option!.id,
            batchId: item.mode === 'EXISTING' ? item.batchId : undefined,
            batchNo: item.mode === 'NEW' ? item.batchNo.trim() : undefined,
            expiryDate: item.mode === 'NEW' ? item.expiryDate : undefined,
            quantity: Number.parseInt(item.quantity, 10),
            unitCost: Number.parseFloat(item.unitCost),
          })),
        },
        { pharmacyId },
      );
      setConfirmOpen(false);
      setCreatedId(response.purchase.id);
      setItems([emptyItem()]);
      setInvoiceNo('');
      setNote('');
    } catch (cause) {
      setConfirmOpen(false);
      setFormError(cause instanceof Error ? cause.message : 'Could not record the purchase.');
    } finally {
      setPending(false);
    }
  }

  const totalCost = items.reduce((sum, item) => {
    const quantity = Number.parseInt(item.quantity, 10);
    const cost = Number.parseFloat(item.unitCost);
    return sum + (Number.isInteger(quantity) && Number.isFinite(cost) ? quantity * cost : 0);
  }, 0);

  return (
    <div className="space-y-6">
      {createdId ? (
        <div className="rounded-lg border border-status-safe-fg/40 bg-status-safe-bg p-4 text-sm text-status-safe-fg">
          Purchase received and stock incremented.{' '}
          <Link href="/purchases" className="font-medium underline">
            View purchase history
          </Link>
        </div>
      ) : null}

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-text-primary">Supplier and invoice</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL_CLASS} htmlFor="purchase-supplier">
              Supplier
            </label>
            <select
              id="purchase-supplier"
              className={selectClasses}
              value={supplierId}
              onFocus={loadSuppliers}
              onChange={(event) => setSupplierId(event.target.value)}
            >
              <option value="">No supplier recorded</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-text-muted">
              Suppliers load from the register; manage them under Suppliers.
            </p>
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="purchase-invoice">
              Invoice number
            </label>
            <input
              id="purchase-invoice"
              className={INPUT_CLASS}
              value={invoiceNo}
              maxLength={120}
              placeholder="e.g. INV-2026-0193"
              onChange={(event) => setInvoiceNo(event.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">Items</h2>
          <button
            type="button"
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-text-primary transition hover:bg-subtle"
            onClick={() => setItems((current) => [...current, emptyItem()])}
          >
            + Add item
          </button>
        </div>

        {items.map((item, index) => (
          <div key={item.key} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-text-secondary">Item {index + 1}</p>
              {items.length > 1 ? (
                <button
                  type="button"
                  className="text-xs text-status-critical-fg hover:underline"
                  onClick={() => setItems((current) => current.filter((entry) => entry.key !== item.key))}
                >
                  Remove
                </button>
              ) : null}
            </div>

            <div className="mt-3 max-w-md">
              <MedicineSearchSelect
                value={item.option}
                onChange={(option) => void handleMedicine(item.key, option)}
                pharmacyId={pharmacyId}
              />
            </div>
            {rowPending && item.option ? (
              <p className="mt-2 text-xs text-text-muted">Loading batches…</p>
            ) : null}

            {item.option ? (
              <div className="mt-4 space-y-3">
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => patchItem(item.key, { mode: 'EXISTING' })}
                    disabled={item.batchOptions.length === 0}
                    className={`rounded-full px-3 py-1 font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      item.mode === 'EXISTING'
                        ? 'bg-primary-600 text-white'
                        : 'border border-border text-text-secondary hover:bg-subtle'
                    }`}
                  >
                    Add to existing batch
                  </button>
                  <button
                    type="button"
                    onClick={() => patchItem(item.key, { mode: 'NEW' })}
                    className={`rounded-full px-3 py-1 font-medium transition ${
                      item.mode === 'NEW'
                        ? 'bg-primary-600 text-white'
                        : 'border border-border text-text-secondary hover:bg-subtle'
                    }`}
                  >
                    New batch
                  </button>
                </div>

                {item.mode === 'EXISTING' ? (
                  <div>
                    <label className={LABEL_CLASS} htmlFor={`batch-${item.key}`}>
                      Batch
                    </label>
                    <select
                      id={`batch-${item.key}`}
                      className={selectClasses}
                      value={item.batchId}
                      onChange={(event) => patchItem(item.key, { batchId: event.target.value })}
                    >
                      <option value="">Select a batch…</option>
                      {item.batchOptions.map((batch) => (
                        <option key={batch.id} value={batch.id}>
                          {batch.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={LABEL_CLASS} htmlFor={`batchno-${item.key}`}>
                        Batch number
                      </label>
                      <input
                        id={`batchno-${item.key}`}
                        className={INPUT_CLASS}
                        value={item.batchNo}
                        maxLength={100}
                        onChange={(event) => patchItem(item.key, { batchNo: event.target.value })}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLASS} htmlFor={`expiry-${item.key}`}>
                        Expiry date
                      </label>
                      <input
                        id={`expiry-${item.key}`}
                        type="date"
                        className={INPUT_CLASS}
                        value={item.expiryDate}
                        onChange={(event) => patchItem(item.key, { expiryDate: event.target.value })}
                      />
                    </div>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={LABEL_CLASS} htmlFor={`qty-${item.key}`}>
                      Quantity
                    </label>
                    <input
                      id={`qty-${item.key}`}
                      type="number"
                      min={1}
                      className={INPUT_CLASS}
                      value={item.quantity}
                      onChange={(event) => patchItem(item.key, { quantity: event.target.value })}
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS} htmlFor={`cost-${item.key}`}>
                      Unit cost (PKR)
                    </label>
                    <input
                      id={`cost-${item.key}`}
                      type="number"
                      min={0}
                      step="0.01"
                      className={INPUT_CLASS}
                      value={item.unitCost}
                      placeholder="Defaults to purchase price"
                      onChange={(event) => patchItem(item.key, { unitCost: event.target.value })}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <div>
          <label className={LABEL_CLASS} htmlFor="purchase-note">
            Note (optional)
          </label>
          <textarea
            id="purchase-note"
            rows={2}
            className={INPUT_CLASS}
            value={note}
            maxLength={500}
            placeholder="Delivery remarks, discrepancies…"
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-subtle pt-4">
          <div>
            <p className="text-sm text-text-secondary">Total cost</p>
            <p className="text-xl font-semibold text-text-primary">{formatPKR(totalCost)}</p>
          </div>
          <button
            type="button"
            className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={openConfirm}
          >
            Review receiving
          </button>
        </div>
        {formError ? (
          <p className="mt-3 text-sm text-status-critical-fg" role="alert">
            {formError}
          </p>
        ) : null}
      </section>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        pending={pending}
        size="sm"
        title="Confirm receiving"
      >
        <div className="space-y-4">
          <dl className="space-y-2 rounded-lg border border-subtle bg-subtle p-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-text-secondary">Supplier</dt>
              <dd className="text-right font-medium text-text-primary">
                {suppliers.find((supplier) => supplier.id === supplierId)?.name ?? 'Not recorded'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-text-secondary">Invoice</dt>
              <dd className="text-right font-medium text-text-primary">{invoiceNo.trim() || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-text-secondary">Lines</dt>
              <dd className="text-right font-medium text-text-primary">{items.length}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-text-secondary">Total cost</dt>
              <dd className="text-right font-medium text-text-primary">{formatPKR(totalCost)}</dd>
            </div>
          </dl>
          <p className="text-xs text-text-muted">
            Confirming creates the purchase, increments or creates each batch, and writes the audit
            entry in one atomic transaction.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-text-primary transition hover:bg-subtle disabled:opacity-60"
              onClick={() => setConfirmOpen(false)}
              disabled={pending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-60"
              onClick={() => void confirmPurchase()}
              disabled={pending}
            >
              {pending ? 'Receiving…' : 'Receive stock'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
