import type {
  ReorderListResponse,
  ReorderRecommendation,
  ReorderRecommendationsResponse,
  ReorderRecord,
} from '@pharmaguard/types';
import type {
  CreateReorderInput,
  ListReordersQuery,
  ReorderRecommendationsQuery,
  UpdateReorderInput,
} from '@pharmaguard/validation';
import type { Request } from 'express';
import { getSupabaseAdmin } from '../../database/supabase.js';
import { ApiError } from '../../utils/api-error.js';
import { writeAudit } from '../../utils/audit.js';

/**
 * Reorders service (PRD §10.12, TRD §11 Reorder Algorithm). Recommendations
 * are computed on read from sales history and live stock; records persist a
 * snapshot for history/status. No fabricated predictions: medicines without
 * sales history are flagged, never estimated.
 */

interface MedicineRow {
  id: string;
  name: string;
  strength: string | null;
  reorder_level: string | number;
  safety_stock: string | number;
}

const REORDER_SELECT =
  '*, medicines(name, strength), suppliers(name)';

interface ReorderRow {
  id: string;
  medicine_id: string;
  supplier_id: string | null;
  status: ReorderRecord['status'];
  observation_days: number;
  lead_time_days: number;
  average_daily_sales: string | number;
  current_stock: number;
  safety_stock: string | number;
  estimated_stockout_date: string | null;
  recommended_quantity: number;
  explanation: string;
  created_at: string;
  medicines: { name: string; strength: string | null } | null;
  suppliers: { name: string } | null;
}

function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number.parseFloat(value);
}

function mapRecord(row: ReorderRow): ReorderRecord {
  return {
    id: row.id,
    medicineId: row.medicine_id,
    medicineName: row.medicines?.name ?? 'Unknown medicine',
    medicineStrength: row.medicines?.strength ?? null,
    supplierId: row.supplier_id,
    supplierName: row.suppliers?.name ?? null,
    status: row.status,
    observationDays: row.observation_days,
    leadTimeDays: row.lead_time_days,
    averageDailySales: toNumber(row.average_daily_sales),
    currentStock: row.current_stock,
    safetyStock: toNumber(row.safety_stock),
    estimatedStockoutDate: row.estimated_stockout_date,
    recommendedQuantity: row.recommended_quantity,
    explanation: row.explanation,
    createdAt: row.created_at,
  };
}

/** Loads live stock, windowed sales, and medicines in parallel. */
async function loadComputationInputs(
  pharmacyId: string,
  observationDays: number,
): Promise<{
  medicines: MedicineRow[];
  stockByMedicine: Map<string, number>;
  soldByMedicine: Map<string, number>;
}> {
  const supabase = getSupabaseAdmin();
  const windowStart = new Date();
  windowStart.setUTCDate(windowStart.getUTCDate() - observationDays);

  const [medicinesResult, batchesResult, salesResult] = await Promise.all([
    supabase
      .from('medicines')
      .select('id, name, strength, reorder_level, safety_stock')
      .eq('pharmacy_id', pharmacyId)
      .eq('is_archived', false),
    supabase
      .from('batches')
      .select('medicine_id, quantity')
      .eq('pharmacy_id', pharmacyId)
      .eq('status', 'AVAILABLE')
      .gt('quantity', 0),
    supabase
      .from('sales')
      .select('medicine_id, quantity')
      .eq('pharmacy_id', pharmacyId)
      .is('reversed_at', null)
      .gte('sold_at', windowStart.toISOString()),
  ]);

  if (medicinesResult.error || batchesResult.error || salesResult.error) {
    const firstError = medicinesResult.error ?? batchesResult.error ?? salesResult.error;
    throw ApiError.internal(`Could not load reorder inputs: ${firstError?.message ?? 'unknown'}`);
  }

  const stockByMedicine = new Map<string, number>();
  for (const row of (batchesResult.data as unknown as { medicine_id: string; quantity: number }[]) ?? []) {
    stockByMedicine.set(row.medicine_id, (stockByMedicine.get(row.medicine_id) ?? 0) + row.quantity);
  }
  const soldByMedicine = new Map<string, number>();
  for (const row of (salesResult.data as unknown as { medicine_id: string; quantity: number }[]) ?? []) {
    soldByMedicine.set(row.medicine_id, (soldByMedicine.get(row.medicine_id) ?? 0) + row.quantity);
  }

  return {
    medicines: (medicinesResult.data as unknown as MedicineRow[]) ?? [],
    stockByMedicine,
    soldByMedicine,
  };
}

/** TRD §11: lead-time demand + safety stock - current stock, floored at 0. */
function computeRecommendation(
  medicine: MedicineRow,
  currentStock: number,
  unitsSold: number,
  observationDays: number,
  leadTimeDays: number,
): ReorderRecommendation {
  const safetyStock = toNumber(medicine.safety_stock);
  const reorderLevel = toNumber(medicine.reorder_level);
  const averageDailySales = unitsSold / observationDays;
  const sufficientHistory = unitsSold > 0;

  let recommendedQuantity = 0;
  let estimatedStockoutDate: string | null = null;
  let explanation: string;

  if (!sufficientHistory) {
    explanation =
      'Insufficient sales history. Enter a supplier lead time or collect more sales data.';
  } else {
    const leadTimeDemand = averageDailySales * leadTimeDays;
    const recommendedStock = leadTimeDemand + safetyStock;
    recommendedQuantity = Math.max(0, Math.ceil(recommendedStock - currentStock));
    if (currentStock > 0) {
      const daysLeft = Math.floor(currentStock / averageDailySales);
      const stockout = new Date();
      stockout.setUTCDate(stockout.getUTCDate() + daysLeft);
      estimatedStockoutDate = stockout.toISOString().slice(0, 10);
    }
    explanation =
      `Selling ~${averageDailySales.toFixed(2)} units/day over ${observationDays} days. ` +
      `Lead-time demand (${leadTimeDays}d) plus safety stock needs ${Math.ceil(recommendedStock)} units; ` +
      `current stock is ${currentStock}.`;
  }

  return {
    medicineId: medicine.id,
    medicineName: medicine.name,
    medicineStrength: medicine.strength,
    currentStock,
    reorderLevel,
    safetyStock,
    averageDailySales: Math.round(averageDailySales * 100) / 100,
    leadTimeDays,
    estimatedStockoutDate,
    recommendedQuantity,
    explanation,
    sufficientHistory,
  };
}

export async function getRecommendations(
  pharmacyId: string,
  query: ReorderRecommendationsQuery,
): Promise<ReorderRecommendationsResponse> {
  const { medicines, stockByMedicine, soldByMedicine } = await loadComputationInputs(
    pharmacyId,
    query.observationDays,
  );

  const recommendations: ReorderRecommendation[] = [];
  for (const medicine of medicines) {
    const currentStock = stockByMedicine.get(medicine.id) ?? 0;
    const unitsSold = soldByMedicine.get(medicine.id) ?? 0;
    const recommendation = computeRecommendation(
      medicine,
      currentStock,
      unitsSold,
      query.observationDays,
      query.leadTimeDays,
    );
    const isLowWithoutHistory =
      !recommendation.sufficientHistory && currentStock <= recommendation.reorderLevel;
    if (recommendation.sufficientHistory && recommendation.recommendedQuantity > 0) {
      recommendations.push(recommendation);
    } else if (isLowWithoutHistory) {
      recommendations.push(recommendation);
    }
  }

  recommendations.sort((a, b) => {
    if (a.sufficientHistory !== b.sufficientHistory) return a.sufficientHistory ? -1 : 1;
    if (a.sufficientHistory) {
      // Soonest stockout first; already-empty stock is most urgent.
      if (!a.estimatedStockoutDate && !b.estimatedStockoutDate) return 0;
      if (!a.estimatedStockoutDate) return -1;
      if (!b.estimatedStockoutDate) return 1;
      return a.estimatedStockoutDate.localeCompare(b.estimatedStockoutDate);
    }
    return a.currentStock - b.currentStock;
  });

  return {
    observationDays: query.observationDays,
    leadTimeDays: query.leadTimeDays,
    recommendations: recommendations.slice(0, 50),
  };
}

export async function createReorder(
  pharmacyId: string,
  userId: string,
  input: CreateReorderInput,
  request: Request,
): Promise<ReorderRecord> {
  const supabase = getSupabaseAdmin();

  const { medicines, stockByMedicine, soldByMedicine } = await loadComputationInputs(
    pharmacyId,
    input.observationDays,
  );
  const medicine = medicines.find((entry) => entry.id === input.medicineId);
  if (!medicine) throw ApiError.notFound('Medicine could not be found.');

  const recommendation = computeRecommendation(
    medicine,
    stockByMedicine.get(medicine.id) ?? 0,
    soldByMedicine.get(medicine.id) ?? 0,
    input.observationDays,
    input.leadTimeDays,
  );

  const { data, error } = await supabase
    .from('reorders')
    .insert({
      pharmacy_id: pharmacyId,
      medicine_id: input.medicineId,
      supplier_id: input.supplierId ?? null,
      status: 'SUGGESTED',
      observation_days: input.observationDays,
      lead_time_days: input.leadTimeDays,
      average_daily_sales: recommendation.averageDailySales,
      current_stock: recommendation.currentStock,
      safety_stock: recommendation.safetyStock,
      estimated_stockout_date: recommendation.estimatedStockoutDate,
      recommended_quantity: recommendation.recommendedQuantity,
      explanation: recommendation.explanation,
      created_by: userId,
    })
    .select(REORDER_SELECT)
    .single();
  if (error) throw ApiError.badRequest(`Could not record the reorder: ${error.message}`);

  const record = mapRecord(data as unknown as ReorderRow);
  await writeAudit({
    pharmacyId,
    userId,
    action: 'reorder.recorded',
    entityType: 'reorder',
    entityId: record.id,
    after: {
      medicineId: record.medicineId,
      medicineName: record.medicineName,
      recommendedQuantity: record.recommendedQuantity,
      leadTimeDays: record.leadTimeDays,
    },
    request,
  });
  return record;
}

export async function listReorders(
  pharmacyId: string,
  query: ListReordersQuery,
): Promise<ReorderListResponse> {
  const supabase = getSupabaseAdmin();
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let listQuery = supabase
    .from('reorders')
    .select(REORDER_SELECT, { count: 'exact' })
    .eq('pharmacy_id', pharmacyId)
    .order('created_at', { ascending: false });
  if (query.status) listQuery = listQuery.eq('status', query.status);

  const { data, error, count } = await listQuery.range(from, to);
  if (error) throw ApiError.internal(`Could not load reorders: ${error.message}`);

  return {
    reorders: ((data as unknown as ReorderRow[]) ?? []).map(mapRecord),
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function updateReorder(
  pharmacyId: string,
  userId: string,
  reorderId: string,
  input: UpdateReorderInput,
  request: Request,
): Promise<ReorderRecord> {
  const supabase = getSupabaseAdmin();
  const { data: existing, error: existingError } = await supabase
    .from('reorders')
    .select('id, status')
    .eq('id', reorderId)
    .eq('pharmacy_id', pharmacyId)
    .maybeSingle();
  if (existingError) throw ApiError.internal(`Could not load the reorder: ${existingError.message}`);
  if (!existing) throw ApiError.notFound('Reorder could not be found.');
  const current = existing as unknown as { id: string; status: ReorderRecord['status'] };
  if (current.status === 'RECEIVED' || current.status === 'DISMISSED') {
    throw ApiError.conflict('This reorder is already closed.');
  }

  const { data, error } = await supabase
    .from('reorders')
    .update({ status: input.status })
    .eq('id', reorderId)
    .eq('pharmacy_id', pharmacyId)
    .select(REORDER_SELECT)
    .single();
  if (error) throw ApiError.badRequest(`Could not update the reorder: ${error.message}`);

  const record = mapRecord(data as unknown as ReorderRow);
  await writeAudit({
    pharmacyId,
    userId,
    action: 'reorder.updated',
    entityType: 'reorder',
    entityId: reorderId,
    before: { status: current.status },
    after: { status: record.status },
    request,
  });
  return record;
}
