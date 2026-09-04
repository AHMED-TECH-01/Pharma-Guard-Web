'use client';

import { useState, type FormEvent } from 'react';
import type { Medicine, PotentialDuplicate } from '@pharmaguard/types';
import { createMedicineSchema, updateMedicineSchema } from '@pharmaguard/validation';
import { api, ApiClientError } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { DuplicateWarning } from './duplicate-warning';

/**
 * Add/Edit medicine form (PRD §10.7). Client-side validation mirrors the
 * shared schema; duplicate candidates from a 409 render DuplicateWarning
 * and require explicit confirmation before creation (PRD §12).
 */

const inputClasses =
  'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-faint focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

interface FormValues {
  name: string;
  genericName: string;
  strength: string;
  dosageForm: string;
  manufacturer: string;
  barcode: string;
  category: string;
  reorderLevel: string;
  safetyStock: string;
  purchasePrice: string;
  sellingPrice: string;
}

const EMPTY_FORM: FormValues = {
  name: '',
  genericName: '',
  strength: '',
  dosageForm: '',
  manufacturer: '',
  barcode: '',
  category: '',
  reorderLevel: '0',
  safetyStock: '0',
  purchasePrice: '',
  sellingPrice: '',
};

function toOptionalNumber(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

interface MedicineFormModalProps {
  open: boolean;
  /** Present = edit mode. */
  medicine?: Medicine | null;
  onClose: () => void;
  onSaved: () => void;
}

export function MedicineFormModal({ open, medicine, onClose, onSaved }: MedicineFormModalProps) {
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<PotentialDuplicate[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Re-seed the form each time the modal opens for a different target.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const seedKey = open ? (medicine?.id ?? 'new') : null;
  if (open && seedKey !== seededFor) {
    setSeededFor(seedKey);
    setFieldErrors({});
    setFormError(null);
    setDuplicates(null);
    setValues(
      medicine
        ? {
            name: medicine.name,
            genericName: medicine.genericName ?? '',
            strength: medicine.strength ?? '',
            dosageForm: medicine.dosageForm ?? '',
            manufacturer: medicine.manufacturer ?? '',
            barcode: medicine.barcode ?? '',
            category: medicine.category ?? '',
            reorderLevel: String(medicine.reorderLevel),
            safetyStock: String(medicine.safetyStock),
            purchasePrice: medicine.purchasePrice === null ? '' : String(medicine.purchasePrice),
            sellingPrice: medicine.sellingPrice === null ? '' : String(medicine.sellingPrice),
          }
        : EMPTY_FORM,
    );
  }

  function setField(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function buildPayload(confirmDuplicate: boolean) {
    const parsed = {
      name: values.name,
      genericName: values.genericName || undefined,
      strength: values.strength || undefined,
      dosageForm: values.dosageForm || undefined,
      manufacturer: values.manufacturer || undefined,
      barcode: values.barcode || undefined,
      category: values.category || undefined,
      reorderLevel: toOptionalNumber(values.reorderLevel) ?? 0,
      safetyStock: toOptionalNumber(values.safetyStock) ?? 0,
      purchasePrice: toOptionalNumber(values.purchasePrice),
      sellingPrice: toOptionalNumber(values.sellingPrice),
      ...(confirmDuplicate ? { confirmDuplicate: true } : {}),
    };
    return parsed;
  }

  function collectIssues(issues: { path: (string | number)[]; message: string }[]) {
    const errors: Record<string, string> = {};
    for (const issue of issues) {
      const key = issue.path[0];
      if (typeof key === 'string' && !errors[key]) errors[key] = issue.message;
    }
    setFieldErrors(errors);
  }

  async function submit(event: FormEvent<HTMLFormElement>, confirmDuplicate = false) {
    event.preventDefault();
    setFormError(null);

    const payload = buildPayload(confirmDuplicate);
    const schema = medicine ? updateMedicineSchema : createMedicineSchema;
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      collectIssues(parsed.error.issues);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);

    try {
      if (medicine) {
        await api.patch(`/medicines/${medicine.id}`, parsed.data);
      } else {
        await api.post('/medicines', parsed.data);
      }
      setSubmitting(false);
      onSaved();
    } catch (error) {
      setSubmitting(false);
      if (error instanceof ApiClientError && error.status === 409) {
        const details = error.details as { potentialDuplicates?: PotentialDuplicate[] } | undefined;
        if (!medicine && details?.potentialDuplicates?.length) {
          setDuplicates(details.potentialDuplicates);
          return;
        }
      }
      setFormError(error instanceof Error ? error.message : 'Unable to save the medicine.');
    }
  }

  const label = (id: keyof FormValues, text: string) => (
    <label htmlFor={`medicine-${id}`} className="mb-1.5 block text-sm font-medium text-text-primary">
      {text}
      {fieldErrors[id] ? <span className="ml-1 text-status-critical-fg">- {fieldErrors[id]}</span> : null}
    </label>
  );

  return (
    <Modal
      open={open}
      title={medicine ? 'Edit medicine' : 'Add medicine'}
      onClose={onClose}
      pending={submitting}
      size="lg"
    >
      {!medicine && duplicates ? (
        <div className="mb-4">
          <DuplicateWarning
            duplicates={duplicates}
            pendingName={values.name}
            pending={submitting}
            onCancel={() => setDuplicates(null)}
            onConfirmCreate={() => {
              setDuplicates(null);
              void submit({ preventDefault: () => undefined } as FormEvent<HTMLFormElement>, true);
            }}
          />
        </div>
      ) : null}

      {formError ? (
        <p role="alert" className="mb-4 rounded-md bg-status-critical-bg px-3 py-2 text-sm text-status-critical-fg">
          {formError}
        </p>
      ) : null}

      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            {label('name', 'Medicine name *')}
            <input
              id="medicine-name"
              type="text"
              value={values.name}
              onChange={(event) => setField('name', event.target.value)}
              placeholder="e.g. Panadol"
              className={inputClasses}
            />
          </div>
          <div>
            {label('genericName', 'Generic name')}
            <input
              id="medicine-genericName"
              type="text"
              value={values.genericName}
              onChange={(event) => setField('genericName', event.target.value)}
              placeholder="e.g. Paracetamol"
              className={inputClasses}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            {label('strength', 'Strength')}
            <input
              id="medicine-strength"
              type="text"
              value={values.strength}
              onChange={(event) => setField('strength', event.target.value)}
              placeholder="500mg"
              className={inputClasses}
            />
          </div>
          <div>
            {label('dosageForm', 'Dosage form')}
            <input
              id="medicine-dosageForm"
              type="text"
              value={values.dosageForm}
              onChange={(event) => setField('dosageForm', event.target.value)}
              placeholder="Tablet"
              className={inputClasses}
            />
          </div>
          <div>
            {label('category', 'Category')}
            <input
              id="medicine-category"
              type="text"
              value={values.category}
              onChange={(event) => setField('category', event.target.value)}
              placeholder="Analgesic"
              className={inputClasses}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            {label('manufacturer', 'Manufacturer')}
            <input
              id="medicine-manufacturer"
              type="text"
              value={values.manufacturer}
              onChange={(event) => setField('manufacturer', event.target.value)}
              placeholder="GSK"
              className={inputClasses}
            />
          </div>
          <div>
            {label('barcode', 'Barcode')}
            <input
              id="medicine-barcode"
              type="text"
              value={values.barcode}
              onChange={(event) => setField('barcode', event.target.value)}
              className={inputClasses}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            {label('reorderLevel', 'Reorder level *')}
            <input
              id="medicine-reorderLevel"
              type="number"
              min="0"
              value={values.reorderLevel}
              onChange={(event) => setField('reorderLevel', event.target.value)}
              className={inputClasses}
            />
          </div>
          <div>
            {label('safetyStock', 'Safety stock')}
            <input
              id="medicine-safetyStock"
              type="number"
              min="0"
              value={values.safetyStock}
              onChange={(event) => setField('safetyStock', event.target.value)}
              className={inputClasses}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            {label('purchasePrice', 'Purchase price (PKR)')}
            <input
              id="medicine-purchasePrice"
              type="number"
              min="0"
              step="0.01"
              value={values.purchasePrice}
              onChange={(event) => setField('purchasePrice', event.target.value)}
              className={inputClasses}
            />
          </div>
          <div>
            {label('sellingPrice', 'Selling price (PKR)')}
            <input
              id="medicine-sellingPrice"
              type="number"
              min="0"
              step="0.01"
              value={values.sellingPrice}
              onChange={(event) => setField('sellingPrice', event.target.value)}
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
            {submitting ? 'Saving…' : medicine ? 'Save changes' : 'Add medicine'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
