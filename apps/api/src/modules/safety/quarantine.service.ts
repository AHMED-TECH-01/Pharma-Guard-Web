import type { Request } from 'express';
import type { QuarantineListItem, QuarantineListResponse, QuarantineResolution } from '@pharmaguard/types';
import type { CreateQuarantineInput, ListQuarantineQuery, ResolveQuarantineInput } from '@pharmaguard/validation';
import { getSupabaseAdmin } from '../../database/supabase.js';
import { ApiError } from '../../utils/api-error.js';
import { writeAudit } from '../../utils/audit.js';
import { insertEventAlert } from './alert-engine.service.js';

/**
 * Quarantine workflow (PRD §10.15, FR-025).
 *
 * Quarantining a batch marks the whole batch QUARANTINED and records a
 * quarantine_items row for the audit trail (quantity = batch quantity at
 * quarantine time; partial quarantine is intentionally out of scope).
 * Resolutions: RELEASE (back to AVAILABLE), RETURN (batch RETURNED), REMOVE
 * (batch REMOVED - the destroy workflow).
 */

const QUARANTINE_SELECT = `
  id, batch_id, quantity, reason, status, created_by, resolved_at, created_at,
  batches(batch_no, expiry_date, status, medicine_id, medicines(id, name))
`;

type QuarantineRow = {
  id: string;
  batch_id: string;
  quantity: number;
  reason: string;
  status: string;
  created_by: string;
  resolved_at: string | null;
  created_at: string;
  batches: {
    batch_no: string;
    expiry_date: string;
    status: string;
    medicine_id: string;
    medicines: { name: string } | null;
  } | null;
};

async function creatorNames(userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const { data, error } = await getSupabaseAdmin()
    .from('profiles')
    .select('id, full_name')
    .in('id', unique);
  if (error) return new Map();
  return new Map((data as { id: string; full_name: string }[]).map((row) => [row.id, row.full_name]));
}

function mapItem(row: QuarantineRow, names: Map<string, string>): QuarantineListItem {
  return {
    id: row.id,
    batchId: row.batch_id,
    batchNo: row.batches?.batch_no ?? '—',
    medicineId: row.batches?.medicine_id ?? '',
    medicineName: row.batches?.medicines?.name ?? 'Unknown medicine',
    batchExpiryDate: row.batches?.expiry_date ?? '',
    batchStatus: row.batches?.status ?? '',
    quantity: row.quantity,
    reason: row.reason,
    status: row.status as QuarantineListItem['status'],
    createdByName: names.get(row.created_by) ?? null,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

export async function listQuarantineItems(
  pharmacyId: string,
  query: ListQuarantineQuery,
): Promise<QuarantineListResponse> {
  const supabase = getSupabaseAdmin();

  let listQuery = supabase
    .from('quarantine_items')
    .select(QUARANTINE_SELECT)
    .eq('pharmacy_id', pharmacyId)
    .order('created_at', { ascending: false })
    .range((query.page - 1) * query.pageSize, query.page * query.pageSize - 1);
  if (query.status !== 'ALL') {
    listQuery = listQuery.eq('status', query.status);
  }

  let countQuery = supabase
    .from('quarantine_items')
    .select('id', { count: 'exact', head: true })
    .eq('pharmacy_id', pharmacyId);
  if (query.status !== 'ALL') {
    countQuery = countQuery.eq('status', query.status);
  }

  const [listResult, countResult] = await Promise.all([listQuery, countQuery]);
  if (listResult.error) throw ApiError.internal(`Could not load quarantine items: ${listResult.error.message}`);
  if (countResult.error) throw ApiError.internal(`Could not count quarantine items: ${countResult.error.message}`);

  const rows = listResult.data as unknown as QuarantineRow[];
  const names = await creatorNames(rows.map((row) => row.created_by));

  return {
    items: rows.map((row) => mapItem(row, names)),
    total: countResult.count ?? 0,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/**
 * Quarantines a whole batch: quarantine_items row + batch status QUARANTINED
 * + QUARANTINE alert + audit entry. Used by the Expiry Center bulk action
 * and the Recall Center's "quarantine affected inventory" action.
 */
export async function quarantineBatch(
  pharmacyId: string,
  userId: string,
  input: CreateQuarantineInput,
  request?: Request,
): Promise<QuarantineListItem> {
  const supabase = getSupabaseAdmin();

  const { data: batch, error: batchError } = await supabase
    .from('batches')
    .select('id, batch_no, quantity, status, medicine_id, expiry_date, medicines(name)')
    .eq('pharmacy_id', pharmacyId)
    .eq('id', input.batchId)
    .maybeSingle();
  if (batchError) throw ApiError.internal(`Could not load the batch: ${batchError.message}`);
  if (!batch) throw ApiError.notFound('Batch not found');

  const batchRow = batch as unknown as {
    id: string;
    batch_no: string;
    quantity: number;
    status: string;
    medicine_id: string;
    expiry_date: string;
    medicines: { name: string } | null;
  };
  const medicineName = batchRow.medicines?.name ?? 'Unknown medicine';

  if (batchRow.status !== 'AVAILABLE') {
    throw ApiError.conflict(`Only available batches can be quarantined (batch is ${batchRow.status.toLowerCase()})`);
  }
  if (batchRow.quantity <= 0) {
    throw ApiError.conflict('Batch has no stock to quarantine');
  }

  const { data: item, error: itemError } = await supabase
    .from('quarantine_items')
    .insert({
      pharmacy_id: pharmacyId,
      batch_id: batchRow.id,
      quantity: batchRow.quantity,
      reason: input.reason,
      status: 'QUARANTINED',
      created_by: userId,
    })
    .select('id, quantity, status, created_at')
    .single();
  if (itemError) throw ApiError.internal(`Could not create the quarantine record: ${itemError.message}`);

  const { error: updateError } = await supabase
    .from('batches')
    .update({ status: 'QUARANTINED' })
    .eq('id', batchRow.id);
  if (updateError) {
    throw ApiError.internal(`Quarantine recorded but the batch could not be updated: ${updateError.message}`);
  }

  await insertEventAlert(pharmacyId, {
    type: 'QUARANTINE',
    severity: 'HIGH',
    title: `Quarantined: ${medicineName}`,
    message: `Batch ${batchRow.batch_no} (${batchRow.quantity} units) was quarantined: ${input.reason}`,
    medicineId: batchRow.medicine_id,
    batchId: batchRow.id,
  });

  await writeAudit({
    pharmacyId,
    userId,
    action: 'quarantine.created',
    entityType: 'quarantine_item',
    entityId: (item as { id: string }).id,
    before: { batchStatus: batchRow.status },
    after: { batchStatus: 'QUARANTINED', quantity: batchRow.quantity, reason: input.reason },
    request,
  });

  return {
    id: (item as { id: string }).id,
    batchId: batchRow.id,
    batchNo: batchRow.batch_no,
    medicineId: batchRow.medicine_id,
    medicineName,
    batchExpiryDate: batchRow.expiry_date,
    batchStatus: 'QUARANTINED',
    quantity: batchRow.quantity,
    reason: input.reason,
    status: 'QUARANTINED',
    createdByName: null,
    createdAt: (item as { created_at: string }).created_at,
    resolvedAt: null,
  };
}

/**
 * Resolves a quarantined batch (PRD §10.15: Release / Return / Destroy).
 * Returns stock to AVAILABLE, marks it RETURNED for the supplier-return
 * workflow, or REMOVED for destroyed stock.
 */
export async function resolveQuarantineItem(
  pharmacyId: string,
  userId: string,
  itemId: string,
  input: ResolveQuarantineInput,
  request?: Request,
): Promise<QuarantineListItem> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('quarantine_items')
    .select(`${QUARANTINE_SELECT}, batches(batch_no, status, medicines(name))`)
    .eq('pharmacy_id', pharmacyId)
    .eq('id', itemId)
    .maybeSingle();
  if (error) throw ApiError.internal(`Could not load the quarantine item: ${error.message}`);
  if (!data) throw ApiError.notFound('Quarantine item not found');

  const item = data as unknown as QuarantineRow;
  if (item.status !== 'QUARANTINED') {
    throw ApiError.conflict(`This quarantine item is already ${item.status.toLowerCase()}`);
  }

  const nextBatchStatus: Record<QuarantineResolution, string> = {
    RELEASE: 'AVAILABLE',
    RETURN: 'RETURNED',
    REMOVE: 'REMOVED',
  };
  const itemStatus: Record<QuarantineResolution, QuarantineListItem['status']> = {
    RELEASE: 'RELEASED',
    RETURN: 'RETURNED',
    REMOVE: 'REMOVED',
  };
  const auditAction: Record<QuarantineResolution, string> = {
    RELEASE: 'quarantine.released',
    RETURN: 'quarantine.returned',
    REMOVE: 'quarantine.removed',
  };

  const now = new Date().toISOString();
  const { error: itemUpdateError } = await supabase
    .from('quarantine_items')
    .update({
      status: itemStatus[input.resolution],
      resolved_by: userId,
      resolved_at: now,
    })
    .eq('id', itemId);
  if (itemUpdateError) throw ApiError.internal(`Could not resolve the quarantine item: ${itemUpdateError.message}`);

  const { error: batchUpdateError } = await supabase
    .from('batches')
    .update({ status: nextBatchStatus[input.resolution] })
    .eq('id', item.batch_id);
  if (batchUpdateError) {
    throw ApiError.internal(`Quarantine resolved but the batch could not be updated: ${batchUpdateError.message}`);
  }

  const medicineName = item.batches?.medicines?.name ?? 'Unknown medicine';
  await writeAudit({
    pharmacyId,
    userId,
    action: auditAction[input.resolution],
    entityType: 'quarantine_item',
    entityId: itemId,
    before: { status: item.status, batchStatus: 'QUARANTINED' },
    after: {
      medicineName,
      status: itemStatus[input.resolution],
      batchStatus: nextBatchStatus[input.resolution],
      resolution: input.resolution,
      reason: input.reason ?? null,
    },
    request,
  });

  return mapItem({ ...item, status: itemStatus[input.resolution], resolved_at: now }, new Map());
}
