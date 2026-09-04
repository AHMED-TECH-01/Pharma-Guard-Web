import type { SaleListItem, SaleListResponse } from '@pharmaguard/types';
import type { CreateSaleInput, ListSalesQuery } from '@pharmaguard/validation';
import type { Request } from 'express';
import { getSupabaseAdmin } from '../../database/supabase.js';
import { ApiError } from '../../utils/api-error.js';
import { writeAudit } from '../../utils/audit.js';

/**
 * Sales service (PRD §10.10, TRD §7 Sales, TRD §13 Sale transaction).
 * Creation and reversal are atomic SECURITY DEFINER functions in migration
 * 0004 - row-locked, stock-verified, single round trip. This service owns
 * capability-adjacent checks, price defaulting, error mapping, and audit.
 */

interface SaleRow {
  id: string;
  pharmacy_id: string;
  user_id: string;
  medicine_id: string;
  batch_id: string;
  quantity: number;
  unit_price: string | number;
  total_amount: string | number;
  sold_at: string;
  note: string | null;
  reversed_at: string | null;
  reversed_by: string | null;
  // PostgREST embeds are inferred as arrays by generated types; wire shape
  // for these to-one relations is an object, so cast via unknown at read.
  medicines: { name: string; strength: string | null } | null;
  batches: { batch_no: string } | null;
}

function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number.parseFloat(value);
}

/** Maps a raised RPC exception token to the user-safe API error. */
function mapRpcError(error: { message?: string } | null, fallback: string): ApiError {
  const message = error?.message ?? '';
  if (message.includes('INSUFFICIENT_STOCK')) {
    return ApiError.conflict('Not enough stock left in the selected batch.');
  }
  if (message.includes('BATCH_NOT_AVAILABLE')) {
    return ApiError.conflict('The selected batch is no longer available for sale.');
  }
  if (message.includes('BATCH_NOT_FOUND')) {
    return ApiError.notFound('The selected batch could not be found.');
  }
  if (message.includes('SALE_ALREADY_REVERSED')) {
    return ApiError.conflict('This sale has already been reversed.');
  }
  if (message.includes('SALE_NOT_FOUND')) {
    return ApiError.notFound('Sale could not be found.');
  }
  if (message.includes('QUANTITY_INVALID') || message.includes('PRICE_INVALID')) {
    return ApiError.badRequest('Quantity and price must be valid positive values.');
  }
  return ApiError.internal(`${fallback}: ${message || 'unknown'}`);
}

function mapSale(row: SaleRow): SaleListItem {
  return {
    id: row.id,
    medicineId: row.medicine_id,
    medicineName: row.medicines?.name ?? 'Unknown medicine',
    medicineStrength: row.medicines?.strength ?? null,
    batchId: row.batch_id,
    batchNo: row.batches?.batch_no ?? '—',
    quantity: row.quantity,
    unitPrice: toNumber(row.unit_price),
    totalAmount: toNumber(row.total_amount),
    soldAt: row.sold_at,
    note: row.note,
    reversedAt: row.reversed_at,
  };
}

export async function createSale(
  pharmacyId: string,
  userId: string,
  input: CreateSaleInput,
  request: Request,
): Promise<SaleListItem> {
  const soldAt = input.soldAt ? new Date(input.soldAt) : null;
  if (soldAt && soldAt.getTime() > Date.now() + 60_000) {
    throw ApiError.badRequest('Sale time cannot be in the future.');
  }
  const supabase = getSupabaseAdmin();

  // Default price: the medicine's selling price, resolved via the batch.
  let unitPrice = input.unitPrice ?? null;
  if (unitPrice === null) {
    const { data, error } = await supabase
      .from('batches')
      .select('medicines(selling_price)')
      .eq('id', input.batchId)
      .eq('pharmacy_id', pharmacyId)
      .maybeSingle();
    if (error) throw ApiError.internal(`Could not resolve the sale price: ${error.message}`);
    const sellingPrice = (data as unknown as { medicines: { selling_price: string | number | null } | null } | null)
      ?.medicines?.selling_price;
    if (sellingPrice === null || sellingPrice === undefined) {
      throw ApiError.badRequest('Provide a unit price - this medicine has no selling price set.');
    }
    unitPrice = toNumber(sellingPrice);
  }

  const { data, error } = await supabase.rpc('create_sale', {
    p_pharmacy_id: pharmacyId,
    p_user_id: userId,
    p_batch_id: input.batchId,
    p_quantity: input.quantity,
    p_unit_price: unitPrice,
    p_note: input.note ?? null,
    p_sold_at: input.soldAt ?? null,
  });
  if (error) throw mapRpcError(error, 'Could not record the sale');

  const sale = mapSale(data as unknown as SaleRow);

  await writeAudit({
    pharmacyId,
    userId,
    action: 'sale.created',
    entityType: 'sale',
    entityId: sale.id,
    after: {
      batchId: sale.batchId,
      batchNo: sale.batchNo,
      medicineName: sale.medicineName,
      quantity: sale.quantity,
      unitPrice: sale.unitPrice,
      totalAmount: sale.totalAmount,
      soldAt: sale.soldAt,
    },
    request,
  });

  return sale;
}

export async function listSales(
  pharmacyId: string,
  query: ListSalesQuery,
): Promise<SaleListResponse> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const supabase = getSupabaseAdmin();

  let listQuery = supabase
    .from('sales')
    .select('*, medicines(name, strength), batches(batch_no)', { count: 'exact' })
    .eq('pharmacy_id', pharmacyId)
    .order('sold_at', { ascending: false });

  if (query.medicineId) listQuery = listQuery.eq('medicine_id', query.medicineId);
  if (query.from) listQuery = listQuery.gte('sold_at', `${query.from}T00:00:00Z`);
  if (query.to) {
    const dayAfter = new Date(`${query.to}T00:00:00Z`);
    dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
    listQuery = listQuery.lt('sold_at', dayAfter.toISOString());
  }

  const { data, error, count } = await listQuery.range(from, to);
  if (error) throw ApiError.internal(`Could not load sales: ${error.message}`);

  return {
    sales: ((data as unknown as SaleRow[]) ?? []).map(mapSale),
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function reverseSale(
  pharmacyId: string,
  userId: string,
  saleId: string,
  request: Request,
): Promise<SaleListItem> {
  const supabase = getSupabaseAdmin();
  // Load first so the audit can describe what was reversed.
  const { data: existing, error: existingError } = await supabase
    .from('sales')
    .select('*, medicines(name, strength), batches(batch_no)')
    .eq('id', saleId)
    .eq('pharmacy_id', pharmacyId)
    .maybeSingle();
  if (existingError) throw ApiError.internal(`Could not load the sale: ${existingError.message}`);
  if (!existing) throw ApiError.notFound('Sale could not be found.');
  const before = mapSale(existing as unknown as SaleRow);
  if (before.reversedAt) throw ApiError.conflict('This sale has already been reversed.');

  const { data, error } = await supabase.rpc('reverse_sale', {
    p_pharmacy_id: pharmacyId,
    p_sale_id: saleId,
    p_user_id: userId,
  });
  if (error) throw mapRpcError(error, 'Could not reverse the sale');

  const sale = mapSale(data as unknown as SaleRow);

  await writeAudit({
    pharmacyId,
    userId,
    action: 'sale.reversed',
    entityType: 'sale',
    entityId: sale.id,
    before: { reversedAt: null, quantity: before.quantity, batchNo: before.batchNo },
    after: { reversedAt: sale.reversedAt, stockRestoredTo: sale.batchNo },
    request,
  });

  return sale;
}
