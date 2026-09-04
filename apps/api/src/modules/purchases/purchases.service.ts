import type { PurchaseListItem, PurchaseListResponse } from '@pharmaguard/types';
import type { CreatePurchaseInput, ListPurchasesQuery } from '@pharmaguard/validation';
import type { Request } from 'express';
import { getSupabaseAdmin } from '../../database/supabase.js';
import { ApiError } from '../../utils/api-error.js';
import { writeAudit } from '../../utils/audit.js';

/**
 * Purchases service (PRD §10.11, TRD §7 Purchases, TRD §13 Purchase
 * transaction). Receiving runs atomically in migration 0005's
 * `receive_purchase` RPC (header -> per-item batch increment/create ->
 * purchase items). This service owns error mapping and audit.
 */

interface PurchaseRow {
  id: string;
  supplier_id: string | null;
  invoice_no: string | null;
  received_at: string;
  note: string | null;
  suppliers: { name: string } | null;
  purchase_items: {
    quantity: number;
    unit_cost: string | number;
    medicine_id: string;
    batch_id: string;
    medicines: { name: string; strength: string | null } | null;
    batches: { batch_no: string } | null;
  }[];
}

function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number.parseFloat(value);
}

function mapPurchase(row: PurchaseRow): PurchaseListItem {
  const items = (row.purchase_items ?? []).map((item) => ({
    medicineId: item.medicine_id,
    medicineName: item.medicines?.name ?? 'Unknown medicine',
    medicineStrength: item.medicines?.strength ?? null,
    batchId: item.batch_id,
    batchNo: item.batches?.batch_no ?? '—',
    quantity: item.quantity,
    unitCost: toNumber(item.unit_cost),
  }));
  return {
    id: row.id,
    supplierId: row.supplier_id,
    supplierName: row.suppliers?.name ?? null,
    invoiceNo: row.invoice_no,
    receivedAt: row.received_at,
    note: row.note,
    items,
    totalCost: items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0),
  };
}

/** Maps a raised RPC exception token to the user-safe API error. */
function mapRpcError(error: { message?: string } | null, fallback: string): ApiError {
  const message = error?.message ?? '';
  if (message.includes('MEDICINE_NOT_FOUND')) {
    return ApiError.badRequest('One of the selected medicines could not be found.');
  }
  if (message.includes('BATCH_NOT_FOUND')) {
    return ApiError.badRequest('One of the selected batches could not be found.');
  }
  if (message.includes('BATCH_FIELDS_REQUIRED')) {
    return ApiError.badRequest('New batches need both a batch number and an expiry date.');
  }
  if (message.includes('ITEM_INVALID') || message.includes('ITEMS_INVALID')) {
    return ApiError.badRequest('Purchase items must have a medicine, quantity, and unit cost.');
  }
  return ApiError.internal(`${fallback}: ${message || 'unknown'}`);
}

const PURCHASE_SELECT =
  '*, suppliers(name), purchase_items(quantity, unit_cost, medicine_id, batch_id, medicines(name, strength), batches(batch_no))';

export async function createPurchase(
  pharmacyId: string,
  userId: string,
  input: CreatePurchaseInput,
  request: Request,
): Promise<PurchaseListItem> {
  const supabase = getSupabaseAdmin();

  const { data: purchaseId, error } = await supabase.rpc('receive_purchase', {
    p_pharmacy_id: pharmacyId,
    p_user_id: userId,
    p_supplier_id: input.supplierId ?? null,
    p_invoice_no: input.invoiceNo ?? null,
    p_note: input.note ?? null,
    p_items: input.items,
  });
  if (error) throw mapRpcError(error, 'Could not record the purchase');

  await writeAudit({
    pharmacyId,
    userId,
    action: 'purchase.received',
    entityType: 'purchase',
    entityId: String(purchaseId),
    after: {
      supplierId: input.supplierId ?? null,
      invoiceNo: input.invoiceNo ?? null,
      itemCount: input.items.length,
      totalCost: input.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0),
    },
    request,
  });

  return getPurchase(pharmacyId, String(purchaseId));
}

export async function listPurchases(
  pharmacyId: string,
  query: ListPurchasesQuery,
): Promise<PurchaseListResponse> {
  const supabase = getSupabaseAdmin();
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('purchases')
    .select(PURCHASE_SELECT, { count: 'exact' })
    .eq('pharmacy_id', pharmacyId)
    .order('received_at', { ascending: false })
    .range(from, to);
  if (error) throw ApiError.internal(`Could not load purchases: ${error.message}`);

  return {
    purchases: ((data as unknown as PurchaseRow[]) ?? []).map(mapPurchase),
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function getPurchase(
  pharmacyId: string,
  purchaseId: string,
): Promise<PurchaseListItem> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('purchases')
    .select(PURCHASE_SELECT)
    .eq('id', purchaseId)
    .eq('pharmacy_id', pharmacyId)
    .maybeSingle();
  if (error) throw ApiError.internal(`Could not load the purchase: ${error.message}`);
  if (!data) throw ApiError.notFound('Purchase could not be found.');
  return mapPurchase(data as unknown as PurchaseRow);
}
