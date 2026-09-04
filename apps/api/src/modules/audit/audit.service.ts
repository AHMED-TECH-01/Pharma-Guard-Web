import type {
  AuditListResponse,
  AuditUserActivity,
  AuditUsersResponse,
  ComplianceStockStat,
  ComplianceSummary,
} from '@pharmaguard/types';
import { getSupabaseAdmin } from '../../database/supabase.js';
import { ApiError } from '../../utils/api-error.js';

/**
 * Audit timeline + user activity (PRD §10.19, build-plan Phase 11).
 * audit_logs is append-only (FR-031) and indexed on (pharmacy_id,
 * created_at desc); actor names resolve through the profiles table since
 * auth.users is not exposed to PostgREST embeds.
 */

const ACTIVITY_WINDOW_DAYS = 30;
const TOP_ACTIONS_CAP = 6;

/** Audit actions that move stock (PRD §10.19 "stock adjustments/movements"). */
const STOCK_MOVEMENT_ACTIONS = new Set([
  'sale.created',
  'sale.reversed',
  'purchase.received',
  'return.approved',
  'batch.created',
]);

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

function windowBounds(query: { from?: string; to?: string }): { fromIso: string | null; toIso: string | null } {
  if (!query.from && !query.to) return { fromIso: null, toIso: null };
  const now = new Date();
  const from = query.from ?? isoDate(addDays(now, -(ACTIVITY_WINDOW_DAYS - 1)));
  const to = query.to ?? isoDate(now);
  if (from > to) throw ApiError.badRequest('"from" must be on or before "to".');
  const spanDays =
    (Date.parse(`${to}T23:59:59`) - Date.parse(`${from}T00:00:00`)) / (24 * 60 * 60 * 1000);
  if (spanDays > 366) throw ApiError.badRequest('Audit window cannot exceed 366 days.');
  return {
    fromIso: new Date(`${from}T00:00:00`).toISOString(),
    toIso: new Date(`${to}T23:59:59.999`).toISOString(),
  };
}

interface AuditRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  user_id: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  created_at: string;
}

async function fetchActorNames(userIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (userIds.length === 0) return names;
  const { data, error } = await getSupabaseAdmin()
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds);
  if (error) {
    throw ApiError.internal(`Unable to load audit actors: ${error.message}`);
  }
  for (const row of data ?? []) {
    const record = row as { id: string; full_name: string | null };
    names.set(record.id, record.full_name || record.id);
  }
  return names;
}

export async function listAuditEntries(
  pharmacyId: string,
  query: {
    action?: string;
    userId?: string;
    from?: string;
    to?: string;
    page: number;
    pageSize: number;
  },
): Promise<AuditListResponse> {
  const supabase = getSupabaseAdmin();
  const { fromIso, toIso } = windowBounds(query);

  let entriesQuery = supabase
    .from('audit_logs')
    .select(
      'id, action, entity_type, entity_id, user_id, before_data, after_data, created_at',
      { count: 'exact' },
    )
    .eq('pharmacy_id', pharmacyId);
  if (query.action) entriesQuery = entriesQuery.ilike('action', `${query.action}%`);
  if (query.userId) entriesQuery = entriesQuery.eq('user_id', query.userId);
  if (fromIso) entriesQuery = entriesQuery.gte('created_at', fromIso);
  if (toIso) entriesQuery = entriesQuery.lte('created_at', toIso);

  const { data, error, count } = await entriesQuery
    .order('created_at', { ascending: false })
    .range((query.page - 1) * query.pageSize, query.page * query.pageSize - 1);

  if (error) {
    throw ApiError.internal(`Unable to load audit entries: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as AuditRow[];
  const names = await fetchActorNames(
    [...new Set(rows.map((row) => row.user_id).filter((id): id is string => id !== null))],
  );

  return {
    entries: rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      actorName: row.user_id ? (names.get(row.user_id) ?? 'Unknown user') : null,
      createdAt: row.created_at,
      before: row.before_data,
      after: row.after_data,
    })),
    total: count ?? rows.length,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function listAuditUsers(pharmacyId: string): Promise<AuditUsersResponse> {
  const supabase = getSupabaseAdmin();
  const since = addDays(new Date(), -ACTIVITY_WINDOW_DAYS).toISOString();

  const { data, error } = await supabase
    .from('audit_logs')
    .select('user_id, created_at')
    .eq('pharmacy_id', pharmacyId)
    .gte('created_at', since);

  if (error) {
    throw ApiError.internal(`Unable to load user activity: ${error.message}`);
  }

  const byUser = new Map<string, { count: number; lastActiveAt: string | null }>();
  for (const row of data ?? []) {
    const record = row as { user_id: string | null; created_at: string };
    const key = record.user_id ?? 'system';
    const entry = byUser.get(key) ?? { count: 0, lastActiveAt: null };
    entry.count += 1;
    if (!entry.lastActiveAt || record.created_at > entry.lastActiveAt) {
      entry.lastActiveAt = record.created_at;
    }
    byUser.set(key, entry);
  }

  const names = await fetchActorNames(
    [...byUser.keys()].filter((key): key is string => key !== 'system'),
  );

  const users: AuditUserActivity[] = [...byUser.entries()]
    .map(([key, entry]) => ({
      userId: key === 'system' ? null : key,
      actorName: key === 'system' ? 'System' : (names.get(key) ?? 'Unknown user'),
      actionCount: entry.count,
      lastActiveAt: entry.lastActiveAt,
    }))
    .sort((a, b) => b.actionCount - a.actionCount)
    .slice(0, 20);

  return { windowDays: ACTIVITY_WINDOW_DAYS, users };
}

export async function getComplianceSummary(pharmacyId: string): Promise<ComplianceSummary> {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const today = isoDate(now);
  const activitySince = addDays(now, -ACTIVITY_WINDOW_DAYS).toISOString();

  const [batches, returns, activity] = await Promise.all([
    supabase
      .from('batches')
      .select('quantity, purchase_price, expiry_date, status, medicines(purchase_price)')
      .eq('pharmacy_id', pharmacyId)
      .gt('quantity', 0)
      .in('status', ['AVAILABLE', 'QUARANTINED', 'RETURNED', 'REMOVED']),
    supabase.from('returns').select('status, quantity').eq('pharmacy_id', pharmacyId),
    supabase
      .from('audit_logs')
      .select('action, user_id')
      .eq('pharmacy_id', pharmacyId)
      .gte('created_at', activitySince),
  ]);

  if (batches.error || returns.error || activity.error) {
    const firstError = batches.error ?? returns.error ?? activity.error;
    throw ApiError.internal(`Unable to load compliance summary: ${firstError?.message ?? 'unknown'}`);
  }

  const stats = (): ComplianceStockStat => ({ batches: 0, units: 0, valueAtCost: 0 });
  const expired = stats();
  const quarantined = stats();
  const removed = stats();

  for (const row of batches.data ?? []) {
    const record = row as {
      quantity: number;
      purchase_price: string | number | null;
      expiry_date: string;
      status: string;
      medicines: { purchase_price: string | number | null } | { purchase_price: string | number | null }[] | null;
    };
    const medicinePrice = Array.isArray(record.medicines)
      ? record.medicines[0]?.purchase_price
      : record.medicines?.purchase_price;
    const unitCost = toNumber(record.purchase_price) || toNumber(medicinePrice);
    const value = record.quantity * unitCost;

    if (record.status === 'AVAILABLE' && record.expiry_date < today) {
      expired.batches += 1;
      expired.units += record.quantity;
      expired.valueAtCost += value;
    } else if (record.status === 'QUARANTINED') {
      quarantined.batches += 1;
      quarantined.units += record.quantity;
      quarantined.valueAtCost += value;
    } else if (record.status === 'REMOVED') {
      removed.batches += 1;
      removed.units += record.quantity;
      removed.valueAtCost += value;
    }
  }

  let completedReturns = 0;
  let completedUnits = 0;
  let pendingReturns = 0;
  for (const row of returns.data ?? []) {
    const record = row as { status: string; quantity: number };
    if (record.status === 'COMPLETED') {
      completedReturns += 1;
      completedUnits += record.quantity;
    } else if (record.status === 'PENDING') {
      pendingReturns += 1;
    }
  }

  const actionCounts = new Map<string, number>();
  const activeUsers = new Set<string>();
  let stockMovements = 0;
  for (const row of activity.data ?? []) {
    const record = row as { action: string; user_id: string | null };
    if (STOCK_MOVEMENT_ACTIONS.has(record.action)) stockMovements += 1;
    if (record.user_id) activeUsers.add(record.user_id);
    actionCounts.set(record.action, (actionCounts.get(record.action) ?? 0) + 1);
  }
  const topActions = [...actionCounts.entries()]
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_ACTIONS_CAP);

  return {
    pharmacyId,
    generatedAt: now.toISOString(),
    expired: { ...expired, valueAtCost: round2(expired.valueAtCost) },
    quarantined: { ...quarantined, valueAtCost: round2(quarantined.valueAtCost) },
    removed: { ...removed, valueAtCost: round2(removed.valueAtCost) },
    returned: { completedReturns, completedUnits, pendingReturns },
    stockMovements30d: stockMovements,
    activeUsers30d: activeUsers.size,
    topActions,
  };
}
