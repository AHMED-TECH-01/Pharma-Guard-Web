import type { ReturnListItem, ReturnListResponse } from '@pharmaguard/types';
import type { CreateReturnInput, ListReturnsQuery } from '@pharmaguard/validation';
import type { Request } from 'express';
import { getSupabaseAdmin } from '../../database/supabase.js';
import { ApiError } from '../../utils/api-error.js';
import { writeAudit } from '../../utils/audit.js';

/**
 * Returns service (PRD §10.14, TRD §13 Return). Approval decrements stock
 * atomically in migration 0006's `approve_return` RPC; completion stamps
 * return_date, rejection is a no-op. Audits cover every transition.
 */

interface ReturnRow {
  id: string;
  supplier_id: string | null;
  batch_id: string;
  medicine_id: string;
  quantity: number;
  reason: ReturnListItem['reason'];
  status: ReturnListItem['status'];
  notes: string | null;
  return_date: string | null;
  created_at: string;
  suppliers: { name: string } | null;
  batches: {
    batch_no: string;
    medicines: { name: string; strength: string | null } | null;
  } | null;
}

function mapReturn(row: ReturnRow): ReturnListItem {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    supplierName: row.suppliers?.name ?? null,
    batchId: row.batch_id,
    batchNo: row.batches?.batch_no ?? '—',
    medicineId: row.medicine_id,
    medicineName: row.batches?.medicines?.name ?? 'Unknown medicine',
    medicineStrength: row.batches?.medicines?.strength ?? null,
    quantity: row.quantity,
    reason: row.reason,
    status: row.status,
    notes: row.notes,
    returnDate: row.return_date,
    createdAt: row.created_at,
  };
}

function mapRpcError(error: { message?: string } | null, fallback: string): ApiError {
  const message = error?.message ?? '';
  if (message.includes('RETURN_INVALID_STATE')) {
    return ApiError.conflict('This return has already been actioned.');
  }
  if (message.includes('RETURN_NOT_FOUND')) {
    return ApiError.notFound('Return could not be found.');
  }
  if (message.includes('BATCH_NOT_FOUND')) {
    return ApiError.notFound('The returned batch could not be found.');
  }
  if (message.includes('INSUFFICIENT_STOCK')) {
    return ApiError.conflict('The batch no longer holds enough stock to return.');
  }
  return ApiError.internal(`${fallback}: ${message || 'unknown'}`);
}

const RETURN_SELECT =
  'id, supplier_id, batch_id, medicine_id, quantity, reason, status, notes, return_date, created_at, suppliers(name), batches(batch_no, medicines(name, strength))';

export async function createReturn(
  pharmacyId: string,
  userId: string,
  input: CreateReturnInput,
  request: Request,
): Promise<ReturnListItem> {
  const supabase = getSupabaseAdmin();

  const { data: batch, error: batchError } = await supabase
    .from('batches')
    .select('id, quantity, status')
    .eq('id', input.batchId)
    .eq('pharmacy_id', pharmacyId)
    .maybeSingle();
  if (batchError) throw ApiError.internal(`Could not load the batch: ${batchError.message}`);
  if (!batch) throw ApiError.notFound('Batch could not be found.');
  const batchRow = batch as unknown as { id: string; quantity: number; status: string };
  if (input.quantity > batchRow.quantity) {
    throw ApiError.badRequest(
      `Only ${batchRow.quantity} unit(s) left in this batch - cannot return ${input.quantity}.`,
    );
  }

  const { data, error } = await supabase
    .from('returns')
    .insert({
      pharmacy_id: pharmacyId,
      supplier_id: input.supplierId ?? null,
      batch_id: input.batchId,
      quantity: input.quantity,
      reason: input.reason,
      notes: input.notes ?? null,
      created_by: userId,
    })
    .select(RETURN_SELECT)
    .single();
  if (error) throw ApiError.badRequest(`Could not record the return: ${error.message}`);

  const created = mapReturn(data as unknown as ReturnRow);

  await writeAudit({
    pharmacyId,
    userId,
    action: 'return.created',
    entityType: 'return',
    entityId: created.id,
    after: {
      batchId: created.batchId,
      batchNo: created.batchNo,
      quantity: created.quantity,
      reason: created.reason,
      supplierId: created.supplierId,
    },
    request,
  });

  return created;
}

export async function listReturns(
  pharmacyId: string,
  query: ListReturnsQuery,
): Promise<ReturnListResponse> {
  const supabase = getSupabaseAdmin();
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let listQuery = supabase
    .from('returns')
    .select(RETURN_SELECT, { count: 'exact' })
    .eq('pharmacy_id', pharmacyId)
    .order('created_at', { ascending: false });
  if (query.status) listQuery = listQuery.eq('status', query.status);
  if (query.supplierId) listQuery = listQuery.eq('supplier_id', query.supplierId);
  if (query.search) {
    // Reference RETURNS screen has a search box; match medicine name or batch
    // no. through the embed. Strip characters that would break the or() grammar.
    const term = query.search.replace(/[%,()]/g, '').trim();
    if (term) {
      listQuery = listQuery.or(
        `batches.medicines.name.ilike.%${term}%,batches.batch_no.ilike.%${term}%`,
      );
    }
  }

  const { data, error, count } = await listQuery.range(from, to);
  if (error) throw ApiError.internal(`Could not load returns: ${error.message}`);

  return {
    returns: ((data as unknown as ReturnRow[]) ?? []).map(mapReturn),
    total: count ?? 0,
    page,
    pageSize,
  };
}

async function loadOne(pharmacyId: string, returnId: string): Promise<ReturnListItem> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('returns')
    .select(RETURN_SELECT)
    .eq('id', returnId)
    .eq('pharmacy_id', pharmacyId)
    .maybeSingle();
  if (error) throw ApiError.internal(`Could not load the return: ${error.message}`);
  if (!data) throw ApiError.notFound('Return could not be found.');
  return mapReturn(data as unknown as ReturnRow);
}

export async function approveReturn(
  pharmacyId: string,
  userId: string,
  returnId: string,
  request: Request,
): Promise<ReturnListItem> {
  const supabase = getSupabaseAdmin();
  const before = await loadOne(pharmacyId, returnId);
  if (before.status !== 'PENDING') {
    throw ApiError.conflict('This return has already been actioned.');
  }

  const { data, error } = await supabase.rpc('approve_return', {
    p_pharmacy_id: pharmacyId,
    p_return_id: returnId,
    p_user_id: userId,
  });
  if (error) throw mapRpcError(error, 'Could not approve the return');

  const updated = mapReturn(data as unknown as ReturnRow);
  await writeAudit({
    pharmacyId,
    userId,
    action: 'return.approved',
    entityType: 'return',
    entityId: returnId,
    before: { status: before.status, batchNo: before.batchNo },
    after: { status: updated.status, stockRemoved: updated.quantity, batchNo: updated.batchNo },
    request,
  });
  return updated;
}

export async function completeReturn(
  pharmacyId: string,
  userId: string,
  returnId: string,
  request: Request,
): Promise<ReturnListItem> {
  const supabase = getSupabaseAdmin();
  const before = await loadOne(pharmacyId, returnId);
  if (before.status !== 'APPROVED') {
    throw ApiError.conflict('Only approved returns can be completed.');
  }

  const { data, error } = await supabase.rpc('complete_return', {
    p_pharmacy_id: pharmacyId,
    p_return_id: returnId,
    p_return_date: null,
  });
  if (error) throw mapRpcError(error, 'Could not complete the return');

  const updated = mapReturn(data as unknown as ReturnRow);
  await writeAudit({
    pharmacyId,
    userId,
    action: 'return.completed',
    entityType: 'return',
    entityId: returnId,
    before: { status: before.status },
    after: { status: updated.status, returnDate: updated.returnDate },
    request,
  });
  return updated;
}

export async function rejectReturn(
  pharmacyId: string,
  userId: string,
  returnId: string,
  request: Request,
): Promise<ReturnListItem> {
  const supabase = getSupabaseAdmin();
  const before = await loadOne(pharmacyId, returnId);
  if (before.status !== 'PENDING') {
    throw ApiError.conflict('This return has already been actioned.');
  }

  const { data, error } = await supabase.rpc('reject_return', {
    p_pharmacy_id: pharmacyId,
    p_return_id: returnId,
  });
  if (error) throw mapRpcError(error, 'Could not reject the return');

  const updated = mapReturn(data as unknown as ReturnRow);
  await writeAudit({
    pharmacyId,
    userId,
    action: 'return.rejected',
    entityType: 'return',
    entityId: returnId,
    before: { status: before.status },
    after: { status: updated.status },
    request,
  });
  return updated;
}
