import type {
  Medicine,
  MedicineDetail,
  MedicineListItem,
  MedicineListResponse,
  MedicineStockSummary,
  PotentialDuplicate,
  StockLevel,
} from '@pharmaguard/types';
import type {
  CreateMedicineInput,
  ListMedicinesQuery,
  UpdateMedicineInput,
} from '@pharmaguard/validation';
import { getSupabaseAdmin } from '../../database/supabase.js';
import { ApiError } from '../../utils/api-error.js';
import { mapBatch } from './batch.service.js';

/**
 * Medicine use-cases (TRD §7, PRD §10.7/§12).
 *
 * List rows carry a computed stock summary (quantity over AVAILABLE batches,
 * nearest expiry, expired-batch count) so the table renders from one call.
 * PostgREST returns numeric columns as strings - everything is normalized
 * through toNumber before arithmetic.
 */

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

type MedicineRow = Record<string, unknown>;

export function mapMedicine(row: MedicineRow): Medicine {
  return {
    id: row.id as string,
    pharmacyId: row.pharmacy_id as string,
    name: row.name as string,
    genericName: (row.generic_name as string | null) ?? null,
    strength: (row.strength as string | null) ?? null,
    dosageForm: (row.dosage_form as string | null) ?? null,
    manufacturer: (row.manufacturer as string | null) ?? null,
    barcode: (row.barcode as string | null) ?? null,
    category: (row.category as string | null) ?? null,
    reorderLevel: toNumber(row.reorder_level),
    safetyStock: toNumber(row.safety_stock),
    purchasePrice: row.purchase_price == null ? null : toNumber(row.purchase_price),
    sellingPrice: row.selling_price == null ? null : toNumber(row.selling_price),
    isArchived: Boolean(row.is_archived),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function summarize(
  medicine: Medicine,
  batches: { quantity: number; status: string; expiry: string }[],
  now: Date,
): MedicineStockSummary {
  let quantity = 0;
  let expiredBatches = 0;
  let nearestExpiry: string | null = null;
  const todayIso = new Date(now).toISOString().slice(0, 10);

  for (const batch of batches) {
    if (batch.status !== 'AVAILABLE' || batch.quantity <= 0) continue;
    quantity += batch.quantity;
    if (batch.expiry < todayIso) {
      expiredBatches += 1;
    } else if (nearestExpiry === null || batch.expiry < nearestExpiry) {
      nearestExpiry = batch.expiry;
    }
  }

  let level: StockLevel;
  if (quantity <= 0) {
    level = 'OUT_OF_STOCK';
  } else if (medicine.reorderLevel > 0 && quantity <= medicine.reorderLevel) {
    level = 'LOW_STOCK';
  } else {
    level = 'IN_STOCK';
  }

  return {
    quantity,
    level,
    nearestExpiry,
    expiredBatches,
    batchCount: batches.length,
  };
}

export async function listMedicines(
  pharmacyId: string,
  query: ListMedicinesQuery,
): Promise<MedicineListResponse> {
  const supabase = getSupabaseAdmin();
  const now = new Date();

  let rowsQuery = supabase
    .from('medicines')
    .select('*')
    .eq('pharmacy_id', pharmacyId);

  if (!query.includeArchived) {
    rowsQuery = rowsQuery.eq('is_archived', false);
  }
  if (query.search) {
    const pattern = `%${query.search.replace(/[%_]/g, (match: string) => `\\${match}`)}%`;
    rowsQuery = rowsQuery.or(
      `name.ilike.${pattern},generic_name.ilike.${pattern},barcode.ilike.${pattern}`,
    );
  }
  if (query.category) {
    rowsQuery = rowsQuery.eq('category', query.category);
  }

  // DB-level sort for columns that live on the row; computed columns are
  // sorted after aggregation below.
  if (query.sort === 'name') {
    rowsQuery = rowsQuery.order('name', { ascending: query.order === 'asc' });
  } else if (query.sort === 'updated') {
    rowsQuery = rowsQuery.order('updated_at', { ascending: query.order === 'asc' });
  }

  const from = (query.page - 1) * query.pageSize;

  const countQuery = supabase
    .from('medicines')
    .select('id', { count: 'exact', head: true })
    .eq('pharmacy_id', pharmacyId);
  if (!query.includeArchived) {
    countQuery.eq('is_archived', false);
  }

  const [countResult, rowsResult] = await Promise.all([
    countQuery,
    rowsQuery.range(from, from + query.pageSize - 1),
  ]);

  if (countResult.error || rowsResult.error) {
    throw ApiError.internal(
      `Unable to list medicines: ${(countResult.error ?? rowsResult.error)?.message ?? 'unknown'}`,
    );
  }

  const medicines = (rowsResult.data ?? []).map((row) => mapMedicine(row as MedicineRow));

  // Aggregate batches for the page's medicines (indexed by pharmacy_id).
  let items: MedicineListItem[] = medicines.map((medicine) => ({
    ...medicine,
    stock: {
      quantity: 0,
      level: 'OUT_OF_STOCK' as StockLevel,
      nearestExpiry: null,
      expiredBatches: 0,
      batchCount: 0,
    },
  }));

  if (medicines.length > 0) {
    const { data: batchRows, error: batchError } = await getSupabaseAdmin()
      .from('batches')
      .select('medicine_id, quantity, status, expiry_date')
      .eq('pharmacy_id', pharmacyId)
      .in(
        'medicine_id',
        medicines.map((medicine) => medicine.id),
      );

    if (batchError) {
      throw ApiError.internal(`Unable to load stock levels: ${batchError.message}`);
    }

    const batchesByMedicine = new Map<string, { quantity: number; status: string; expiry_date: string }[]>();
    for (const row of (batchRows ?? []) as {
      medicine_id: string;
      quantity: number;
      status: string;
      expiry_date: string;
    }[]) {
      const list = batchesByMedicine.get(row.medicine_id) ?? [];
      list.push(row);
      batchesByMedicine.set(row.medicine_id, list);
    }

    items = medicines.map((medicine) => ({
      ...medicine,
      stock: summarize(
        medicine,
        (batchesByMedicine.get(medicine.id) ?? []).map((row) => ({
          quantity: row.quantity,
          status: row.status,
          expiry: row.expiry_date,
        })),
        now,
      ),
    }));
  }

  // Post-aggregation sorting for computed columns.
  const direction = query.order === 'asc' ? 1 : -1;
  if (query.sort === 'stock') {
    items.sort((a, b) => direction * (a.stock.quantity - b.stock.quantity));
  } else if (query.sort === 'expiry') {
    items.sort((a, b) => {
      const left = a.stock.nearestExpiry ?? '9999-12-31';
      const right = b.stock.nearestExpiry ?? '9999-12-31';
      return direction * left.localeCompare(right);
    });
  }

  // Status filter is inherently post-aggregation (stock level is computed).
  if (query.status !== 'all') {
    items = items.filter((item) => {
      if (query.status === 'in_stock') return item.stock.level === 'IN_STOCK';
      if (query.status === 'low_stock') return item.stock.level === 'LOW_STOCK';
      if (query.status === 'out_of_stock') return item.stock.level === 'OUT_OF_STOCK';
      return item.stock.expiredBatches > 0; // 'expired'
    });
  }

  const total = countResult.count ?? 0;
  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getMedicineDetail(
  pharmacyId: string,
  medicineId: string,
): Promise<MedicineDetail> {
  const supabase = getSupabaseAdmin();

  const [medicineResult, batchResult] = await Promise.all([
    supabase.from('medicines').select('*').eq('pharmacy_id', pharmacyId).eq('id', medicineId).single(),
    supabase
      .from('batches')
      .select('*')
      .eq('pharmacy_id', pharmacyId)
      .eq('medicine_id', medicineId)
      .order('expiry_date', { ascending: true }), // FEFO order (PRD FR-011)
  ]);

  if (medicineResult.error || !medicineResult.data) {
    if ((medicineResult.error as { code?: string } | null)?.code === 'PGRST116') {
      throw ApiError.notFound('Medicine not found');
    }
    throw ApiError.internal(
      `Unable to load medicine: ${medicineResult.error?.message ?? 'unknown'}`,
    );
  }
  if (batchResult.error) {
    throw ApiError.internal(`Unable to load batches: ${batchResult.error.message}`);
  }

  const medicine = mapMedicine(medicineResult.data as MedicineRow);
  const batches = (batchResult.data ?? []).map((row) => mapBatch(row as Record<string, unknown>));

  return {
    medicine,
    batches,
    stock: summarize(
      medicine,
      batches.map((batch) => ({
        quantity: batch.quantity,
        status: batch.status,
        expiry: batch.expiryDate,
      })),
      new Date(),
    ),
  };
}

/**
 * Duplicate detection (PRD §12): same name (case/spacing-insensitive), or
 * same manufacturer + strength. Returns the candidates as 409 details so
 * DuplicateWarning can ask for explicit confirmation.
 */
async function findPotentialDuplicates(
  pharmacyId: string,
  input: { name: string; strength?: string; manufacturer?: string },
): Promise<PotentialDuplicate[]> {
  const supabase = getSupabaseAdmin();
  const normalized = input.name.toLowerCase().replace(/\s+/g, '');

  const { data, error } = await supabase
    .from('medicines')
    .select('id, name, strength, manufacturer, is_archived')
    .eq('pharmacy_id', pharmacyId)
    .ilike('name', `%${input.name.split(/\s+/)[0] ?? input.name}%`)
    .limit(25);

  if (error) return [];

  return (data as {
    id: string;
    name: string;
    strength: string | null;
    manufacturer: string | null;
    is_archived: boolean;
  }[]).map((row) => ({
    id: row.id,
    name: row.name,
    strength: row.strength,
    manufacturer: row.manufacturer,
    isArchived: Boolean(row.is_archived),
  })).filter((candidate) => {
    const candidateNormalized = candidate.name.toLowerCase().replace(/\s+/g, '');
    if (candidateNormalized === normalized) return true;
    const sameOrigin =
      input.manufacturer !== undefined &&
      candidate.manufacturer !== null &&
      candidate.manufacturer.toLowerCase() === input.manufacturer.toLowerCase() &&
      input.strength !== undefined &&
      candidate.strength !== null &&
      candidate.strength.toLowerCase() === input.strength.toLowerCase();
    return sameOrigin;
  });
}

export async function createMedicine(
  pharmacyId: string,
  userId: string,
  input: CreateMedicineInput,
): Promise<Medicine> {
  const supabase = getSupabaseAdmin();

  if (!input.confirmDuplicate) {
    const duplicates = await findPotentialDuplicates(pharmacyId, input);
    if (duplicates.length > 0) {
      throw ApiError.conflict('A similar medicine already exists in this pharmacy', {
        potentialDuplicates: duplicates,
      });
    }
  }

  const { data, error } = await supabase
    .from('medicines')
    .insert({
      pharmacy_id: pharmacyId,
      name: input.name,
      generic_name: input.genericName ?? null,
      strength: input.strength ?? null,
      dosage_form: input.dosageForm ?? null,
      manufacturer: input.manufacturer ?? null,
      barcode: input.barcode ?? null,
      category: input.category ?? null,
      reorder_level: input.reorderLevel,
      safety_stock: input.safetyStock,
      purchase_price: input.purchasePrice ?? null,
      selling_price: input.sellingPrice ?? null,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw ApiError.internal(`Unable to create medicine: ${error?.message ?? 'unknown'}`);
  }
  return mapMedicine(data as MedicineRow);
}

export async function updateMedicine(
  pharmacyId: string,
  medicineId: string,
  input: UpdateMedicineInput,
): Promise<Medicine> {
  const supabase = getSupabaseAdmin();

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.genericName !== undefined) patch.generic_name = input.genericName ?? null;
  if (input.strength !== undefined) patch.strength = input.strength ?? null;
  if (input.dosageForm !== undefined) patch.dosage_form = input.dosageForm ?? null;
  if (input.manufacturer !== undefined) patch.manufacturer = input.manufacturer ?? null;
  if (input.barcode !== undefined) patch.barcode = input.barcode ?? null;
  if (input.category !== undefined) patch.category = input.category ?? null;
  if (input.reorderLevel !== undefined) patch.reorder_level = input.reorderLevel;
  if (input.safetyStock !== undefined) patch.safety_stock = input.safetyStock;
  if (input.purchasePrice !== undefined) patch.purchase_price = input.purchasePrice ?? null;
  if (input.sellingPrice !== undefined) patch.selling_price = input.sellingPrice ?? null;

  if (Object.keys(patch).length === 0) {
    throw ApiError.validation('No fields to update');
  }

  const { data, error } = await supabase
    .from('medicines')
    .update(patch)
    .eq('pharmacy_id', pharmacyId)
    .eq('id', medicineId)
    .select('*')
    .single();

  if (error || !data) {
    if ((error as { code?: string } | null)?.code === 'PGRST116') {
      throw ApiError.notFound('Medicine not found');
    }
    throw ApiError.internal(`Unable to update medicine: ${error?.message ?? 'unknown'}`);
  }
  return mapMedicine(data as MedicineRow);
}

export async function setMedicineArchived(
  pharmacyId: string,
  medicineId: string,
  archived: boolean,
): Promise<Medicine> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('medicines')
    .update({ is_archived: archived })
    .eq('pharmacy_id', pharmacyId)
    .eq('id', medicineId)
    .select('*')
    .single();

  if (error || !data) {
    if ((error as { code?: string } | null)?.code === 'PGRST116') {
      throw ApiError.notFound('Medicine not found');
    }
    throw ApiError.internal(`Unable to archive medicine: ${error?.message ?? 'unknown'}`);
  }
  return mapMedicine(data as MedicineRow);
}

export async function deleteMedicine(
  pharmacyId: string,
  medicineId: string,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  // sales.medicine_id is ON DELETE RESTRICT - historical records are never
  // orphaned. The route surfaces the FK failure as a 409 suggesting archive.
  const { error } = await supabase
    .from('medicines')
    .delete()
    .eq('pharmacy_id', pharmacyId)
    .eq('id', medicineId);

  if (error) {
    if ((error as { code?: string } | null)?.code === '23503') {
      throw ApiError.conflict(
        'This medicine has sales history and cannot be deleted. Archive it instead.',
      );
    }
    if ((error as { code?: string } | null)?.code === 'PGRST116') {
      throw ApiError.notFound('Medicine not found');
    }
    throw ApiError.internal(`Unable to delete medicine: ${error.message}`);
  }
}
