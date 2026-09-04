'use client';

import type { OcrExtraction, OcrFieldKey } from '@pharmaguard/types';
import { OCRConfidence, OCRFieldEditor } from './ocr-field-editor';

/**
 * OCRResultCard (ui-registry §6): the review surface for one scan. Every
 * field is editable (PRD §10.6 "Editable fields") and shows its extraction
 * confidence so the pharmacist knows what to double-check (TRD §33).
 */

export type OcrFieldValues = Record<OcrFieldKey, string>;

export interface OCRResultCardProps {
  extraction: OcrExtraction;
  /** Scan-level confidence returned by the API (average across fields). */
  overallConfidence: number | null;
  values: OcrFieldValues;
  fieldErrors?: Partial<Record<OcrFieldKey, string>>;
  disabled?: boolean;
  onChange: (field: OcrFieldKey, value: string) => void;
}

const MEDICINE_FIELDS: OcrFieldKey[] = [
  'medicineName',
  'genericName',
  'strength',
  'dosageForm',
  'manufacturer',
];

const BATCH_FIELDS: OcrFieldKey[] = [
  'batchNumber',
  'manufacturingDate',
  'expiryDate',
];

export function OCRResultCard({
  extraction,
  overallConfidence,
  values,
  fieldErrors,
  disabled = false,
  onChange,
}: OCRResultCardProps) {
  const field = (key: OcrFieldKey) => (
    <OCRFieldEditor
      key={key}
      field={key}
      value={values[key]}
      confidence={extraction.confidence[key]}
      error={fieldErrors?.[key]}
      disabled={disabled}
      onChange={onChange}
    />
  );

  return (
    <div className="space-y-6 rounded-lg border border-border bg-surface p-5">
      <OCRConfidence value={overallConfidence} />

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Medicine
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {MEDICINE_FIELDS.map(field)}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Batch
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {BATCH_FIELDS.map(field)}
        </div>
      </section>

      <p className="text-xs text-text-faint">
        Missing fields were left empty on purpose - the AI never invents values
        (TRD §33). Enter anything the camera missed before confirming.
      </p>
    </div>
  );
}
