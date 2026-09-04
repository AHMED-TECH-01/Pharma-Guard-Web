import type { Request } from 'express';
import type {
  ExpiryActionResult,
  ExpiryBatchItem,
  ExpiryBatchListResponse,
  ExpiryBucketCard,
  ExpirySkippedBatch,
  ExpirySummary,
} from '@pharmaguard/types';
import type { ExpiryBulkActionInput, ListExpiryBatchesQuery } from '@pharmaguard/validation';
import { getSupabaseAdmin } from '../../database/supabase.js';
import { ApiError } from '../../utils/api-error.js';
import { writeAudit } from '../../utils/audit.js';
import { classifyBatch, expiryThresholds } from './expiry.util.js';
import { quarantineBatch } from './quarantine.service.js';

/**
 * Expiry Center service (PRD §10.9, TRD §10/§12).
 *
 * Scope: batches with status AVAILABLE and quantity > 0 - the Expiry Center
 * manages expiry risk on sellable stock; quarantined stock is handled by the
 * Quarantine workflow, and returned/removed/archived batches are historical.
 * The table is FEFO-ordered (expiry_date ascending, TRD §12).
 */

const EXPIRY_BATCH_SELECT =
  'id, medicine_id, batch_no, quantity, expiry_date, status, purchase_price, medicines(id, name, strength, purchase_price)';

/** Hard ceiling for in-memory aggregation (matches dashboard practice). */
const MAX_BATCHES = 5000;

type ExpiryBatchRow = {
  id: string;
  medicine_id: string;
  batch_no: string;
  quantity: number;
  expiry_date: string;
  status: string;
  purchase_price: unknown;
  medicines: { name: string; strength: string | null; purchase_price: unknown } | null;
};

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** Inventory value at cost: batch purchase price, falling back to the medicine's. */
function valueAtCost(row: ExpiryBatchRow): number {
  const unitCost = toNumber(row.purchase_price) || toNumber(row.medicines?.purchase_price);
  return row.quantity * unitCost;
}

async function fetchAvailableBatches(pharmacyId: string, now: Date): Promise<ExpiryBatchItem[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('batches')
    .select(EXPIRY_BATCH_SELECT)
    .eq('pharmacy_id', pharmacyId)
    .eq('status', 'AVAILABLE')
    .gt('quantity', 0)
    .order('expiry_date', { ascending: true })
    .limit(MAX_BATCHES);
  if (error) throw ApiError.internal(`Could not load expiry batches: ${error.message}`);

  // PostgREST embeds are inferred as arrays by the client's generated types;
  // the wire shape for this to-one relation is an object, so cast via unknown.
  return (data as unknown as ExpiryBatchRow[]).map((row) => {
    const { daysLeft, bucket } = classifyBatch(row.expiry_date, now);
    return {
      id: row.id,
      medicineId: row.medicine_id,
      medicineName: row.medicines?.name ?? 'Unknown medicine',
      strength: row.medicines?.strength ?? null,
      batchNo: row.batch_no,
      quantity: row.quantity,
      expiryDate: row.expiry_date,
      daysLeft,
      bucket,
      valueAtCost: valueAtCost(row),
      status: row.status,
    } satisfies ExpiryBatchItem;
  });
}

export async function getExpirySummary(pharmacyId: string, now = new Date()): Promise<ExpirySummary> {
  const batches = await fetchAvailableBatches(pharmacyId, now);
  const { criticalDays, warningDays } = expiryThresholds();

  const cardFor = (bucket: ExpiryBucketCard['bucket']): ExpiryBucketCard => {
    const inBucket = batches.filter((batch) => batch.bucket === bucket);
    return {
      bucket,
      batchCount: inBucket.length,
      units: inBucket.reduce((sum, batch) => sum + batch.quantity, 0),
      valueAtCost: inBucket.reduce((sum, batch) => sum + batch.valueAtCost, 0),
    };
  };

  const buckets = [
    cardFor('EXPIRED'),
    cardFor('CRITICAL'),
    cardFor('WARNING'),
    cardFor('SAFE'),
  ];

  return {
    pharmacyId,
    generatedAt: now.toISOString(),
    criticalDays,
    warningDays,
    buckets,
    valueAtRisk: buckets
      .filter((card) => card.bucket !== 'SAFE')
      .reduce((sum, card) => sum + card.valueAtCost, 0),
  };
}

export async function listExpiryBatches(
  pharmacyId: string,
  query: ListExpiryBatchesQuery,
  now = new Date(),
): Promise<ExpiryBatchListResponse> {
  const batches = await fetchAvailableBatches(pharmacyId, now);
  const filtered =
    query.bucket === 'ALL' ? batches : batches.filter((batch) => batch.bucket === query.bucket);

  const start = (query.page - 1) * query.pageSize;
  return {
    batches: filtered.slice(start, start + query.pageSize),
    total: filtered.length,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/**
 * Bulk expiry actions (PRD §10.9 "Bulk actions / Mark removed / Mark
 * returned / Quarantine"). REMOVE and RETURN are batch status transitions;
 * QUARANTINE delegates to the quarantine service (item + status + alert +
 * audit). Batches in any other state are skipped with an explanation.
 */
export async function applyBatchActions(
  pharmacyId: string,
  userId: string,
  input: ExpiryBulkActionInput,
  request?: Request,
): Promise<ExpiryActionResult> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('batches')
    .select('id, batch_no, quantity, status, medicine_id, medicines(name)')
    .eq('pharmacy_id', pharmacyId)
    .in('id', input.batchIds);
  if (error) throw ApiError.internal(`Could not load the selected batches: ${error.message}`);

  // Cast via unknown: the client infers to-one embeds as arrays.
  const rows = data as unknown as {
    id: string;
    batch_no: string;
    quantity: number;
    status: string;
    medicines: { name: string } | null;
  }[];

  const skipped: ExpirySkippedBatch[] = [];
  let updated = 0;

  for (const row of rows) {
    const medicineName = row.medicines?.name ?? 'Unknown medicine';

    if (input.action === 'QUARANTINE') {
      if (row.status !== 'AVAILABLE') {
        skipped.push({
          id: row.id,
          batchNo: row.batch_no,
          medicineName,
          reason: `Batch is ${row.status.toLowerCase()}, not available`,
        });
        continue;
      }
      await quarantineBatch(
        pharmacyId,
        userId,
        { batchId: row.id, reason: input.reason },
        request,
      );
      updated += 1;
      continue;
    }

    if (row.status !== 'AVAILABLE') {
      skipped.push({
        id: row.id,
        batchNo: row.batch_no,
        medicineName,
        reason: `Batch is ${row.status.toLowerCase()}; resolve it from the Quarantine page`,
      });
      continue;
    }

    const nextStatus = input.action === 'REMOVE' ? 'REMOVED' : 'RETURNED';
    const { error: updateError } = await supabase
      .from('batches')
      .update({ status: nextStatus })
      .eq('id', row.id);
    if (updateError) throw ApiError.internal(`Could not update batch ${row.batch_no}: ${updateError.message}`);

    await writeAudit({
      pharmacyId,
      userId,
      action: input.action === 'REMOVE' ? 'batch.removed' : 'batch.returned',
      entityType: 'batch',
      entityId: row.id,
      before: { status: row.status, quantity: row.quantity },
      after: { status: nextStatus, quantity: row.quantity, reason: input.reason },
      request,
    });
    updated += 1;
  }

  // Ids that did not exist in this pharmacy at all.
  const foundIds = new Set(rows.map((row) => row.id));
  for (const id of input.batchIds) {
    if (!foundIds.has(id)) {
      skipped.push({ id, batchNo: id, medicineName: 'Unknown', reason: 'Batch not found' });
    }
  }

  return { action: input.action, updated, skipped };
}
