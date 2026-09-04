import type {
  ReportColumn,
  ReportPreview,
  ReportSummaryLine,
  ReportType,
} from '@pharmaguard/types';
import { getSupabaseAdmin } from '../../database/supabase.js';
import { ApiError } from '../../utils/api-error.js';

/**
 * Report builders (PRD §10.20). One builder per report type returns cells
 * aligned with the columns; the JSON preview, CSV renderer and PDF renderer
 * all consume the same output. State reports (inventory/expired/near-expiry/
 * valuation) reflect current stock; dated reports (sales/purchases/audit/
 * returns) take a bounded from/to window (default: last 30 days).
 */

const PREVIEW_ROW_CAP = 50;
const MAX_WINDOW_DAYS = 366;
const DEFAULT_WINDOW_DAYS = 30;

const DATED_REPORTS: ReadonlySet<ReportType> = new Set<ReportType>([
  'sales',
  'purchases',
  'audit',
  'returns',
]);

const REPORT_TITLES: Record<ReportType, string> = {
  inventory: 'Inventory Report',
  expired: 'Expired Stock Report',
  'near-expiry': 'Near-Expiry Report',
  sales: 'Sales Report',
  purchases: 'Purchases Report',
  valuation: 'Stock Valuation Report',
  audit: 'Audit Report',
  returns: 'Returns Report',
};

export interface ReportData {
  title: string;
  columns: ReportColumn[];
  rows: (string | number | null)[][];
  summary: ReportSummaryLine[];
  from: string | null;
  to: string | null;
  generatedAt: string;
}

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

function timestampCell(value: string | null): string {
  return value ? value.slice(0, 16).replace('T', ' ') : '';
}

function resolveWindow(type: ReportType, query: { from?: string; to?: string }): {
  from: string | null;
  to: string | null;
  fromIso: string | null;
  toIso: string | null;
} {
  if (!DATED_REPORTS.has(type)) {
    if (query.from || query.to) {
      throw ApiError.badRequest(
        `The ${type} report reflects current stock and does not take a date range.`,
      );
    }
    return { from: null, to: null, fromIso: null, toIso: null };
  }

  const now = new Date();
  const from = query.from ?? isoDate(addDays(now, -(DEFAULT_WINDOW_DAYS - 1)));
  const to = query.to ?? isoDate(now);
  if (from > to) {
    throw ApiError.badRequest('"from" must be on or before "to".');
  }
  const spanDays =
    (Date.parse(`${to}T23:59:59`) - Date.parse(`${from}T00:00:00`)) / (24 * 60 * 60 * 1000);
  if (spanDays > MAX_WINDOW_DAYS) {
    throw ApiError.badRequest('Report window cannot exceed 366 days.');
  }
  return {
    from,
    to,
    fromIso: new Date(`${from}T00:00:00`).toISOString(),
    toIso: new Date(`${to}T23:59:59.999`).toISOString(),
  };
}

type BatchCostRow = {
  medicine_id: string;
  quantity: number;
  purchase_price: string | number | null;
  expiry_date?: string;
  status?: string;
  batch_no?: string;
  medicines:
    | { name: string; strength: string | null; purchase_price: string | number | null }
    | { name: string; strength: string | null; purchase_price: string | number | null }[]
    | null;
};

function medicineOf(row: BatchCostRow): { name: string; strength: string | null } {
  const medicine = Array.isArray(row.medicines) ? row.medicines[0] : row.medicines;
  return { name: medicine?.name ?? 'Unknown medicine', strength: medicine?.strength ?? null };
}

function unitCostOf(row: BatchCostRow): number {
  const medicine = Array.isArray(row.medicines) ? row.medicines[0] : row.medicines;
  return toNumber(row.purchase_price) || toNumber(medicine?.purchase_price);
}

async function fetchStockBatches(pharmacyId: string, filters?: {
  status?: string;
  expiryFrom?: string;
  expiryTo?: string;
}): Promise<BatchCostRow[]> {
  let query = getSupabaseAdmin()
    .from('batches')
    .select(
      'medicine_id, batch_no, expiry_date, quantity, purchase_price, status, medicines(name, strength, purchase_price)',
    )
    .eq('pharmacy_id', pharmacyId)
    .gt('quantity', 0)
    .in('status', ['AVAILABLE', 'QUARANTINED', 'RETURNED', 'REMOVED']);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.expiryFrom) query = query.gte('expiry_date', filters.expiryFrom);
  if (filters?.expiryTo) query = query.lt('expiry_date', filters.expiryTo);

  const { data, error } = await query;
  if (error) {
    throw ApiError.internal(`Unable to load report data: ${error.message}`);
  }
  return (data ?? []) as unknown as BatchCostRow[];
}

interface ReportBuilder {
  columns: ReportColumn[];
  build: () => Promise<{ rows: (string | number | null)[][]; summary: ReportSummaryLine[] }>;
}

function builders(pharmacyId: string, window: ReturnType<typeof resolveWindow>): Record<ReportType, ReportBuilder> {
  const supabase = getSupabaseAdmin();

  const stockBuilders = {
    inventory: {
      columns: [
        { key: 'medicine', label: 'Medicine' },
        { key: 'strength', label: 'Strength' },
        { key: 'batch', label: 'Batch' },
        { key: 'expiry', label: 'Expiry' },
        { key: 'quantity', label: 'Quantity' },
        { key: 'unitCost', label: 'Unit cost' },
        { key: 'status', label: 'Status' },
      ],
      build: async () => {
        const batches = await fetchStockBatches(pharmacyId);
        batches.sort((a, b) => medicineOf(a).name.localeCompare(medicineOf(b).name));
        let units = 0;
        let value = 0;
        const rows = batches.map((row) => {
          const medicine = medicineOf(row);
          const cost = unitCostOf(row);
          units += row.quantity;
          value += row.quantity * cost;
          return [
            medicine.name,
            medicine.strength,
            row.batch_no ?? '',
            row.expiry_date ?? '',
            row.quantity,
            round2(cost) || null,
            row.status ?? '',
          ];
        });
        return {
          rows,
          summary: [
            { label: 'Total batches', value: batches.length },
            { label: 'Total units', value: units },
            { label: 'Total value at cost', value: round2(value) },
          ],
        };
      },
    },
    expired: {
      columns: [
        { key: 'medicine', label: 'Medicine' },
        { key: 'strength', label: 'Strength' },
        { key: 'batch', label: 'Batch' },
        { key: 'expiry', label: 'Expiry' },
        { key: 'quantity', label: 'Quantity' },
        { key: 'value', label: 'Value at cost' },
      ],
      build: async () => {
        const batches = await fetchStockBatches(pharmacyId, {
          status: 'AVAILABLE',
          expiryTo: isoDate(new Date()),
        });
        batches.sort((a, b) => (a.expiry_date ?? '').localeCompare(b.expiry_date ?? ''));
        let units = 0;
        let value = 0;
        const rows = batches.map((row) => {
          const medicine = medicineOf(row);
          const cost = row.quantity * unitCostOf(row);
          units += row.quantity;
          value += cost;
          return [
            medicine.name,
            medicine.strength,
            row.batch_no ?? '',
            row.expiry_date ?? '',
            row.quantity,
            round2(cost),
          ];
        });
        return {
          rows,
          summary: [
            { label: 'Expired batches', value: batches.length },
            { label: 'Expired units', value: units },
            { label: 'Value at cost', value: round2(value) },
          ],
        };
      },
    },
    'near-expiry': {
      columns: [
        { key: 'medicine', label: 'Medicine' },
        { key: 'strength', label: 'Strength' },
        { key: 'batch', label: 'Batch' },
        { key: 'expiry', label: 'Expiry' },
        { key: 'quantity', label: 'Quantity' },
        { key: 'value', label: 'Value at cost' },
      ],
      build: async () => {
        const now = new Date();
        const batches = await fetchStockBatches(pharmacyId, {
          status: 'AVAILABLE',
          expiryFrom: isoDate(now),
          expiryTo: isoDate(addDays(now, 91)),
        });
        batches.sort((a, b) => (a.expiry_date ?? '').localeCompare(b.expiry_date ?? ''));
        let units = 0;
        let value = 0;
        const rows = batches.map((row) => {
          const medicine = medicineOf(row);
          const cost = row.quantity * unitCostOf(row);
          units += row.quantity;
          value += cost;
          return [
            medicine.name,
            medicine.strength,
            row.batch_no ?? '',
            row.expiry_date ?? '',
            row.quantity,
            round2(cost),
          ];
        });
        return {
          rows,
          summary: [
            { label: 'Batches expiring within 90 days', value: batches.length },
            { label: 'Units', value: units },
            { label: 'Value at cost', value: round2(value) },
          ],
        };
      },
    },
    valuation: {
      columns: [
        { key: 'medicine', label: 'Medicine' },
        { key: 'strength', label: 'Strength' },
        { key: 'units', label: 'Units' },
        { key: 'avgCost', label: 'Avg unit cost' },
        { key: 'value', label: 'Value at cost' },
      ],
      build: async () => {
        const batches = await fetchStockBatches(pharmacyId, { status: 'AVAILABLE' });
        const byMedicine = new Map<string, { name: string; strength: string | null; units: number; value: number }>();
        for (const row of batches) {
          const medicine = medicineOf(row);
          const entry = byMedicine.get(row.medicine_id) ?? {
            name: medicine.name,
            strength: medicine.strength,
            units: 0,
            value: 0,
          };
          entry.units += row.quantity;
          entry.value += row.quantity * unitCostOf(row);
          byMedicine.set(row.medicine_id, entry);
        }
        const entries = [...byMedicine.values()].sort((a, b) => b.value - a.value);
        let totalUnits = 0;
        let totalValue = 0;
        const rows = entries.map((entry) => {
          totalUnits += entry.units;
          totalValue += entry.value;
          return [
            entry.name,
            entry.strength,
            entry.units,
            entry.units > 0 ? round2(entry.value / entry.units) : null,
            round2(entry.value),
          ];
        });
        return {
          rows,
          summary: [
            { label: 'Medicines on hand', value: entries.length },
            { label: 'Total units', value: totalUnits },
            { label: 'Total value at cost', value: round2(totalValue) },
          ],
        };
      },
    },
  };

  const datedBuilders = {
    sales: {
      columns: [
        { key: 'soldAt', label: 'Sold at' },
        { key: 'medicine', label: 'Medicine' },
        { key: 'strength', label: 'Strength' },
        { key: 'batch', label: 'Batch' },
        { key: 'quantity', label: 'Quantity' },
        { key: 'unitPrice', label: 'Unit price' },
        { key: 'total', label: 'Total' },
        { key: 'reversed', label: 'Reversed' },
      ],
      build: async () => {
        const { data, error } = await supabase
          .from('sales')
          .select(
            'sold_at, quantity, unit_price, total_amount, reversed_at, batches(batch_no), medicines(name, strength)',
          )
          .eq('pharmacy_id', pharmacyId)
          .gte('sold_at', window.fromIso ?? '')
          .lte('sold_at', window.toIso ?? '')
          .order('sold_at', { ascending: false });
        if (error) throw ApiError.internal(`Unable to load report data: ${error.message}`);

        let revenue = 0;
        let units = 0;
        const rows = (data ?? []).map((raw) => {
          const row = raw as {
            sold_at: string;
            quantity: number;
            unit_price: string | number;
            total_amount: string | number;
            reversed_at: string | null;
            batches: { batch_no: string } | { batch_no: string }[] | null;
            medicines: { name: string; strength: string | null } | { name: string; strength: string | null }[] | null;
          };
          const medicine = Array.isArray(row.medicines) ? row.medicines[0] : row.medicines;
          const batch = Array.isArray(row.batches) ? row.batches[0] : row.batches;
          revenue += toNumber(row.total_amount);
          units += row.quantity;
          return [
            timestampCell(row.sold_at),
            medicine?.name ?? 'Unknown medicine',
            medicine?.strength ?? null,
            batch?.batch_no ?? '',
            row.quantity,
            round2(toNumber(row.unit_price)),
            round2(toNumber(row.total_amount)),
            row.reversed_at ? 'Yes' : 'No',
          ];
        });
        return {
          rows,
          summary: [
            { label: 'Sales records', value: rows.length },
            { label: 'Units sold', value: units },
            { label: 'Revenue', value: round2(revenue) },
          ],
        };
      },
    },
    purchases: {
      columns: [
        { key: 'receivedAt', label: 'Received at' },
        { key: 'invoice', label: 'Invoice' },
        { key: 'supplier', label: 'Supplier' },
        { key: 'medicine', label: 'Medicine' },
        { key: 'strength', label: 'Strength' },
        { key: 'batch', label: 'Batch' },
        { key: 'quantity', label: 'Quantity' },
        { key: 'unitCost', label: 'Unit cost' },
        { key: 'lineTotal', label: 'Line total' },
      ],
      build: async () => {
        const { data, error } = await supabase
          .from('purchase_items')
          .select(
            'quantity, unit_cost, purchases!inner(invoice_no, received_at, suppliers(name)), medicines(name, strength), batches(batch_no)',
          )
          .eq('purchases.pharmacy_id', pharmacyId)
          .gte('purchases.received_at', window.fromIso ?? '')
          .lte('purchases.received_at', window.toIso ?? '');
        if (error) throw ApiError.internal(`Unable to load report data: ${error.message}`);

        let cost = 0;
        let units = 0;
        const rows = (data ?? []).map((raw) => {
          // !inner + nested embeds infer as arrays; cast through unknown.
          const row = raw as unknown as {
            quantity: number;
            unit_cost: string | number;
            purchases: {
              invoice_no: string | null;
              received_at: string;
              suppliers: { name: string | null } | { name: string | null }[] | null;
            } | null;
            medicines: { name: string; strength: string | null } | { name: string; strength: string | null }[] | null;
            batches: { batch_no: string } | { batch_no: string }[] | null;
          };
          const purchase = row.purchases;
          const supplier = purchase ? (Array.isArray(purchase.suppliers) ? purchase.suppliers[0] : purchase.suppliers) : null;
          const medicine = Array.isArray(row.medicines) ? row.medicines[0] : row.medicines;
          const batch = Array.isArray(row.batches) ? row.batches[0] : row.batches;
          const lineTotal = row.quantity * toNumber(row.unit_cost);
          cost += lineTotal;
          units += row.quantity;
          return [
            purchase ? timestampCell(purchase.received_at) : '',
            purchase?.invoice_no ?? null,
            supplier?.name ?? null,
            medicine?.name ?? 'Unknown medicine',
            medicine?.strength ?? null,
            batch?.batch_no ?? '',
            row.quantity,
            round2(toNumber(row.unit_cost)),
            round2(lineTotal),
          ];
        });
        rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
        return {
          rows,
          summary: [
            { label: 'Purchase lines', value: rows.length },
            { label: 'Units received', value: units },
            { label: 'Total cost', value: round2(cost) },
          ],
        };
      },
    },
    audit: {
      columns: [
        { key: 'when', label: 'When' },
        { key: 'actor', label: 'User' },
        { key: 'action', label: 'Action' },
        { key: 'entityType', label: 'Entity' },
        { key: 'entityId', label: 'Entity ID' },
      ],
      build: async () => {
        const { data, error } = await supabase
          .from('audit_logs')
          .select('action, entity_type, entity_id, user_id, created_at')
          .eq('pharmacy_id', pharmacyId)
          .gte('created_at', window.fromIso ?? '')
          .lte('created_at', window.toIso ?? '')
          .order('created_at', { ascending: false });
        if (error) throw ApiError.internal(`Unable to load report data: ${error.message}`);

        const userIds = [...new Set((data ?? []).map((row) => (row as { user_id: string | null }).user_id).filter((id): id is string => id !== null))];
        const names = new Map<string, string>();
        if (userIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds);
          if (profilesError) throw ApiError.internal(`Unable to load report data: ${profilesError.message}`);
          for (const profile of profiles ?? []) {
            const record = profile as { id: string; full_name: string | null };
            names.set(record.id, record.full_name || record.id);
          }
        }

        const rows = (data ?? []).map((raw) => {
          const row = raw as {
            action: string;
            entity_type: string;
            entity_id: string | null;
            user_id: string | null;
            created_at: string;
          };
          return [
            timestampCell(row.created_at),
            row.user_id ? (names.get(row.user_id) ?? 'Unknown user') : 'System',
            row.action,
            row.entity_type,
            row.entity_id,
          ];
        });
        return { rows, summary: [{ label: 'Audit events', value: rows.length }] };
      },
    },
    returns: {
      columns: [
        { key: 'createdAt', label: 'Created' },
        { key: 'medicine', label: 'Medicine' },
        { key: 'strength', label: 'Strength' },
        { key: 'batch', label: 'Batch' },
        { key: 'quantity', label: 'Quantity' },
        { key: 'reason', label: 'Reason' },
        { key: 'status', label: 'Status' },
        { key: 'supplier', label: 'Supplier' },
      ],
      build: async () => {
        const { data, error } = await supabase
          .from('returns')
          .select(
            'created_at, quantity, reason, status, batches(batch_no, medicines(name, strength)), suppliers(name)',
          )
          .eq('pharmacy_id', pharmacyId)
          .gte('created_at', window.fromIso ?? '')
          .lte('created_at', window.toIso ?? '')
          .order('created_at', { ascending: false });
        if (error) throw ApiError.internal(`Unable to load report data: ${error.message}`);

        let units = 0;
        const rows = (data ?? []).map((raw) => {
          // Nested batches->medicines embeds infer as arrays; cast through unknown.
          const row = raw as unknown as {
            created_at: string;
            quantity: number;
            reason: string;
            status: string;
            batches:
              | { batch_no: string; medicines: { name: string; strength: string | null } | null }
              | { batch_no: string; medicines: { name: string; strength: string | null } | null }[]
              | null;
            suppliers: { name: string | null } | { name: string | null }[] | null;
          };
          const batch = Array.isArray(row.batches) ? row.batches[0] : row.batches;
          const medicine = batch?.medicines ?? null;
          const supplier = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers;
          units += row.quantity;
          return [
            timestampCell(row.created_at),
            medicine?.name ?? 'Unknown medicine',
            medicine?.strength ?? null,
            batch?.batch_no ?? '',
            row.quantity,
            row.reason,
            row.status,
            supplier?.name ?? null,
          ];
        });
        return {
          rows,
          summary: [
            { label: 'Returns', value: rows.length },
            { label: 'Units', value: units },
          ],
        };
      },
    },
  };

  return { ...stockBuilders, ...datedBuilders };
}

export async function buildReport(
  pharmacyId: string,
  type: ReportType,
  query: { from?: string; to?: string },
): Promise<ReportData> {
  const window = resolveWindow(type, query);
  const builder = builders(pharmacyId, window)[type];
  const { rows, summary } = await builder.build();
  return {
    title: REPORT_TITLES[type],
    columns: builder.columns,
    rows,
    summary,
    from: window.from,
    to: window.to,
    generatedAt: new Date().toISOString(),
  };
}

export async function getReportPreview(
  pharmacyId: string,
  type: ReportType,
  query: { from?: string; to?: string },
): Promise<ReportPreview> {
  const report = await buildReport(pharmacyId, type, query);
  return { type, ...report, totalRows: report.rows.length, rows: report.rows.slice(0, PREVIEW_ROW_CAP) };
}

/** CSV with Excel-friendly BOM; summary lines append below the table. */
export function renderReportCsv(report: ReportData): string {
  const escape = (value: string | number | null): string => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [
    report.columns.map((column) => escape(column.label)).join(','),
    ...report.rows.map((row) => row.map(escape).join(',')),
    ...report.summary.map((line) => `${escape(line.label)},${escape(line.value)}`),
  ];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function reportFileName(report: ReportData, format: 'csv' | 'pdf'): string {
  const stamp = isoDate(new Date());
  return `pharmaguard-${report.title.toLowerCase().replace(/[^a-z]+/g, '-')}-${stamp}.${format}`;
}
