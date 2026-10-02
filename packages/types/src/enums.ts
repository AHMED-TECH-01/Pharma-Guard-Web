/**
 * Shared domain enums for PharmaGuard.
 * Values are stable wire-format strings used across API, DB and UI.
 */

export type UserRole = 'OWNER' | 'MANAGER' | 'PHARMACIST' | 'STAFF';

export type MembershipStatus = 'active' | 'invited' | 'suspended';

/** Lifecycle status of a physical stock batch (SRD §7 state machine). */
export type BatchStatus =
  | 'AVAILABLE'
  | 'QUARANTINED'
  | 'RETURNED'
  | 'REMOVED'
  | 'ARCHIVED';

/** Server-calculated expiry bucket (architecture.md, TRD §10). */
export type ExpiryStatus = 'EXPIRED' | 'CRITICAL' | 'WARNING' | 'SAFE';

export type AlertType =
  | 'EXPIRED'
  | 'EXPIRING'
  | 'LOW_STOCK'
  | 'STOCKOUT_RISK'
  | 'DEAD_STOCK'
  | 'OVERSTOCK'
  | 'RECALL'
  | 'QUARANTINE'
  | 'OCR_REVIEW';

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type AlertStatus = 'NEW' | 'READ' | 'SNOOZED' | 'RESOLVED';

export type ReturnReason =
  | 'EXPIRED'
  | 'DAMAGED'
  | 'RECALL'
  | 'INCORRECT_SHIPMENT'
  | 'OTHER';

export type ReturnStatus = 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED';

export type QuarantineItemStatus =
  | 'QUARANTINED'
  | 'RELEASED'
  | 'RETURNED'
  | 'REMOVED';

export type RecallStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type OcrScanStatus =
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CONFIRMED'
  | 'DISCARDED';

/** Offered plans live in billing.ts (single source of truth, PRD §10.22);
 *  ENTERPRISE stays valid for legacy rows but is no longer offered. */
export type SubscriptionPlan =
  | 'FREE'
  | 'STARTER'
  | 'PROFESSIONAL'
  | 'PREMIUM'
  | 'ENTERPRISE';

export type SubscriptionStatus =
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELLED';
