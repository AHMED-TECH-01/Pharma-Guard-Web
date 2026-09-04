import type {
  AnalyticsInventory,
  AnalyticsOverview,
  AnalyticsReorders,
  AnalyticsSales,
  DeadStockItem,
  ExpirySummary,
  MoverItem,
  OverstockItem,
  SlowMoverItem,
} from '@pharmaguard/types';
import { getSupabaseAdmin } from '../../database/supabase.js';
import { ApiError } from '../../utils/api-error.js';
import { getExpirySummary } from '../safety/expiry.service.js';

/**
 * Analytics aggregates (TRD §7 Analytics, PRD §10.17).
 *
 * All queries are pharmacy-scoped on the 0001 indexes; PostgREST returns
 * numeric columns as strings, so money values are normalized with toNumber
 * (same discipline as dashboard.service). Margins are reported only when
 * purchase prices exist on the referenced batches ("when configured").
 *
 * Health score (transparent penalty model, documented in healthNotes):
 *   expiry exposure  -<=30 pts  value of expired+critical stock vs inventory value
 *   out of stock     -<=25 pts  share of medicines with zero stock
 *   low stock        -<=10 pts  share of medicines at/below reorder level
 *   dead stock       -<=20 pts  value of zero-movement stock vs inventory value
 *   overstock        -<=10 pts  excess-unit value vs inventory value
 * Score = 100 - total penalties, clamped to 0..100.
 */

const MOVER_LIST_CAP = 20;
const SLOW_MOVER_UNITS = 5;
const REORDERS_TREND_DAYS = 30;

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Batch row with its medicine's fallback purchase price (to-one embed may arrive as array). */
interface BatchCostRow {
  medicine_id: string;
  quantity: number;
  purchase_price: string | number | null;
  medicines: { purchase_price: string | number | null } | { purchase_price: string | number | null }[] | null;
}

interface MedicineRow {
  id: string;
  name: string;
  strength: string | null;
  reorder_level: string | number;
  safety_stock: string | number;
}

interface StockAnalysis {
  inventoryValue: number;
  totalUnits: number;
  slowMovers: SlowMoverItem[];
  deadStock: DeadStockItem[];
  overstock: OverstockItem[];
  deadValue: number;
  excessValue: number;
  outOfStock: number;
  lowStock: number;
  totalMedicines: number;
}

/**
 * Shared per-medicine stock analysis used by both the overview health score
 * and the inventory analytics endpoint. Dead stock = stock on hand with zero
 * sales in 60 days; slow movers = still selling but <=5 units in 30 days;
 * overstock = stock above max(reorder level x2, safety stock).
 */
function computeStockAnalysis(
  batchRows: BatchCostRow[],
  medicineRows: MedicineRow[],
  unitsSold30: Map<string, number>,
  unitsSold60: Map<string, number>,
): StockAnalysis {
  const stockByMedicine = new Map<string, number>();
  const valueByMedicine = new Map<string, number>();

  for (const row of batchRows) {
    const medicinePrice = Array.isArray(row.medicines)
      ? row.medicines[0]?.purchase_price
      : row.medicines?.purchase_price;
    const unitCost = toNumber(row.purchase_price) || toNumber(medicinePrice);
    const value = row.quantity * unitCost;

    stockByMedicine.set(row.medicine_id, (stockByMedicine.get(row.medicine_id) ?? 0) + row.quantity);
    valueByMedicine.set(row.medicine_id, (valueByMedicine.get(row.medicine_id) ?? 0) + value);
  }

  let inventoryValue = 0;
  let totalUnits = 0;
  let outOfStock = 0;
  let lowStock = 0;
  const slowMovers: SlowMoverItem[] = [];
  const deadStock: DeadStockItem[] = [];
  const overstock: OverstockItem[] = [];
  let deadValue = 0;
  let excessValue = 0;

  for (const medicine of medicineRows) {
    const stock = stockByMedicine.get(medicine.id) ?? 0;
    const value = valueByMedicine.get(medicine.id) ?? 0;
    const units30 = unitsSold30.get(medicine.id) ?? 0;
    const units60 = unitsSold60.get(medicine.id) ?? 0;
    const reorderLevel = toNumber(medicine.reorder_level);
    const safetyStock = toNumber(medicine.safety_stock);

    inventoryValue += value;
    totalUnits += stock;

    if (stock <= 0) {
      outOfStock += 1;
    } else if (reorderLevel > 0 && stock <= reorderLevel) {
      lowStock += 1;
    }

    if (stock > 0 && units60 === 0) {
      deadStock.push({
        medicineId: medicine.id,
        medicineName: medicine.name,
        medicineStrength: medicine.strength,
        currentStock: stock,
        unitsSold60d: units60,
        valueAtCost: round2(value),
      });
      deadValue += value;
    } else if (stock > 0 && units30 <= SLOW_MOVER_UNITS) {
      slowMovers.push({
        medicineId: medicine.id,
        medicineName: medicine.name,
        medicineStrength: medicine.strength,
        currentStock: stock,
        unitsSold30d: units30,
        valueAtCost: round2(value),
      });
    }

    const threshold = Math.max(reorderLevel * 2, safetyStock);
    if (threshold > 0 && stock > threshold) {
      const excessUnits = stock - threshold;
      const excess = (excessUnits / Math.max(stock, 1)) * value;
      overstock.push({
        medicineId: medicine.id,
        medicineName: medicine.name,
        medicineStrength: medicine.strength,
        currentStock: stock,
        threshold: round2(threshold),
        excessUnits,
        valueAtCost: round2(excess),
      });
      excessValue += excess;
    }
  }

  const byValueDesc = (a: { valueAtCost: number }, b: { valueAtCost: number }) => b.valueAtCost - a.valueAtCost;
  slowMovers.sort(byValueDesc);
  deadStock.sort(byValueDesc);
  overstock.sort((a, b) => b.excessUnits - a.excessUnits);

  return {
    inventoryValue: round2(inventoryValue),
    totalUnits,
    slowMovers: slowMovers.slice(0, MOVER_LIST_CAP),
    deadStock: deadStock.slice(0, MOVER_LIST_CAP),
    overstock: overstock.slice(0, MOVER_LIST_CAP),
    deadValue,
    excessValue,
    outOfStock,
    lowStock,
    totalMedicines: medicineRows.length,
  };
}

async function fetchStockInputs(pharmacyId: string, now: Date): Promise<{
  batchRows: BatchCostRow[];
  medicineRows: MedicineRow[];
  unitsSold30: Map<string, number>;
  unitsSold60: Map<string, number>;
}> {
  const supabase = getSupabaseAdmin();
  const window60Start = addDays(startOfDay(now), -59).toISOString();
  const window30Start = addDays(startOfDay(now), -29).toISOString();

  const [batches, medicines, salesWindow] = await Promise.all([
    supabase
      .from('batches')
      .select('medicine_id, quantity, purchase_price, medicines(purchase_price)')
      .eq('pharmacy_id', pharmacyId)
      .eq('status', 'AVAILABLE')
      .gt('quantity', 0),
    supabase
      .from('medicines')
      .select('id, name, strength, reorder_level, safety_stock')
      .eq('pharmacy_id', pharmacyId)
      .eq('is_archived', false),
    supabase
      .from('sales')
      .select('medicine_id, quantity, sold_at')
      .eq('pharmacy_id', pharmacyId)
      .is('reversed_at', null)
      .gte('sold_at', window60Start),
  ]);

  if (batches.error || medicines.error || salesWindow.error) {
    const firstError = batches.error ?? medicines.error ?? salesWindow.error;
    throw ApiError.internal(`Unable to load analytics data: ${firstError?.message ?? 'unknown'}`);
  }

  const unitsSold30 = new Map<string, number>();
  const unitsSold60 = new Map<string, number>();
  for (const row of salesWindow.data ?? []) {
    const record = row as { medicine_id: string; quantity: number; sold_at: string };
    unitsSold60.set(record.medicine_id, (unitsSold60.get(record.medicine_id) ?? 0) + record.quantity);
    if (new Date(record.sold_at).getTime() >= new Date(window30Start).getTime()) {
      unitsSold30.set(record.medicine_id, (unitsSold30.get(record.medicine_id) ?? 0) + record.quantity);
    }
  }

  return {
    batchRows: (batches.data ?? []) as BatchCostRow[],
    medicineRows: (medicines.data ?? []) as MedicineRow[],
    unitsSold30,
    unitsSold60,
  };
}

export async function getOverview(pharmacyId: string): Promise<AnalyticsOverview> {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const today = startOfDay(now);
  const yesterday = addDays(today, -1);
  const window30Start = addDays(today, -29);

  const [sales, stockInputs, expiry] = await Promise.all([
    supabase
      .from('sales')
      .select('quantity, unit_price, total_amount, sold_at, batches(purchase_price)')
      .eq('pharmacy_id', pharmacyId)
      .is('reversed_at', null)
      .gte('sold_at', window30Start.toISOString()),
    fetchStockInputs(pharmacyId, now),
    getExpirySummary(pharmacyId, now),
  ]);

  if (sales.error) {
    throw ApiError.internal(`Unable to load sales analytics: ${sales.error.message}`);
  }

  const analysis = computeStockAnalysis(
    stockInputs.batchRows,
    stockInputs.medicineRows,
    stockInputs.unitsSold30,
    stockInputs.unitsSold60,
  );

  let revenue30d = 0;
  let unitsSold30d = 0;
  let marginSum = 0;
  let marginRows = 0;
  let salesToday = 0;
  let salesYesterday = 0;

  for (const row of sales.data ?? []) {
    const record = row as {
      quantity: number;
      unit_price: string | number;
      total_amount: string | number;
      sold_at: string;
      batches: { purchase_price: string | number | null } | { purchase_price: string | number | null }[] | null;
    };
    const amount = toNumber(record.total_amount);
    revenue30d += amount;
    unitsSold30d += record.quantity;

    const batch = Array.isArray(record.batches) ? record.batches[0] : record.batches;
    const unitCost = toNumber(batch?.purchase_price);
    if (unitCost > 0) {
      marginSum += (toNumber(record.unit_price) - unitCost) * record.quantity;
      marginRows += 1;
    }

    const soldDate = isoDate(new Date(record.sold_at));
    if (soldDate === isoDate(today)) {
      salesToday += amount;
    } else if (soldDate === isoDate(yesterday)) {
      salesYesterday += amount;
    }
  }

  const salesDeltaPct =
    salesYesterday > 0
      ? Math.round(((salesToday - salesYesterday) / salesYesterday) * 1000) / 10
      : null;
  const grossMargin30d = marginRows > 0 ? round2(marginSum) : null;
  const marginPct =
    grossMargin30d !== null && revenue30d > 0
      ? Math.round((grossMargin30d / revenue30d) * 1000) / 10
      : null;

  // --- Health score (penalty model documented in the module docstring) -------
  const notes: string[] = [];
  let penalty = 0;

  const expiringValue = expiry.buckets
    .filter((card) => card.bucket === 'EXPIRED' || card.bucket === 'CRITICAL')
    .reduce((sum, card) => sum + card.valueAtCost, 0);
  if (analysis.inventoryValue > 0 && expiringValue > 0) {
    const expiryPenalty = Math.min(30, Math.round((expiringValue / analysis.inventoryValue) * 100));
    penalty += expiryPenalty;
    notes.push(
      `PKR ${Math.round(expiringValue).toLocaleString('en-PK')} of stock is expired or expires within 30 days (-${expiryPenalty} pts).`,
    );
  }

  if (analysis.totalMedicines > 0 && analysis.outOfStock > 0) {
    const outPenalty = Math.min(
      25,
      Math.round((analysis.outOfStock / analysis.totalMedicines) * 100 * 0.25),
    );
    penalty += outPenalty;
    notes.push(
      `${analysis.outOfStock} of ${analysis.totalMedicines} medicines are out of stock (-${outPenalty} pts).`,
    );
  }

  if (analysis.totalMedicines > 0 && analysis.lowStock > 0) {
    const lowPenalty = Math.min(
      10,
      Math.round((analysis.lowStock / analysis.totalMedicines) * 100 * 0.1),
    );
    penalty += lowPenalty;
    notes.push(
      `${analysis.lowStock} medicine${analysis.lowStock === 1 ? '' : 's'} at or below reorder level (-${lowPenalty} pts).`,
    );
  }

  if (analysis.inventoryValue > 0 && analysis.deadValue > 0) {
    const deadPenalty = Math.min(20, Math.round((analysis.deadValue / analysis.inventoryValue) * 50));
    penalty += deadPenalty;
    notes.push(
      `PKR ${Math.round(analysis.deadValue).toLocaleString('en-PK')} has not sold in 60 days (dead stock, -${deadPenalty} pts).`,
    );
  }

  if (analysis.inventoryValue > 0 && analysis.excessValue > 0) {
    const overstockPenalty = Math.min(
      10,
      Math.round((analysis.excessValue / analysis.inventoryValue) * 25),
    );
    penalty += overstockPenalty;
    notes.push(
      `PKR ${Math.round(analysis.excessValue).toLocaleString('en-PK')} sits above overstock thresholds (-${overstockPenalty} pts).`,
    );
  }

  if (notes.length === 0) {
    notes.push('No expiry, stock or movement risks detected. Keep it up.');
  }

  return {
    pharmacyId,
    generatedAt: now.toISOString(),
    salesToday: round2(salesToday),
    salesYesterday: round2(salesYesterday),
    salesDeltaPct,
    revenue30d: round2(revenue30d),
    unitsSold30d,
    grossMargin30d,
    marginPct,
    inventoryValue: analysis.inventoryValue,
    healthScore: clampScore(100 - penalty),
    healthNotes: notes,
  };
}

export async function getSalesAnalytics(
  pharmacyId: string,
  query: { observationDays: number },
): Promise<AnalyticsSales> {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const today = startOfDay(now);
  const windowStart = addDays(today, -(query.observationDays - 1));

  const sales = await supabase
    .from('sales')
    .select('medicine_id, quantity, unit_price, total_amount, sold_at, batches(purchase_price), medicines(name, strength)')
    .eq('pharmacy_id', pharmacyId)
    .is('reversed_at', null)
    .gte('sold_at', windowStart.toISOString());

  if (sales.error) {
    throw ApiError.internal(`Unable to load sales analytics: ${sales.error.message}`);
  }

  const trendTotals = new Map<string, number>();
  for (let offset = 0; offset < query.observationDays; offset += 1) {
    trendTotals.set(isoDate(addDays(windowStart, offset)), 0);
  }

  interface MoverAccumulator {
    name: string;
    strength: string | null;
    unitsSold: number;
    revenue: number;
    margin: number;
    marginRows: number;
  }
  const movers = new Map<string, MoverAccumulator>();

  for (const row of sales.data ?? []) {
    const record = row as {
      medicine_id: string;
      quantity: number;
      unit_price: string | number;
      total_amount: string | number;
      sold_at: string;
      batches: { purchase_price: string | number | null } | { purchase_price: string | number | null }[] | null;
      medicines: { name: string; strength: string | null } | { name: string; strength: string | null }[] | null;
    };

    const soldDate = isoDate(new Date(record.sold_at));
    if (trendTotals.has(soldDate)) {
      trendTotals.set(soldDate, (trendTotals.get(soldDate) ?? 0) + toNumber(record.total_amount));
    }

    const medicine = Array.isArray(record.medicines) ? record.medicines[0] : record.medicines;
    const accumulator = movers.get(record.medicine_id) ?? {
      name: medicine?.name ?? 'Unknown medicine',
      strength: medicine?.strength ?? null,
      unitsSold: 0,
      revenue: 0,
      margin: 0,
      marginRows: 0,
    };
    accumulator.unitsSold += record.quantity;
    accumulator.revenue += toNumber(record.total_amount);

    const batch = Array.isArray(record.batches) ? record.batches[0] : record.batches;
    const unitCost = toNumber(batch?.purchase_price);
    if (unitCost > 0) {
      accumulator.margin += (toNumber(record.unit_price) - unitCost) * record.quantity;
      accumulator.marginRows += 1;
    }
    movers.set(record.medicine_id, accumulator);
  }

  const trend = [...trendTotals.entries()].map(([date, total]) => ({
    date,
    label: dayLabel(date),
    total: round2(total),
  }));

  const fastMovers: MoverItem[] = [...movers.entries()]
    .map(([medicineId, accumulator]) => ({
      medicineId,
      medicineName: accumulator.name,
      medicineStrength: accumulator.strength,
      unitsSold: accumulator.unitsSold,
      revenue: round2(accumulator.revenue),
      margin: accumulator.marginRows > 0 ? round2(accumulator.margin) : null,
    }))
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, 5);

  return { observationDays: query.observationDays, trend, fastMovers };
}

export async function getInventoryAnalytics(pharmacyId: string): Promise<AnalyticsInventory> {
  const stockInputs = await fetchStockInputs(pharmacyId, new Date());
  const analysis = computeStockAnalysis(
    stockInputs.batchRows,
    stockInputs.medicineRows,
    stockInputs.unitsSold30,
    stockInputs.unitsSold60,
  );

  return {
    inventoryValue: analysis.inventoryValue,
    totalUnits: analysis.totalUnits,
    slowMovers: analysis.slowMovers,
    deadStock: analysis.deadStock,
    overstock: analysis.overstock,
  };
}

export async function getExpiryAnalytics(pharmacyId: string): Promise<ExpirySummary> {
  return getExpirySummary(pharmacyId);
}

export async function getReordersAnalytics(pharmacyId: string): Promise<AnalyticsReorders> {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const trendStart = addDays(startOfDay(now), -(REORDERS_TREND_DAYS - 1));

  const reorders = await supabase
    .from('reorders')
    .select('status, current_stock, created_at')
    .eq('pharmacy_id', pharmacyId);

  if (reorders.error) {
    throw ApiError.internal(`Unable to load reorder analytics: ${reorders.error.message}`);
  }

  const statusCounts = { suggested: 0, ordered: 0, received: 0, dismissed: 0 };
  const perDay = new Map<string, number>();
  for (let offset = 0; offset < REORDERS_TREND_DAYS; offset += 1) {
    perDay.set(isoDate(addDays(trendStart, offset)), 0);
  }
  let urgentCount = 0;

  for (const row of reorders.data ?? []) {
    const record = row as { status: string; current_stock: number; created_at: string };

    if (record.status === 'SUGGESTED' || record.status === 'ORDERED') {
      if (record.current_stock <= 0) urgentCount += 1;
    }
    if (record.status === 'SUGGESTED') statusCounts.suggested += 1;
    else if (record.status === 'ORDERED') statusCounts.ordered += 1;
    else if (record.status === 'RECEIVED') statusCounts.received += 1;
    else if (record.status === 'DISMISSED') statusCounts.dismissed += 1;

    const createdDate = isoDate(new Date(record.created_at));
    if (perDay.has(createdDate)) {
      perDay.set(createdDate, (perDay.get(createdDate) ?? 0) + 1);
    }
  }

  const createdPerDay = [...perDay.entries()].map(([date, count]) => ({
    date,
    label: dayLabel(date),
    count,
  }));

  return { statusCounts, createdPerDay, urgentCount };
}
