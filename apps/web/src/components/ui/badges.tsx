import type {
  ExpiryBucketKey,
  ExpiryStatus,
  InventoryBatchStatus,
  QuarantineItemStatus,
  RecallStatus,
  StockLevel,
} from '@pharmaguard/types';
import { expiryBucketTone, expiryTone, formatDaysLeft } from '@/lib/format';

/**
 * Status badges (ui-registry §3: ExpiryBadge, StockBadge).
 * Colors map to the status triplets defined in ui-tokens.md §3.
 */

const STOCK_STYLES: Record<StockLevel, string> = {
  IN_STOCK: 'bg-status-safe-bg text-status-safe-fg',
  LOW_STOCK: 'bg-status-warning-bg text-status-warning-fg',
  OUT_OF_STOCK: 'bg-status-critical-bg text-status-critical-fg',
};

const STOCK_LABELS: Record<StockLevel, string> = {
  IN_STOCK: 'In Stock',
  LOW_STOCK: 'Low Stock',
  OUT_OF_STOCK: 'Out of Stock',
};

export function StockBadge({ level }: { level: StockLevel }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STOCK_STYLES[level]}`}>
      {STOCK_LABELS[level]}
    </span>
  );
}

const EXPIRY_STYLES: Record<ExpiryBucketKey, string> = {
  expired: 'bg-status-expired-bg text-status-expired-fg',
  critical: 'bg-status-critical-bg text-status-critical-fg',
  warning: 'bg-status-warning-bg text-status-warning-fg',
  safe: 'bg-status-safe-bg text-status-safe-fg',
};

export function ExpiryBadge({ expiryDate }: { expiryDate: string }) {
  const expiry = new Date(`${expiryDate}T00:00:00`);
  const daysLeft = Math.round((expiry.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${EXPIRY_STYLES[expiryTone(daysLeft)]}`}>
      {formatDaysLeft(daysLeft)}
    </span>
  );
}

const BATCH_STATUS_STYLES: Record<string, string> = {
  AVAILABLE: 'bg-status-safe-bg text-status-safe-fg',
  QUARANTINED: 'bg-status-quarantine-bg text-status-quarantine-fg',
  RETURNED: 'bg-info-bg text-info-fg',
  REMOVED: 'bg-bg-subtle text-text-muted',
  ARCHIVED: 'bg-bg-subtle text-text-muted',
};

export function BatchStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        BATCH_STATUS_STYLES[status] ?? 'bg-bg-subtle text-text-muted'
      }`}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

/** Expiry state from a server-computed bucket + days-left pair (TRD §10). */
export function ExpiryDaysBadge({ daysLeft, bucket }: { daysLeft: number; bucket: ExpiryStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        EXPIRY_STYLES[expiryBucketTone(bucket)]
      }`}
    >
      {formatDaysLeft(daysLeft)}
    </span>
  );
}

const QUARANTINE_STATUS_STYLES: Record<QuarantineItemStatus, string> = {
  QUARANTINED: 'bg-status-quarantine-bg text-status-quarantine-fg',
  RELEASED: 'bg-status-safe-bg text-status-safe-fg',
  RETURNED: 'bg-info-bg text-info-fg',
  REMOVED: 'bg-bg-subtle text-text-muted',
};

const QUARANTINE_STATUS_LABELS: Record<QuarantineItemStatus, string> = {
  QUARANTINED: 'Quarantined',
  RELEASED: 'Released',
  RETURNED: 'Returned',
  REMOVED: 'Removed',
};

/** QuarantineBadge (ui-registry §3): quarantine item lifecycle state. */
export function QuarantineBadge({ status }: { status: QuarantineItemStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        QUARANTINE_STATUS_STYLES[status]
      }`}
    >
      {QUARANTINE_STATUS_LABELS[status]}
    </span>
  );
}

const RECALL_STATUS_STYLES: Record<RecallStatus, string> = {
  OPEN: 'bg-status-critical-bg text-status-critical-fg',
  IN_PROGRESS: 'bg-status-warning-bg text-status-warning-fg',
  COMPLETED: 'bg-status-safe-bg text-status-safe-fg',
  CANCELLED: 'bg-bg-subtle text-text-muted',
};

const RECALL_STATUS_LABELS: Record<RecallStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

/** Lifecycle badge for the Recall Center (PRD §10.16). */
export function RecallBadge({ status }: { status: RecallStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        RECALL_STATUS_STYLES[status]
      }`}
    >
      {RECALL_STATUS_LABELS[status]}
    </span>
  );
}

/** Reference inventory-table badge (Expired / Critical / Warning / Low Stock / Out of Stock / In Stock). */
const INVENTORY_STATUS_STYLES: Record<InventoryBatchStatus, string> = {
  EXPIRED: 'bg-status-expired-bg text-status-expired-fg',
  CRITICAL: 'bg-status-critical-bg text-status-critical-fg',
  WARNING: 'bg-status-warning-bg text-status-warning-fg',
  LOW_STOCK: 'bg-info-bg text-info-fg',
  OUT_OF_STOCK: 'bg-bg-subtle text-text-muted',
  IN_STOCK: 'bg-status-safe-bg text-status-safe-fg',
};

const INVENTORY_STATUS_LABELS: Record<InventoryBatchStatus, string> = {
  EXPIRED: 'Expired',
  CRITICAL: 'Critical',
  WARNING: 'Warning',
  LOW_STOCK: 'Low Stock',
  OUT_OF_STOCK: 'Out of Stock',
  IN_STOCK: 'In Stock',
};

export function InventoryStatusBadge({ status }: { status: InventoryBatchStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${INVENTORY_STATUS_STYLES[status]}`}
    >
      {INVENTORY_STATUS_LABELS[status]}
    </span>
  );
}
