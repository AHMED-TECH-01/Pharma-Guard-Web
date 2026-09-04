/**
 * Reports, audit and compliance contracts (PRD §10.19/§10.20, TRD §7
 * extension). Report rows are plain cells aligned with the column list so
 * the same builder feeds the JSON preview, CSV and PDF renderers.
 *
 * Records support internal review only - they are never presented as
 * official DRAP certification.
 */

export type ReportType =
  | 'inventory'
  | 'expired'
  | 'near-expiry'
  | 'sales'
  | 'purchases'
  | 'valuation'
  | 'audit'
  | 'returns';

export interface ReportColumn {
  key: string;
  label: string;
}

export interface ReportSummaryLine {
  label: string;
  value: string | number;
}

export interface ReportPreview {
  type: ReportType;
  title: string;
  columns: ReportColumn[];
  rows: (string | number | null)[][];
  totalRows: number;
  summary: ReportSummaryLine[];
  /** Date-only window bounds for dated reports; null for state reports. */
  from: string | null;
  to: string | null;
  generatedAt: string;
}

export interface AuditEntryItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorName: string | null;
  createdAt: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export interface AuditListResponse {
  entries: AuditEntryItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditUserActivity {
  userId: string | null;
  actorName: string | null;
  actionCount: number;
  lastActiveAt: string | null;
}

export interface AuditUsersResponse {
  windowDays: number;
  users: AuditUserActivity[];
}

export interface ComplianceStockStat {
  batches: number;
  units: number;
  valueAtCost: number;
}

export interface ComplianceSummary {
  pharmacyId: string;
  generatedAt: string;
  expired: ComplianceStockStat;
  quarantined: ComplianceStockStat;
  removed: ComplianceStockStat;
  returned: {
    completedReturns: number;
    completedUnits: number;
    pendingReturns: number;
  };
  stockMovements30d: number;
  activeUsers30d: number;
  topActions: { action: string; count: number }[];
}
