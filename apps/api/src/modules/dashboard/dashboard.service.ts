import type {
  ActionCenterTask,
  DashboardSummary,
  ExpiryBucket,
  ExpiryBucketKey,
  LowStockItem,
  RecentSaleItem,
} from '@pharmaguard/types';
import { getSupabaseAdmin } from '../../database/supabase.js';
import { ApiError } from '../../utils/api-error.js';

/**
 * Dashboard aggregates (TRD §14, PRD §10.5).
 *
 * All queries are pharmacy-scoped and hit the indexes created in migration
 * 0001. PostgREST returns numeric columns as strings, so every money value
 * is normalized with toNumber before aggregation.
 *
 * Day boundaries use the server's local timezone; deployment should set
 * TZ to the pharmacy market (Asia/Karachi) so "today" matches the business.
 */

const EXPIRING_DAYS = 30;
const WARNING_DAYS = 90;
const TREND_DAYS = 7;

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
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

function daysUntil(dateStr: string, now: Date): number {
  const expiry = new Date(`${dateStr}T00:00:00`);
  const today = startOfDay(now);
  return Math.round((expiry.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function bucketFor(daysLeft: number): ExpiryBucketKey {
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= EXPIRING_DAYS) return 'critical';
  if (daysLeft <= WARNING_DAYS) return 'warning';
  return 'safe';
}

const BUCKET_LABELS: Record<ExpiryBucketKey, string> = {
  expired: 'Expired',
  critical: `0-${EXPIRING_DAYS} days`,
  warning: `${EXPIRING_DAYS + 1}-${WARNING_DAYS} days`,
  safe: `> ${WARNING_DAYS} days`,
};

function buildAiSummary(parts: {
  todaySalesTotal: number;
  expiringSoonBatches: number;
  expiredBatches: number;
  lowStockMedicines: number;
  outOfStockMedicines: number;
  unreadAlertsCount: number;
}): string {
  const sentences: string[] = [];

  sentences.push(
    parts.todaySalesTotal > 0
      ? `Today's sales so far: PKR ${Math.round(parts.todaySalesTotal).toLocaleString('en-PK')}.`
      : 'No sales recorded yet today.',
  );

  if (parts.expiredBatches > 0) {
    sentences.push(
      `${parts.expiredBatches} expired batch${parts.expiredBatches === 1 ? '' : 'es'} need quarantine before they can be sold.`,
    );
  }
  if (parts.expiringSoonBatches > 0) {
    sentences.push(
      `${parts.expiringSoonBatches} batch${parts.expiringSoonBatches === 1 ? '' : 'es'} expire within ${EXPIRING_DAYS} days - prioritise first-expiry-first-out sales.`,
    );
  }
  if (parts.lowStockMedicines > 0 || parts.outOfStockMedicines > 0) {
    const stockParts: string[] = [];
    if (parts.lowStockMedicines > 0) stockParts.push(`${parts.lowStockMedicines} at or below reorder level`);
    if (parts.outOfStockMedicines > 0) stockParts.push(`${parts.outOfStockMedicines} out of stock`);
    sentences.push(`Stock attention needed: ${stockParts.join(' and ')}.`);
  }
  if (
    parts.expiredBatches === 0 &&
    parts.expiringSoonBatches === 0 &&
    parts.lowStockMedicines === 0 &&
    parts.outOfStockMedicines === 0
  ) {
    sentences.push('No expiry or stock risks detected today.');
  }
  if (parts.unreadAlertsCount > 0) {
    sentences.push(`${parts.unreadAlertsCount} new alert${parts.unreadAlertsCount === 1 ? '' : 's'} waiting in the Alerts Center.`);
  }

  return sentences.join(' ');
}

export async function getDashboardSummary(pharmacyId: string): Promise<DashboardSummary> {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const today = startOfDay(now);
  const yesterday = addDays(today, -1);
  const trendStart = addDays(today, -(TREND_DAYS - 1));
  const expiringUntil = addDays(today, EXPIRING_DAYS);

  const pharmacyResult = supabase
    .from('pharmacies')
    .select('name, currency')
    .eq('id', pharmacyId)
    .single();

  const availableBatchesQuery = supabase
    .from('batches')
    .select('medicine_id, quantity, purchase_price, expiry_date, medicines(purchase_price)')
    .eq('pharmacy_id', pharmacyId)
    .eq('status', 'AVAILABLE')
    .gt('quantity', 0);

  const medicinesQuery = supabase
    .from('medicines')
    .select('id, name, strength, reorder_level')
    .eq('pharmacy_id', pharmacyId)
    .eq('is_archived', false);

  const salesQuery = supabase
    .from('sales')
    .select('sold_at, total_amount')
    .eq('pharmacy_id', pharmacyId)
    .is('reversed_at', null)
    .gte('sold_at', trendStart.toISOString());

  const expiringSoonQuery = supabase
    .from('batches')
    .select('id, batch_no, expiry_date, quantity, medicines(name, strength)')
    .eq('pharmacy_id', pharmacyId)
    .eq('status', 'AVAILABLE')
    .gt('quantity', 0)
    .gte('expiry_date', isoDate(today))
    .lte('expiry_date', isoDate(expiringUntil))
    .order('expiry_date', { ascending: true })
    .limit(6);

  const recentSalesQuery = supabase
    .from('sales')
    .select('id, quantity, total_amount, sold_at, medicines(name, strength), batches(batch_no)')
    .eq('pharmacy_id', pharmacyId)
    .is('reversed_at', null)
    .order('sold_at', { ascending: false })
    .limit(5);

  const alertsQuery = supabase
    .from('alerts')
    .select('id, severity, title, message, status, created_at')
    .eq('pharmacy_id', pharmacyId)
    .in('status', ['NEW', 'READ'])
    .order('created_at', { ascending: false })
    .limit(5);

  const unreadCountQuery = supabase
    .from('alerts')
    .select('id', { count: 'exact', head: true })
    .eq('pharmacy_id', pharmacyId)
    .eq('status', 'NEW');

  const quarantinedCountQuery = supabase
    .from('batches')
    .select('id', { count: 'exact', head: true })
    .eq('pharmacy_id', pharmacyId)
    .eq('status', 'QUARANTINED');

  const [
    pharmacyResultDone,
    availableBatches,
    medicines,
    sales,
    expiringSoonRows,
    recentSalesRows,
    alertRows,
    unreadCount,
    quarantinedCount,
  ] = await Promise.all([
    pharmacyResult,
    availableBatchesQuery,
    medicinesQuery,
    salesQuery,
    expiringSoonQuery,
    recentSalesQuery,
    alertsQuery,
    unreadCountQuery,
    quarantinedCountQuery,
  ]);

  if (pharmacyResultDone.error || availableBatches.error || medicines.error || sales.error) {
    const firstError =
      pharmacyResultDone.error ??
      availableBatches.error ??
      medicines.error ??
      sales.error;
    throw ApiError.internal(`Unable to load dashboard data: ${firstError?.message ?? 'unknown'}`);
  }

  const pharmacyName =
    (pharmacyResultDone.data as { name: string | null } | null)?.name ?? null;
  const currency =
    (pharmacyResultDone.data as { currency: string | null } | null)?.currency ?? 'PKR';

  // --- Inventory value + expiry buckets + per-medicine quantities -----------
  let totalStockValue = 0;
  const bucketCounts: Record<ExpiryBucketKey, number> = {
    expired: 0,
    critical: 0,
    warning: 0,
    safe: 0,
  };
  const quantityByMedicine = new Map<string, number>();

  for (const row of availableBatches.data ?? []) {
    const record = row as {
      medicine_id: string;
      quantity: number;
      purchase_price: string | number | null;
      expiry_date: string;
      medicines: { purchase_price: string | number | null } | { purchase_price: string | number | null }[] | null;
    };
    const quantity = record.quantity;
    const medicinePrice = Array.isArray(record.medicines)
      ? record.medicines[0]?.purchase_price
      : record.medicines?.purchase_price;
    const unitCost = toNumber(record.purchase_price) || toNumber(medicinePrice);
    totalStockValue += quantity * unitCost;

    const bucketKey = bucketFor(daysUntil(record.expiry_date, now));
    bucketCounts[bucketKey] = (bucketCounts[bucketKey] ?? 0) + 1;
    quantityByMedicine.set(
      record.medicine_id,
      (quantityByMedicine.get(record.medicine_id) ?? 0) + quantity,
    );
  }

  const totalBatches =
    (bucketCounts.expired ?? 0) +
    (bucketCounts.critical ?? 0) +
    (bucketCounts.warning ?? 0) +
    (bucketCounts.safe ?? 0);
  const buckets: ExpiryBucket[] = (
    Object.keys(bucketCounts) as ExpiryBucketKey[]
  ).map((key) => ({ key, label: BUCKET_LABELS[key], count: bucketCounts[key] }));

  // --- Stock status (per medicine, archived excluded) -----------------------
  let inStock = 0;
  let lowStock = 0;
  let outOfStock = 0;
  const lowStockItems: LowStockItem[] = [];

  for (const row of medicines.data ?? []) {
    const medicine = row as {
      id: string;
      name: string;
      strength: string | null;
      reorder_level: string | number;
    };
    const quantity = quantityByMedicine.get(medicine.id) ?? 0;
    const reorderLevel = toNumber(medicine.reorder_level);

    if (quantity <= 0) {
      outOfStock += 1;
      if (reorderLevel > 0) {
        lowStockItems.push({
          medicineId: medicine.id,
          name: medicine.name,
          strength: medicine.strength,
          quantity,
          reorderLevel,
        });
      }
    } else if (reorderLevel > 0 && quantity <= reorderLevel) {
      lowStock += 1;
      lowStockItems.push({
        medicineId: medicine.id,
        name: medicine.name,
        strength: medicine.strength,
        quantity,
        reorderLevel,
      });
    } else {
      inStock += 1;
    }
  }
  lowStockItems.sort(
    (a, b) => a.quantity / Math.max(a.reorderLevel, 1) - b.quantity / Math.max(b.reorderLevel, 1),
  );

  // --- Sales trend + today/yesterday totals ---------------------------------
  const trendTotals = new Map<string, number>();
  for (let offset = 0; offset < TREND_DAYS; offset += 1) {
    const day = addDays(trendStart, offset);
    trendTotals.set(isoDate(day), 0);
  }

  let todaySalesTotal = 0;
  let yesterdaySalesTotal = 0;

  for (const row of sales.data ?? []) {
    const record = row as { sold_at: string; total_amount: string | number };
    const amount = toNumber(record.total_amount);
    const soldDate = isoDate(new Date(record.sold_at));

    if (trendTotals.has(soldDate)) {
      trendTotals.set(soldDate, (trendTotals.get(soldDate) ?? 0) + amount);
    }
    if (soldDate === isoDate(today)) {
      todaySalesTotal += amount;
    } else if (soldDate === isoDate(yesterday)) {
      yesterdaySalesTotal += amount;
    }
  }

  const salesTrend = [...trendTotals.entries()].map(([date, total]) => ({
    date,
    label: new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' }),
    total,
  }));

  const todaySalesDeltaPct =
    yesterdaySalesTotal > 0
      ? Math.round(((todaySalesTotal - yesterdaySalesTotal) / yesterdaySalesTotal) * 1000) / 10
      : null;

  // --- Lists ----------------------------------------------------------------
  const expiringSoon = (expiringSoonRows.data ?? []).map((row) => {
    const record = row as {
      id: string;
      batch_no: string;
      expiry_date: string;
      quantity: number;
      medicines: { name: string; strength: string | null } | { name: string; strength: string | null }[] | null;
    };
    const medicine = Array.isArray(record.medicines) ? record.medicines[0] : record.medicines;
    return {
      batchId: record.id,
      medicineName: medicine?.name ?? 'Unknown medicine',
      strength: medicine?.strength ?? null,
      batchNo: record.batch_no,
      expiryDate: record.expiry_date,
      quantity: record.quantity,
      daysLeft: daysUntil(record.expiry_date, now),
    };
  });

  const recentSales: RecentSaleItem[] = (recentSalesRows.data ?? []).map((row) => {
    const record = row as {
      id: string;
      quantity: number;
      total_amount: string | number;
      sold_at: string;
      medicines: { name: string; strength: string | null } | { name: string; strength: string | null }[] | null;
      batches: { batch_no: string } | { batch_no: string }[] | null;
    };
    const medicine = Array.isArray(record.medicines) ? record.medicines[0] : record.medicines;
    const batch = Array.isArray(record.batches) ? record.batches[0] : record.batches;
    return {
      saleId: record.id,
      medicineName: medicine?.name ?? 'Unknown medicine',
      strength: medicine?.strength ?? null,
      batchNo: batch?.batch_no ?? '-',
      quantity: record.quantity,
      totalAmount: toNumber(record.total_amount),
      soldAt: record.sold_at,
    };
  });

  const recentAlerts = (alertRows.data ?? []).map((row) => {
    const record = row as {
      id: string;
      severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
      title: string;
      message: string;
      created_at: string;
    };
    return {
      alertId: record.id,
      severity: record.severity,
      title: record.title,
      message: record.message,
      createdAt: record.created_at,
    };
  });

  const expiredBatches = bucketCounts.expired ?? 0;
  const expiringSoonBatches = bucketCounts.critical ?? 0;
  const unreadAlertsCount = unreadCount.count ?? 0;

  // --- Action center (server-ranked, target routes land in later phases) ----
  const actionCenter: ActionCenterTask[] = [];
  if (expiredBatches > 0) {
    actionCenter.push({
      id: 'quarantine-expired',
      severity: 'CRITICAL',
      title: `Quarantine ${expiredBatches} expired batch${expiredBatches === 1 ? '' : 'es'}`,
      description: 'Expired stock must be pulled from saleable inventory immediately.',
      target: '/expiry',
    });
  }
  if (outOfStock > 0) {
    actionCenter.push({
      id: 'restock-out',
      severity: 'HIGH',
      title: `Restock ${outOfStock} out-of-stock medicine${outOfStock === 1 ? '' : 's'}`,
      description: 'These medicines cannot serve any prescription right now.',
      target: '/reorders',
    });
  }
  if (expiringSoonBatches > 0) {
    actionCenter.push({
      id: 'review-expiring',
      severity: 'HIGH',
      title: `Review ${expiringSoonBatches} batch${expiringSoonBatches === 1 ? '' : 'es'} expiring within ${EXPIRING_DAYS} days`,
      description: 'Prioritise FEFO sales or arrange supplier returns in time.',
      target: '/expiry',
    });
  }
  if (lowStock > 0) {
    actionCenter.push({
      id: 'reorder-low',
      severity: 'MEDIUM',
      title: `Reorder ${lowStock} low-stock medicine${lowStock === 1 ? '' : 's'}`,
      description: 'Quantities are at or below the configured reorder level.',
      target: '/reorders',
    });
  }
  if (unreadAlertsCount > 0) {
    actionCenter.push({
      id: 'review-alerts',
      severity: 'LOW',
      title: `Review ${unreadAlertsCount} new alert${unreadAlertsCount === 1 ? '' : 's'}`,
      description: 'Unreviewed alerts may hide emerging inventory risks.',
      target: '/alerts',
    });
  }

  return {
    pharmacyId,
    pharmacyName,
    currency,
    generatedAt: now.toISOString(),
    kpis: {
      totalStockValue,
      expiringSoonBatches,
      expiredBatches,
      lowStockMedicines: lowStock,
      outOfStockMedicines: outOfStock,
      todaySalesTotal,
      todaySalesDeltaPct,
    },
    salesTrend,
    expiryOverview: { totalBatches, buckets },
    stockStatus: {
      inStock,
      lowStock,
      outOfStock,
      expired: expiredBatches,
      quarantined: quarantinedCount.count ?? 0,
    },
    lowStockItems: lowStockItems.slice(0, 5),
    expiringSoon,
    recentSales,
    recentAlerts,
    unreadAlertsCount,
    actionCenter: actionCenter.slice(0, 5),
    aiSummarySource: 'rules',
    aiSummary: buildAiSummary({
      todaySalesTotal,
      expiringSoonBatches,
      expiredBatches,
      lowStockMedicines: lowStock,
      outOfStockMedicines: outOfStock,
      unreadAlertsCount,
    }),
  };
}
