import type { Batch, InventoryBatchItem, InventoryBatchListResponse, InventoryBatchStatus } from '@pharmaguard/types';
import type {
  AdjustStockInput,
  CreateBatchInput,
  ListInventoryBatchesQuery,
  UpdateBatchInput,
} from '@pharmaguard/validation';
import { getSupabaseAdmin } from '../../database/supabase.js';
import { ApiError } from '../../utils/api-error.js';
import { classifyBatch, expiryThresholds } from '../safety/expiry.util.js';

/**
 * Batch use-cases (TRD §7 Batches, PRD FR-011 FEFO).
 * Batch numbers are unique per (pharmacy, medicine, batch_no) - the DB
 * constraint is the source of truth; violations surface as 409.
 */

type BatchRow = Record<string, unknown>;

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function mapBatch(row: BatchRow): Batch {
  return {
    id: row.id as string,
    medicineId: row.medicine_id as string,
    pharmacyId: row.pharmacy_id as string,
    batchNo: row.batch_no as string,
    manufacturingDate: (row.manufacturing_date as string | null) ?? null,
    expiryDate: row.expiry_date as string,
    quantity: Number(row.quantity ?? 0),
    receivedDate: (row.received_date as string | null) ?? null,
    purchasePrice: row.purchase_price == null ? null : toNumber(row.purchase_price),
    supplierId: (row.supplier_id as string | null) ?? null,
    status: row.status as Batch['status'],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

async function getMedicineRow(pharmacyId: string, medicineId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('medicines')
    .select('id')
    .eq('pharmacy_id', pharmacyId)
    .eq('id', medicineId)
    .single();

  if (error || !data) {
    throw ApiError.notFound('Medicine not found');
  }
}

export async function listBatches(pharmacyId: string, medicineId: string): Promise<Batch[]> {
  await getMedicineRow(pharmacyId, medicineId);

  const { data, error } = await getSupabaseAdmin()
    .from('batches')
    .select('*')
    .eq('pharmacy_id', pharmacyId)
    .eq('medicine_id', medicineId)
    .order('expiry_date', { ascending: true }); // FEFO order (PRD FR-011)

  if (error) {
    throw ApiError.internal(`Unable to list batches: ${error.message}`);
  }
  return (data ?? []).map((row) => mapBatch(row as BatchRow));
}

export async function createBatch(
  pharmacyId: string,
  medicineId: string,
  input: CreateBatchInput,
): Promise<Batch> {
  await getMedicineRow(pharmacyId, medicineId);

  const { data, error } = await getSupabaseAdmin()
    .from('batches')
    .insert({
      pharmacy_id: pharmacyId,
      medicine_id: medicineId,
      batch_no: input.batchNo,
      manufacturing_date: input.manufacturingDate ?? null,
      expiry_date: input.expiryDate,
      quantity: input.quantity,
      received_date: input.receivedDate ?? null,
      purchase_price: input.purchasePrice ?? null,
      supplier_id: input.supplierId ?? null,
    })
    .select('*')
    .single();

  if (error || !data) {
    if ((error as { code?: string } | null)?.code === '23505') {
      throw ApiError.conflict(
        `Batch ${input.batchNo} already exists for this medicine`,
      );
    }
    throw ApiError.internal(`Unable to create batch: ${error?.message ?? 'unknown'}`);
  }
  return mapBatch(data as BatchRow);
}

export async function getBatch(pharmacyId: string, batchId: string): Promise<Batch> {
  const { data, error } = await getSupabaseAdmin()
    .from('batches')
    .select('*')
    .eq('pharmacy_id', pharmacyId)
    .eq('id', batchId)
    .single();

  if (error || !data) {
    throw ApiError.notFound('Batch not found');
  }
  return mapBatch(data as BatchRow);
}

export async function updateBatch(
  pharmacyId: string,
  batchId: string,
  input: UpdateBatchInput,
): Promise<Batch> {
  const patch: Record<string, unknown> = {};
  if (input.batchNo !== undefined) patch.batch_no = input.batchNo;
  if (input.manufacturingDate !== undefined) patch.manufacturing_date = input.manufacturingDate ?? null;
  if (input.expiryDate !== undefined) patch.expiry_date = input.expiryDate;
  if (input.quantity !== undefined) patch.quantity = input.quantity;
  if (input.receivedDate !== undefined) patch.received_date = input.receivedDate ?? null;
  if (input.purchasePrice !== undefined) patch.purchase_price = input.purchasePrice ?? null;
  if (input.supplierId !== undefined) patch.supplier_id = input.supplierId ?? null;
  if (input.status !== undefined) patch.status = input.status;

  if (Object.keys(patch).length === 0) {
    throw ApiError.validation('No fields to update');
  }

  const { data, error } = await getSupabaseAdmin()
    .from('batches')
    .update(patch)
    .eq('pharmacy_id', pharmacyId)
    .eq('id', batchId)
    .select('*')
    .single();

  if (error || !data) {
    if ((error as { code?: string } | null)?.code === '23505') {
      throw ApiError.conflict('A batch with this number already exists for the medicine');
    }
    if ((error as { code?: string } | null)?.code === 'PGRST116') {
      throw ApiError.notFound('Batch not found');
    }
    throw ApiError.internal(`Unable to update batch: ${error?.message ?? 'unknown'}`);
  }
  return mapBatch(data as BatchRow);
}

/**
 * Signed stock adjustment (TRD POST /batches/:id/adjust). The resulting
 * quantity must stay >= 0; both the mutation and its reason land in the
 * audit log (FR-031) via the route layer.
 */
export async function adjustBatchQuantity(
  pharmacyId: string,
  batchId: string,
  input: AdjustStockInput,
): Promise<Batch> {
  const current = await getBatch(pharmacyId, batchId);
  const nextQuantity = current.quantity + input.delta;

  if (nextQuantity < 0) {
    throw ApiError.badRequest(
      `Adjustment would take stock to ${nextQuantity}; batch ${current.batchNo} only has ${current.quantity} units`,
    );
  }

  const { data, error } = await getSupabaseAdmin()
    .from('batches')
    .update({ quantity: nextQuantity })
    .eq('pharmacy_id', pharmacyId)
    .eq('id', batchId)
    .select('*')
    .single();

  if (error || !data) {
    throw ApiError.internal(`Unable to adjust stock: ${error?.message ?? 'unknown'}`);
  }
  return mapBatch(data as BatchRow);
}

// ---------------------------------------------------------------------------
// Reference inventory table (batch rows)
// ---------------------------------------------------------------------------

/** Hard ceiling for in-memory aggregation (matches the dashboard practice). */
const INVENTORY_BATCH_LIMIT = 5000;

type InventoryBatchRow = {
  id: string;
  medicine_id: string;
  batch_no: string;
  quantity: number;
  expiry_date: string;
  medicines: { name: string; strength: string | null; reorder_level: number } | null;
};

/** Reference badge priority: expiry first, then stock level, then buckets. */
function inventoryBatchStatus(
  quantity: number,
  reorderLevel: number,
  daysLeft: number,
  criticalDays: number,
  warningDays: number,
): InventoryBatchStatus {
  if (daysLeft < 0) return 'EXPIRED';
  if (quantity <= 0) return 'OUT_OF_STOCK';
  if (reorderLevel > 0 && quantity <= reorderLevel) return 'LOW_STOCK';
  if (daysLeft <= criticalDays) return 'CRITICAL';
  if (daysLeft <= warningDays) return 'WARNING';
  return 'IN_STOCK';
}

/**
 * Batch-level inventory listing behind the All Medicines table (ui-rules
 * §7): one row per AVAILABLE batch with a server-derived status badge,
 * search, status filter, sort and pagination.
 */
export async function listInventoryBatches(
  pharmacyId: string,
  query: ListInventoryBatchesQuery,
  now = new Date(),
): Promise<InventoryBatchListResponse> {
  const { criticalDays, warningDays } = expiryThresholds();

  const { data, error } = await getSupabaseAdmin()
    .from('batches')
    .select(
      'id, medicine_id, batch_no, quantity, expiry_date, medicines(name, strength, reorder_level)',
    )
    .eq('pharmacy_id', pharmacyId)
    .eq('status', 'AVAILABLE')
    .order('expiry_date', { ascending: true })
    .limit(INVENTORY_BATCH_LIMIT);
  if (error) {
    throw ApiError.internal(`Unable to list inventory batches: ${error.message}`);
  }

  // Cast via unknown: the client infers to-one embeds as arrays.
  const items: InventoryBatchItem[] = (data as unknown as InventoryBatchRow[]).map((row) => {
    const { daysLeft } = classifyBatch(row.expiry_date, now);
    const quantity = Number(row.quantity ?? 0);
    const reorderLevel = toNumber(row.medicines?.reorder_level);
    return {
      id: row.id,
      medicineId: row.medicine_id,
      medicineName: row.medicines?.name ?? 'Unknown medicine',
      strength: row.medicines?.strength ?? null,
      batchNo: row.batch_no,
      expiryDate: row.expiry_date,
      daysLeft,
      quantity,
      reorderLevel,
      status: inventoryBatchStatus(quantity, reorderLevel, daysLeft, criticalDays, warningDays),
    };
  });

  const search = query.search?.toLowerCase();
  const filtered = items.filter((row) => {
    if (
      search &&
      !`${row.medicineName} ${row.strength ?? ''} ${row.batchNo}`.toLowerCase().includes(search)
    ) {
      return false;
    }
    return query.status === 'all' || row.status === query.status.toUpperCase();
  });

  const direction = query.order === 'desc' ? -1 : 1;
  filtered.sort((a, b) => {
    switch (query.sort) {
      case 'medicine':
        return direction * a.medicineName.localeCompare(b.medicineName);
      case 'quantity':
        return direction * (a.quantity - b.quantity);
      default:
        return direction * a.expiryDate.localeCompare(b.expiryDate);
    }
  });

  const start = (query.page - 1) * query.pageSize;
  return {
    items: filtered.slice(start, start + query.pageSize),
    total: filtered.length,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(filtered.length / query.pageSize)),
  };
}
