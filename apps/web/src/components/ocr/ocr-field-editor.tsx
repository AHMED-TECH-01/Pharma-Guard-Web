'use client';

import type { OcrFieldKey } from '@pharmaguard/types';

/**
 * OCRFieldEditor (ui-registry §6) and OCRConfidence (ui-registry §6).
 *
 * Confidence is always shown next to editable fields (PRD §10.6): the AI
 * output is unverified until the user confirms (TRD §33), so uncertain
 * fields are visually flagged instead of hidden.
 */

export const OCR_FIELD_LABELS: Record<OcrFieldKey, string> = {
  medicineName: 'Medicine name',
  genericName: 'Generic name',
  strength: 'Strength',
  dosageForm: 'Dosage form',
  manufacturer: 'Manufacturer',
  batchNumber: 'Batch number',
  manufacturingDate: 'Manufacturing date',
  expiryDate: 'Expiry date',
};

/** Fields below this confidence are flagged as needing attention. */
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

const inputClasses =
  'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-faint focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

export interface OCRFieldEditorProps {
  field: OcrFieldKey;
  value: string;
  confidence?: number;
  error?: string;
  disabled?: boolean;
  onChange: (field: OcrFieldKey, value: string) => void;
}

export function OCRFieldEditor({
  field,
  value,
  confidence,
  error,
  disabled = false,
  onChange,
}: OCRFieldEditorProps) {
  const isDate = field === 'manufacturingDate' || field === 'expiryDate';
  const lowConfidence =
    !disabled && typeof confidence === 'number' && confidence < LOW_CONFIDENCE_THRESHOLD;

  return (
    <div>
      <label
        htmlFor={`ocr-${field}`}
        className="mb-1.5 flex items-center justify-between text-sm font-medium text-text-primary"
      >
        <span>
          {OCR_FIELD_LABELS[field]}
          {field === 'medicineName' ? <span className="text-status-critical-fg"> *</span> : null}
        </span>
        {typeof confidence === 'number' ? <OCRConfidenceBadge value={confidence} /> : null}
      </label>
      <input
        id={`ocr-${field}`}
        type={isDate ? 'date' : 'text'}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(field, event.target.value)}
        className={`${inputClasses} ${lowConfidence ? 'border-status-warning-fg' : ''}`}
      />
      {error ? <span className="mt-1 block text-xs text-status-critical-fg">{error}</span> : null}
    </div>
  );
}

const CONFIDENCE_TONES = {
  high: 'text-status-safe-fg',
  medium: 'text-status-warning-fg',
  low: 'text-status-critical-fg',
} as const;

export function confidenceTone(value: number): keyof typeof CONFIDENCE_TONES {
  if (value >= 0.85) return 'high';
  if (value >= LOW_CONFIDENCE_THRESHOLD) return 'medium';
  return 'low';
}

export function OCRConfidenceBadge({ value }: { value: number }) {
  const tone = confidenceTone(value);
  return (
    <span className={`text-xs font-medium ${CONFIDENCE_TONES[tone]}`}>
      {Math.round(value * 100)}%
    </span>
  );
}

/** Overall scan confidence bar (PRD §10.6 "Confidence score"). */
export function OCRConfidence({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <p className="text-sm text-text-secondary">
        Confidence: <span className="font-medium text-text-primary">unknown</span>
      </p>
    );
  }

  const percent = Math.round(value * 100);
  const tone = confidenceTone(value);
  const barColor =
    tone === 'high'
      ? 'bg-status-safe-fg'
      : tone === 'medium'
        ? 'bg-status-warning-fg'
        : 'bg-status-critical-fg';
  const label = tone === 'high' ? 'High confidence' : tone === 'medium' ? 'Medium confidence' : 'Low confidence';

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="font-medium text-text-primary">{label}</span>
        <span className="text-text-secondary">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Extraction confidence"
        className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
      >
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-xs text-text-faint">
        AI output is unverified until you confirm it. Check every field.
      </p>
    </div>
  );
}
