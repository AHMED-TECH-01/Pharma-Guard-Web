import type { OcrScanStatus } from './enums.js';

/**
 * AI OCR contracts (TRD §8, PRD §11).
 *
 * The AI output is unverified until the user confirms it (TRD §33): every
 * field is nullable because the model must never invent missing values, and
 * each field carries its own extraction confidence (0..1) so the review
 * screen can highlight uncertainty.
 */

/** Fields the vision model extracts from a medicine photo (TRD §8). */
export type OcrFieldKey =
  | 'medicineName'
  | 'genericName'
  | 'strength'
  | 'dosageForm'
  | 'manufacturer'
  | 'batchNumber'
  | 'manufacturingDate'
  | 'expiryDate';

export const OCR_FIELD_KEYS: readonly OcrFieldKey[] = [
  'medicineName',
  'genericName',
  'strength',
  'dosageForm',
  'manufacturer',
  'batchNumber',
  'manufacturingDate',
  'expiryDate',
] as const;

/** Structured model output: extracted values plus per-field confidence. */
export interface OcrExtraction {
  medicineName: string | null;
  genericName: string | null;
  strength: string | null;
  dosageForm: string | null;
  manufacturer: string | null;
  batchNumber: string | null;
  /** ISO date (YYYY-MM-DD) when legible; null when absent/illegible. */
  manufacturingDate: string | null;
  /** ISO date (YYYY-MM-DD) when legible; null when absent/illegible. */
  expiryDate: string | null;
  /** Per-field extraction confidence in [0, 1]; missing keys mean unknown. */
  confidence: Partial<Record<OcrFieldKey, number>>;
}

/** Average confidence across the extracted fields, or null when unknown. */
export type OcrOverallConfidence = number | null;

/** Row in the AI Scan history (OCRHistory component, PRD §10.6). */
export interface OcrScanListItem {
  id: string;
  status: OcrScanStatus;
  confidence: OcrOverallConfidence;
  errorCode: string | null;
  /** Convenience copy of the extracted medicine name for history rows. */
  medicineName: string | null;
  createdAt: string;
}

/** Full scan detail returned by POST /ocr/scan and GET /ocr/scans/:id. */
export interface OcrScanDetail {
  id: string;
  pharmacyId: string;
  userId: string;
  status: OcrScanStatus;
  confidence: OcrOverallConfidence;
  errorCode: string | null;
  /** Typed view of the stored extraction; null until COMPLETED/CONFIRMED. */
  extraction: OcrExtraction | null;
  createdAt: string;
  updatedAt: string;
}
