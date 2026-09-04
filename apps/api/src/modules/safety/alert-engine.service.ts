import type { AlertSeverity, AlertType } from '@pharmaguard/types';
import { getSupabaseAdmin } from '../../database/supabase.js';
import { classifyBatch, expiryThresholds } from './expiry.util.js';

/**
 * Alert engine (PRD §10.18, TRD §34 Day 2 "Expiry engine + Alerts").
 *
 * Evaluates one pharmacy's inventory and inserts EXPIRED / EXPIRING /
 * LOW_STOCK alerts, skipping any (type, batch|medicine) pair that already
 * has an unresolved alert - re-running never duplicates.
 *
 * Trigger model (documented deviation): the TRD defines no scheduler, so the
 * engine runs lazily - throttled to at most once per pharmacy per minute -
 * when the Alerts Center or Expiry Center is opened. QUARANTINE / RECALL
 * alerts are created directly by their services when those events happen.
 */

/** Minimum milliseconds between engine runs for the same pharmacy. */
const RUN_THROTTLE_MS = 60_000;

const lastRunAt = new Map<string, number>();

/** True (and records the run) when an evaluation is due for this pharmacy. */
function shouldRun(pharmacyId: string, now: Date): boolean {
  const last = lastRunAt.get(pharmacyId) ?? 0;
  if (now.getTime() - last < RUN_THROTTLE_MS) return false;
  lastRunAt.set(pharmacyId, now.getTime());
  return true;
}

/** Test hook: clear the throttle map. */
export function resetAlertEngineThrottle(): void {
  lastRunAt.clear();
}

type BatchRow = {
  id: string;
  medicine_id: string;
  batch_no: string;
  quantity: number;
  status: string;
  expiry_date: string;
};

type MedicineRow = {
  id: string;
  name: string;
  strength: string | null;
  reorder_level: number;
  is_archived: boolean;
};

type UnresolvedAlertRow = { type: string; medicine_id: string | null; batch_id: string | null };

interface PendingAlert {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  medicineId: string | null;
  batchId: string | null;
}

function unitsLabel(quantity: number): string {
  return `${quantity} unit${quantity === 1 ? '' : 's'}`;
}

export interface AlertEngineResult {
  created: number;
  skipped: number;
}

/**
 * Runs the engine for a pharmacy if the throttle allows. Never throws - a
 * failing engine must not break the read endpoints that trigger it.
 */
export async function runAlertEngine(
  pharmacyId: string,
  now: Date = new Date(),
): Promise<AlertEngineResult> {
  try {
    if (!shouldRun(pharmacyId, now)) {
      return { created: 0, skipped: 0 };
    }
    return await evaluate(pharmacyId, now);
  } catch (error) {
    console.error('[alert-engine] evaluation failed', error);
    return { created: 0, skipped: 0 };
  }
}

async function evaluate(pharmacyId: string, now: Date): Promise<AlertEngineResult> {
  const supabase = getSupabaseAdmin();
  const { criticalDays, warningDays } = expiryThresholds();

  const [batchesResult, medicinesResult, unresolvedResult] = await Promise.all([
    supabase
      .from('batches')
      .select('id, medicine_id, batch_no, quantity, status, expiry_date')
      .eq('pharmacy_id', pharmacyId)
      .in('status', ['AVAILABLE', 'QUARANTINED'])
      .gt('quantity', 0),
    supabase
      .from('medicines')
      .select('id, name, strength, reorder_level, is_archived')
      .eq('pharmacy_id', pharmacyId)
      .eq('is_archived', false),
    supabase
      .from('alerts')
      .select('type, medicine_id, batch_id')
      .eq('pharmacy_id', pharmacyId)
      .neq('status', 'RESOLVED'),
  ]);

  if (batchesResult.error || medicinesResult.error || unresolvedResult.error) {
    throw new Error(
      batchesResult.error?.message ??
        medicinesResult.error?.message ??
        unresolvedResult.error?.message ??
        'unknown error',
    );
  }

  const batches = batchesResult.data as BatchRow[];
  const medicines = medicinesResult.data as MedicineRow[];
  const unresolvedKeys = new Set(
    (unresolvedResult.data as UnresolvedAlertRow[]).map(
      (row) => `${row.type}:${row.batch_id ?? row.medicine_id ?? ''}`,
    ),
  );

  const medicinesById = new Map(medicines.map((medicine) => [medicine.id, medicine]));
  const pending: PendingAlert[] = [];

  // Expiry alerts: one per batch still holding stock.
  for (const batch of batches) {
    if (batch.status !== 'AVAILABLE') continue; // already handled elsewhere
    const medicine = medicinesById.get(batch.medicine_id);
    const medicineLabel = medicine
      ? `${medicine.name}${medicine.strength ? ` ${medicine.strength}` : ''}`
      : 'Unknown medicine';
    const { daysLeft } = classifyBatch(batch.expiry_date, now);

    if (daysLeft < 0) {
      pending.push({
        type: 'EXPIRED',
        severity: 'CRITICAL',
        title: `Expired: ${medicineLabel}`,
        message: `Batch ${batch.batch_no} of ${medicineLabel} expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} ago with ${unitsLabel(batch.quantity)} on hand. Remove, return, or quarantine it from the Expiry Center.`,
        medicineId: batch.medicine_id,
        batchId: batch.id,
      });
    } else if (daysLeft <= warningDays) {
      const severity: AlertSeverity = daysLeft <= criticalDays ? 'HIGH' : 'MEDIUM';
      pending.push({
        type: 'EXPIRING',
        severity,
        title: `Expiring soon: ${medicineLabel}`,
        message: `Batch ${batch.batch_no} of ${medicineLabel} expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'} with ${unitsLabel(batch.quantity)} on hand.`,
        medicineId: batch.medicine_id,
        batchId: batch.id,
      });
    }
  }

  // Low-stock alerts: one per medicine at/below its reorder level.
  const stockByMedicine = new Map<string, number>();
  for (const batch of batches) {
    if (batch.status !== 'AVAILABLE') continue;
    stockByMedicine.set(batch.medicine_id, (stockByMedicine.get(batch.medicine_id) ?? 0) + batch.quantity);
  }
  for (const medicine of medicines) {
    if (medicine.reorder_level <= 0) continue;
    const quantity = stockByMedicine.get(medicine.id) ?? 0;
    if (quantity > medicine.reorder_level) continue;
    pending.push({
      type: 'LOW_STOCK',
      severity: quantity === 0 ? 'HIGH' : 'MEDIUM',
      title: quantity === 0 ? `Out of stock: ${medicine.name}` : `Low stock: ${medicine.name}`,
      message:
        quantity === 0
          ? `${medicine.name} is out of stock. Reorder to avoid lost sales.`
          : `${medicine.name} is down to ${unitsLabel(quantity)} (reorder level ${medicine.reorder_level}).`,
      medicineId: medicine.id,
      batchId: null,
    });
  }

  const toInsert = pending.filter(
    (alert) => !unresolvedKeys.has(`${alert.type}:${alert.batchId ?? alert.medicineId ?? ''}`),
  );
  if (toInsert.length === 0) {
    return { created: 0, skipped: pending.length };
  }

  const { error: insertError } = await supabase.from('alerts').insert(
    toInsert.map((alert) => ({
      pharmacy_id: pharmacyId,
      medicine_id: alert.medicineId,
      batch_id: alert.batchId,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      status: 'NEW',
    })),
  );
  if (insertError) throw new Error(insertError.message);

  return { created: toInsert.length, skipped: pending.length - toInsert.length };
}

/** Shared helper for safety services that raise event alerts (quarantine, recall). */
export async function insertEventAlert(pharmacyId: string, alert: PendingAlert): Promise<void> {
  const { error } = await getSupabaseAdmin().from('alerts').insert({
    pharmacy_id: pharmacyId,
    medicine_id: alert.medicineId,
    batch_id: alert.batchId,
    type: alert.type,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    status: 'NEW',
  });
  if (error) {
    // The alert is auxiliary; the underlying action must still succeed.
    console.error('[alert-engine] failed to record event alert', error.message);
  }
}
