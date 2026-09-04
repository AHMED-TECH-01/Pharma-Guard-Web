import type {
  AlertSeverity,
  AlertStatus,
  AlertType,
  ExpiryStatus,
  QuarantineItemStatus,
  RecallStatus,
} from './enums.js';

/**
 * Safety module contracts (PRD §10.9 Expiry Center, §10.15 Quarantine,
 * §10.16 Recall Center, §10.18 Alerts Center; TRD §10/§12).
 */

// ---------------------------------------------------------------------------
// Expiry Center
// ---------------------------------------------------------------------------

/** One status card in the Expiry Center (PRD §10.9). */
export interface ExpiryBucketCard {
  bucket: ExpiryStatus;
  batchCount: number;
  units: number;
  /** Inventory value at cost for batches in this bucket (PRD: financial exposure). */
  valueAtCost: number;
}

export interface ExpirySummary {
  pharmacyId: string;
  generatedAt: string;
  /** Effective thresholds (TRD §10 configurable via env). */
  criticalDays: number;
  warningDays: number;
  /** Fixed order: EXPIRED, CRITICAL, WARNING, SAFE. */
  buckets: ExpiryBucketCard[];
  /** Value at cost across expired + critical + warning batches. */
  valueAtRisk: number;
}

/** One FEFO-ordered row in the Expiry Center table. */
export interface ExpiryBatchItem {
  id: string;
  medicineId: string;
  medicineName: string;
  strength: string | null;
  batchNo: string;
  quantity: number;
  expiryDate: string;
  daysLeft: number;
  bucket: ExpiryStatus;
  valueAtCost: number;
  status: string;
}

export interface ExpiryBatchListResponse {
  batches: ExpiryBatchItem[];
  total: number;
  page: number;
  pageSize: number;
}

export type ExpiryAction = 'REMOVE' | 'RETURN' | 'QUARANTINE';

export interface ExpirySkippedBatch {
  id: string;
  batchNo: string;
  medicineName: string;
  reason: string;
}

export interface ExpiryActionResult {
  action: ExpiryAction;
  updated: number;
  skipped: ExpirySkippedBatch[];
}

// ---------------------------------------------------------------------------
// Alerts Center
// ---------------------------------------------------------------------------

/** Alert row with joined record targets for "Open record" (PRD §10.18). */
export interface AlertListItem {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;
  medicineId: string | null;
  medicineName: string | null;
  batchId: string | null;
  batchNo: string | null;
  snoozedUntil: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface AlertListResponse {
  alerts: AlertListItem[];
  total: number;
  page: number;
  pageSize: number;
  /** Alerts still in NEW status (drives the topbar bell badge). */
  unreadCount: number;
}

// ---------------------------------------------------------------------------
// Quarantine
// ---------------------------------------------------------------------------

export interface QuarantineListItem {
  id: string;
  batchId: string;
  batchNo: string;
  medicineId: string;
  medicineName: string;
  batchExpiryDate: string;
  batchStatus: string;
  quantity: number;
  reason: string;
  status: QuarantineItemStatus;
  createdByName: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface QuarantineListResponse {
  items: QuarantineListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export type QuarantineResolution = 'RELEASE' | 'RETURN' | 'REMOVE';

// ---------------------------------------------------------------------------
// Recall Center
// ---------------------------------------------------------------------------

export interface RecallListItem {
  id: string;
  medicineId: string | null;
  medicineName: string | null;
  batchNo: string | null;
  manufacturer: string | null;
  reason: string | null;
  status: RecallStatus;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecallAffectedBatch {
  id: string;
  batchNo: string;
  quantity: number;
  expiryDate: string;
  daysLeft: number;
  bucket: ExpiryStatus;
  status: string;
}

export interface RecallDetail extends RecallListItem {
  /** Batches matching the recall scope (medicine and/or batch number). */
  affectedBatches: RecallAffectedBatch[];
}

export interface RecallListResponse {
  recalls: RecallListItem[];
  total: number;
  page: number;
  pageSize: number;
}
