import { randomUUID } from 'node:crypto';
import { fileTypeFromBuffer } from 'file-type';
import type { OcrExtraction, OcrScanDetail, OcrScanListItem, OcrScanStatus } from '@pharmaguard/types';
import type { OcrCorrection } from '@pharmaguard/validation';
import { getSupabaseAdmin } from '../../database/supabase.js';
import { ApiError } from '../../utils/api-error.js';
import { extractMedicine } from './gemini.js';

/**
 * AI OCR scan lifecycle (TRD §8 pipeline, TRD §22 state machine).
 *
 * Processing state machine:
 *   PROCESSING -> COMPLETED  (extraction stored, awaits user confirmation)
 *   PROCESSING -> FAILED     (error_code recorded, user may retry)
 *   COMPLETED  -> CONFIRMED  (user accepted/corrected; inventory is then
 *                             created by the client via POST /medicines +
 *                             POST /medicines/:id/batches - never by the AI)
 *   COMPLETED/FAILED -> DISCARDED
 *
 * File security (TRD §9): only image MIME types sniffed from magic bytes are
 * accepted (client-declared types are never trusted); uploads live in memory
 * only - nothing is written to disk or object storage - so there is no
 * executable web root, no retention window, and `storage_path` stays null.
 * `file_reference` is a server-generated identifier.
 */

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const SCAN_COLUMNS = 'id, pharmacy_id, user_id, file_reference, storage_path, extracted_data, confidence, status, error_code, created_at, updated_at';

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function overallConfidence(extraction: OcrExtraction): number | null {
  const values = Object.values(extraction.confidence).filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  );
  if (values.length === 0) return null;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  // Round to 2 decimals to fit ocr_scans.confidence numeric(5, 2).
  return Math.round(average * 100) / 100;
}

type ScanRow = {
  id: string;
  pharmacy_id: string;
  user_id: string;
  extracted_data: unknown;
  confidence: unknown;
  status: string;
  error_code: string | null;
  created_at: string;
  updated_at: string;
};

function mapScan(row: ScanRow): OcrScanDetail {
  return {
    id: row.id,
    pharmacyId: row.pharmacy_id,
    userId: row.user_id,
    status: row.status as OcrScanStatus,
    confidence: toNumber(row.confidence),
    errorCode: row.error_code,
    extraction: (row.extracted_data as OcrExtraction | null) ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapScanListItem(row: ScanRow): OcrScanListItem {
  const extraction = row.extracted_data as OcrExtraction | null;
  return {
    id: row.id,
    status: row.status as OcrScanStatus,
    confidence: toNumber(row.confidence),
    errorCode: row.error_code,
    medicineName: extraction?.medicineName ?? null,
    createdAt: row.created_at,
  };
}

export interface OcrUpload {
  /** Raw upload bytes from the multipart request body. */
  data: Buffer;
  /** Client-declared MIME type - logged only; sniffing is authoritative. */
  declaredMimeType: string;
}

/**
 * Validates the upload, creates a PROCESSING scan, runs Gemini Vision, and
 * stores the normalized extraction. The file itself is never persisted.
 */
export async function runOcrScan(
  pharmacyId: string,
  userId: string,
  upload: OcrUpload,
): Promise<OcrScanDetail> {
  const supabase = getSupabaseAdmin();

  // TRD §9: validate the actual bytes, not the browser-declared MIME type.
  const sniffed = await fileTypeFromBuffer(upload.data);
  if (!sniffed || !ALLOWED_MIME.has(sniffed.mime)) {
    throw ApiError.badRequest(
      'Unsupported file. Upload a JPEG, PNG, or WebP image of the medicine package.',
      { acceptedTypes: [...ALLOWED_MIME], declaredMimeType: upload.declaredMimeType },
    );
  }

  const fileReference = randomUUID();
  const { data: inserted, error: insertError } = await supabase
    .from('ocr_scans')
    .insert({
      pharmacy_id: pharmacyId,
      user_id: userId,
      file_reference: fileReference,
      storage_path: null,
      status: 'PROCESSING',
    })
    .select(SCAN_COLUMNS)
    .single();
  if (insertError) throw ApiError.internal(`Could not record the scan: ${insertError.message}`);
  const scan = mapScan(inserted as ScanRow);

  try {
    const extraction = await extractMedicine({
      mimeType: sniffed.mime,
      data: upload.data,
    });

    const { data: updated, error: updateError } = await supabase
      .from('ocr_scans')
      .update({
        extracted_data: extraction,
        confidence: overallConfidence(extraction),
        status: 'COMPLETED',
      })
      .eq('id', scan.id)
      .select(SCAN_COLUMNS)
      .single();
    if (updateError) throw ApiError.internal(`Could not save the extraction: ${updateError.message}`);
    return mapScan(updated as ScanRow);
  } catch (error) {
    const errorCode = error instanceof ApiError ? error.code : 'INTERNAL_ERROR';
    await supabase
      .from('ocr_scans')
      .update({ status: 'FAILED', error_code: errorCode })
      .eq('id', scan.id);

    if (error instanceof ApiError) {
      // Surface the scan id so the UI can offer retry against the record.
      throw new ApiError(error.code, error.status, error.message, { scanId: scan.id });
    }
    throw error;
  }
}

/** Recent scans for the OCRHistory component (newest first). */
export async function listScans(pharmacyId: string, limit = 20): Promise<OcrScanListItem[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('ocr_scans')
    .select(SCAN_COLUMNS)
    .eq('pharmacy_id', pharmacyId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw ApiError.internal(`Could not load scan history: ${error.message}`);
  return (data as ScanRow[]).map(mapScanListItem);
}

/** Single scan detail; membership-scoped via pharmacy_id. */
export async function getScan(pharmacyId: string, scanId: string): Promise<OcrScanDetail> {
  const { data, error } = await getSupabaseAdmin()
    .from('ocr_scans')
    .select(SCAN_COLUMNS)
    .eq('pharmacy_id', pharmacyId)
    .eq('id', scanId)
    .maybeSingle();
  if (error) throw ApiError.internal(`Could not load the scan: ${error.message}`);
  if (!data) throw ApiError.notFound('Scan not found');
  return mapScan(data as ScanRow);
}

/**
 * Marks a COMPLETED scan CONFIRMED, optionally persisting user-corrected
 * field values (TRD §33: user corrections win; the AI never auto-applies).
 * Per-field confidence values are preserved - they describe the AI
 * extraction, while corrections are captured in the audit log.
 */
export async function confirmScan(
  pharmacyId: string,
  userId: string,
  scanId: string,
  correction?: OcrCorrection,
): Promise<OcrScanDetail> {
  const supabase = getSupabaseAdmin();
  const scan = await getScan(pharmacyId, scanId);

  if (scan.status !== 'COMPLETED') {
    throw ApiError.conflict(`Only completed scans can be confirmed (scan is ${scan.status})`);
  }

  let extraction = scan.extraction;
  if (correction) {
    const field = (value: string): string | null => {
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    };
    extraction = {
      medicineName: field(correction.medicineName),
      genericName: field(correction.genericName),
      strength: field(correction.strength),
      dosageForm: field(correction.dosageForm),
      manufacturer: field(correction.manufacturer),
      batchNumber: field(correction.batchNumber),
      manufacturingDate: field(correction.manufacturingDate),
      expiryDate: field(correction.expiryDate),
      confidence: scan.extraction?.confidence ?? {},
    };
  }

  const { data, error } = await supabase
    .from('ocr_scans')
    .update({ extracted_data: extraction, status: 'CONFIRMED' })
    .eq('id', scanId)
    .select(SCAN_COLUMNS)
    .single();
  if (error) throw ApiError.internal(`Could not confirm the scan: ${error.message}`);

  await supabase.from('audit_logs').insert({
    pharmacy_id: pharmacyId,
    user_id: userId,
    action: 'ocr.confirmed',
    entity_type: 'ocr_scan',
    entity_id: scanId,
    after: { extraction },
  });

  return mapScan(data as ScanRow);
}

/** Marks a scan DISCARDED (RLS comment: discard is a status transition). */
export async function discardScan(
  pharmacyId: string,
  userId: string,
  scanId: string,
): Promise<OcrScanDetail> {
  const scan = await getScan(pharmacyId, scanId);
  if (scan.status === 'CONFIRMED' || scan.status === 'DISCARDED') {
    throw ApiError.conflict(`Scan is already ${scan.status}`);
  }

  const { data, error } = await getSupabaseAdmin()
    .from('ocr_scans')
    .update({ status: 'DISCARDED' })
    .eq('id', scanId)
    .select(SCAN_COLUMNS)
    .single();
  if (error) throw ApiError.internal(`Could not discard the scan: ${error.message}`);

  await getSupabaseAdmin().from('audit_logs').insert({
    pharmacy_id: pharmacyId,
    user_id: userId,
    action: 'ocr.discarded',
    entity_type: 'ocr_scan',
    entity_id: scanId,
    before: { status: scan.status },
    after: { status: 'DISCARDED' },
  });

  return mapScan(data as ScanRow);
}
